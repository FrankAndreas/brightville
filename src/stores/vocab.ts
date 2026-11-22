import { ref } from 'vue'
import { defineStore } from 'pinia'
import { nextBox } from '@/core/vocab/boxes'
import type { Lang, Progress, VocabList } from '@/core/vocab/types'
import { ApiError, type Api, type ListDraft, type VocabResultsIn, type VocabState } from '@/services/api'

const newKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

const localDay = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** A list change that the server refused, in its words (backend/app/vocab.py) */
export type ListRefusal = 'too-many' | 'too-long' | 'empty' | 'bad-lang' | 'unknown'

const refused = (e: unknown) => e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 403

/** Lays one round's first answers over the progress, as the server does */
function lay(progress: Progress, item: VocabResultsIn, today: string): Progress {
  const next = { ...progress }
  for (const a of item.answers) {
    if (a.word.startsWith(`${item.lang}:`)) next[a.word] = nextBox(next[a.word]?.box ?? 0, a.right, today)
  }
  return next
}

/**
 * The Oberstufe's vocabulary for the child playing: his lists and how well he knows each word. The server keeps them
 * (backend/app/vocab.py); a round's answers move his words here at once, wait on the device until the server has them
 * (under brightville.vocab.<id>), and are sent again with the next load if they were lost. The lists and progress last
 * known are kept too, so the School works while the server is away; changing a list needs the server.
 */
export const useVocabStore = defineStore('vocab', () => {
  const lists = ref<VocabList[]>([])
  const progress = ref<Progress>({})
  /** Who the store is for: a round keeps its answers for the child who started it */
  const who = ref<number | null>(null)

  let api: Api | null = null
  let storage: Storage | undefined
  let key = ''
  let today: () => string = localDay
  const flying = new Set<string>()
  let generation = 0
  let issued = 0
  let taken = 0

  const store = () => storage ?? window.localStorage

  /** `day`: the game's day (the server's), so a word falls due on the same day here and there */
  function init(server: Api, personId: number, s?: Storage, day: () => string = localDay) {
    api = server
    storage = s
    key = `brightville.vocab.${personId}`
    // Before the server first answered the game has no day yet: this device's day stands in
    today = () => day() || localDay()
    who.value = personId
    const known = readKnown()
    lists.value = known?.lists ?? []
    progress.value = known?.progress ?? {}
    flying.clear()
    generation++
    taken = issued
  }

  function readKnown(): { lists: VocabList[]; progress: Progress } | null {
    try {
      const raw = JSON.parse(store().getItem(`${key}.known`) ?? 'null') as { lists?: unknown; progress?: unknown } | null
      if (!raw || !Array.isArray(raw.lists) || typeof raw.progress !== 'object' || raw.progress === null) return null
      return { lists: raw.lists as VocabList[], progress: raw.progress as Progress }
    } catch {
      return null
    }
  }

  function show(nextLists: VocabList[], nextProgress: Progress) {
    lists.value = nextLists
    progress.value = nextProgress
    try {
      store().setItem(`${key}.known`, JSON.stringify({ lists: nextLists, progress: nextProgress }))
    } catch {
      // Not kept: the server has them
    }
  }

  function readWaiting(at: string): VocabResultsIn[] {
    try {
      const raw: unknown = JSON.parse(store().getItem(at) ?? '[]')
      return (Array.isArray(raw) ? raw : []).filter((x): x is VocabResultsIn =>
        typeof x === 'object' && x !== null && typeof x.key === 'string' && (x.lang === 'en' || x.lang === 'fr')
        && Array.isArray(x.answers)
        && x.answers.every((a: unknown) => typeof a === 'object' && a !== null
          && typeof (a as { word: unknown }).word === 'string' && typeof (a as { right: unknown }).right === 'boolean'))
    } catch {
      return []
    }
  }

  function writeWaiting(at: string, items: VocabResultsIn[]) {
    try {
      if (items.length) store().setItem(at, JSON.stringify(items))
      else store().removeItem(at)
    } catch {
      // Not kept: it still counts while the page stays open
    }
  }

  /** The server's vocabulary (answer number `n`), with what still waits on this device laid over it */
  function take(state: VocabState, n: number) {
    if (n < taken) return
    taken = n
    const seen = new Set(state.seen ?? [])
    const waiting = readWaiting(key)
    const left = waiting.filter(x => !seen.has(x.key))
    if (left.length !== waiting.length) writeWaiting(key, left)
    show(state.lists, left.reduce((p, item) => lay(p, item, today()), state.progress))
  }

  async function send(server: Api, owner: string, item: VocabResultsIn): Promise<{ state: VocabState; n: number } | 'refused' | 'away'> {
    const n = ++issued
    flying.add(item.key)
    try {
      const state = await server.vocabResults(item)
      writeWaiting(owner, readWaiting(owner).filter(x => x.key !== item.key))
      return { state, n }
    } catch (e) {
      if (!refused(e)) return 'away'
      writeWaiting(owner, readWaiting(owner).filter(x => x.key !== item.key))
      return 'refused'
    } finally {
      flying.delete(item.key)
    }
  }

  /** Sends what waited, then takes the server's vocabulary */
  async function load(): Promise<void> {
    if (!api) return
    const server = api
    const owner = key
    const gen = generation
    try {
      for (const item of readWaiting(owner).filter(x => !flying.has(x.key))) {
        if ((await send(server, owner, item)) === 'away') throw new Error('away')
      }
      const n = ++issued
      const state = await server.vocab()
      if (gen === generation) take(state, n)
    } catch {
      // The School works from what is known here
    }
  }

  /**
   * A round is over: its first answers move his words at once and go to the server (or wait here until it is back).
   * `personId`: the child who started the round; if someone else plays now, the answers wait for him.
   */
  function record(lang: Lang, answers: { word: string; right: boolean }[], personId: number | null = who.value) {
    if (answers.length === 0) return
    const item: VocabResultsIn = { key: newKey(), lang, answers }
    const owner = personId === null ? key : `brightville.vocab.${personId}`
    writeWaiting(owner, [...readWaiting(owner), item])
    if (owner !== key) return
    show(lists.value, lay(progress.value, item, today()))
    if (!api) return
    const gen = generation
    void send(api, owner, item).then(answer => {
      if (typeof answer === 'object' && gen === generation) take(answer.state, answer.n)
    })
  }

  /** Makes (no id) or changes one of his lists: 'ok', 'away' (the server can't be reached), or why it was refused */
  async function saveList(draft: ListDraft): Promise<'ok' | 'away' | ListRefusal> {
    if (!api) return 'away'
    const gen = generation
    const { id, ...list } = draft
    try {
      const saved = id === undefined ? await api.createList(list) : await api.updateList(id, list)
      if (gen === generation) {
        const others = lists.value.filter(l => l.id !== saved.id)
        show([...others, saved].sort((a, b) => a.id - b.id), progress.value)
      }
      return 'ok'
    } catch (e) {
      if (refused(e)) return (e as ApiError).code as ListRefusal
      return 'away'
    }
  }

  /** Deletes one of his lists (how well he knows its words is kept): 'ok' or 'away' */
  async function deleteList(id: number): Promise<'ok' | 'away'> {
    if (!api) return 'away'
    const gen = generation
    try {
      await api.deleteList(id)
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 404)) return 'away'
    }
    if (gen === generation) show(lists.value.filter(l => l.id !== id), progress.value)
    return 'ok'
  }

  return { lists, progress, who, init, load, record, saveList, deleteList }
})
