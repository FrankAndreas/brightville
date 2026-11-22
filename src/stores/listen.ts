import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { ListenProgress } from '@/core/listen/round'
import type { Lang } from '@/core/vocab/types'
import { ApiError, type Api, type ListenResultsIn, type ListenState } from '@/services/api'

const newKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

const localDay = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const refused = (e: unknown) => e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 403

/** Lays one round's answers over the record, as the server does */
function lay(progress: ListenProgress, item: ListenResultsIn, today: string): ListenProgress {
  const next = { ...progress }
  for (const a of item.answers) {
    if (!a.scene.startsWith(`${item.lang}:`)) continue
    const old = next[a.scene]
    next[a.scene] = {
      right: (old?.right ?? 0) + (a.right ? 1 : 0),
      last_right: a.right ? today : old?.last_right ?? null,
      last_asked: today,
    }
  }
  return next
}

/**
 * The Oberstufe's listening record for the child playing: which scenes he understood. Kept by the server
 * (backend/app/listen.py) and on the page as the vocabulary is (stores/vocab.ts): a round counts here at once, waits
 * on the device (under brightville.listen.<id>) until the server has it, and is sent again with the next load.
 */
export const useListenStore = defineStore('listen', () => {
  const progress = ref<ListenProgress>({})
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

  /** `day`: the game's day (the server's) */
  function init(server: Api, personId: number, s?: Storage, day: () => string = localDay) {
    api = server
    storage = s
    key = `brightville.listen.${personId}`
    today = () => day() || localDay()
    who.value = personId
    progress.value = readKnown() ?? {}
    flying.clear()
    generation++
    taken = issued
  }

  function readKnown(): ListenProgress | null {
    try {
      const raw = JSON.parse(store().getItem(`${key}.known`) ?? 'null') as unknown
      return typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as ListenProgress) : null
    } catch {
      return null
    }
  }

  function show(next: ListenProgress) {
    progress.value = next
    try {
      store().setItem(`${key}.known`, JSON.stringify(next))
    } catch {
      // Not kept: the server has it
    }
  }

  function readWaiting(at: string): ListenResultsIn[] {
    try {
      const raw: unknown = JSON.parse(store().getItem(at) ?? '[]')
      return (Array.isArray(raw) ? raw : []).filter((x): x is ListenResultsIn =>
        typeof x === 'object' && x !== null && typeof x.key === 'string' && (x.lang === 'en' || x.lang === 'fr')
        && Array.isArray(x.answers)
        && x.answers.every((a: unknown) => typeof a === 'object' && a !== null
          && typeof (a as { scene: unknown }).scene === 'string' && typeof (a as { right: unknown }).right === 'boolean'))
    } catch {
      return []
    }
  }

  function writeWaiting(at: string, items: ListenResultsIn[]) {
    try {
      if (items.length) store().setItem(at, JSON.stringify(items))
      else store().removeItem(at)
    } catch {
      // Not kept: it still counts while the page stays open
    }
  }

  /** The server's record (answer number `n`), with what still waits on this device laid over it */
  function take(state: ListenState, n: number) {
    if (n < taken) return
    taken = n
    const seen = new Set(state.seen ?? [])
    const waiting = readWaiting(key)
    const left = waiting.filter(x => !seen.has(x.key))
    if (left.length !== waiting.length) writeWaiting(key, left)
    show(left.reduce((p, item) => lay(p, item, today()), state.progress))
  }

  async function send(server: Api, owner: string, item: ListenResultsIn): Promise<{ state: ListenState; n: number } | 'refused' | 'away'> {
    const n = ++issued
    flying.add(item.key)
    try {
      const state = await server.listenResults(item)
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

  /** Sends what waited, then takes the server's record */
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
      const state = await server.listen()
      if (gen === generation) take(state, n)
    } catch {
      // The Reimhaus works from what is known here
    }
  }

  /**
   * A round is over: its answers count here at once and go to the server (or wait here until it is back).
   * `personId`: the child who started the round; if someone else plays now, the answers wait for him.
   */
  function record(lang: Lang, answers: { scene: string; right: boolean }[], personId: number | null = who.value) {
    if (answers.length === 0) return
    const item: ListenResultsIn = { key: newKey(), lang, answers }
    const owner = personId === null ? key : `brightville.listen.${personId}`
    writeWaiting(owner, [...readWaiting(owner), item])
    if (owner !== key) return
    show(lay(progress.value, item, today()))
    if (!api) return
    const gen = generation
    void send(api, owner, item).then(answer => {
      if (typeof answer === 'object' && gen === generation) take(answer.state, answer.n)
    })
  }

  return { progress, who, init, load, record }
})
