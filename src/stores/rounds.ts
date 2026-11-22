import { ref, type Ref } from 'vue'
import { defineStore } from 'pinia'
import type { Lang } from '@/core/vocab/types'
import { ApiError, type Api } from '@/services/api'

const newKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

const localDay = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const refused = (e: unknown) => e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 403

/** One round's answers as they are sent, counted once by `key` */
export interface RoundResults<A> {
  key: string
  lang: Lang
  answers: A[]
}

/** What the server answers: his progress, and the keys of his latest rounds it has */
export interface RoundState<P> {
  progress: P
  seen?: string[]
}

export interface RoundStoreOptions<P, A> {
  /** localStorage: rounds waiting under `<prefix>.<id>`, the progress last known under `<prefix>.<id>.known` */
  prefix: string
  fetch(api: Api): Promise<RoundState<P>>
  send(api: Api, item: RoundResults<A>): Promise<RoundState<P>>
  /** Lays one round over the progress, as the server does */
  lay(progress: P, item: RoundResults<A>, today: string): P
  isAnswer(x: unknown): x is A
  /** The progress of a child with no rounds yet */
  empty(): P
  /** Whether a progress read back from the device is usable (default: any value but null) */
  isProgress?(x: unknown): x is P
}

export interface RoundStore<P, A> {
  progress: Ref<P>
  /** Who the store is for: a round keeps its answers for the child who started it */
  who: Ref<number | null>
  /** `day`: the game's day (the server's) */
  init(api: Api, personId: number, storage?: Storage, day?: () => string): void
  /** Sends what waited, then takes the server's progress */
  load(): Promise<void>
  /**
   * A round is over: its answers count here at once and go to the server (or wait here until it is back).
   * `personId`: the child who started the round; if someone else plays now, the answers wait for that child.
   */
  record(lang: Lang, answers: A[], personId?: number | null): void
}

/**
 * A Pinia store for an Oberstufe record (listening, grammar …) that the server keeps: a round counts here at once,
 * waits on the device until the server has it, is sent again with the next load if it was lost, and counts once (the
 * server knows each round's key). The progress last known is kept too, so the building works while the server is away.
 */
export function defineRoundStore<P, A>(id: string, opts: RoundStoreOptions<P, A>) {
  return defineStore(id, (): RoundStore<P, A> => {
    const progress = ref(opts.empty()) as Ref<P>
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
    const isProgress = opts.isProgress ?? ((x: unknown): x is P => x !== null && x !== undefined)

    function init(server: Api, personId: number, s?: Storage, day: () => string = localDay) {
      api = server
      storage = s
      key = `${opts.prefix}.${personId}`
      today = () => day() || localDay()
      who.value = personId
      progress.value = readKnown() ?? opts.empty()
      flying.clear()
      generation++
      taken = issued
    }

    function readKnown(): P | null {
      try {
        const raw: unknown = JSON.parse(store().getItem(`${key}.known`) ?? 'null')
        return isProgress(raw) ? raw : null
      } catch {
        return null
      }
    }

    function show(next: P) {
      progress.value = next
      try {
        store().setItem(`${key}.known`, JSON.stringify(next))
      } catch {
        // Not kept: the server has it
      }
    }

    function readWaiting(at: string): RoundResults<A>[] {
      try {
        const raw: unknown = JSON.parse(store().getItem(at) ?? '[]')
        return (Array.isArray(raw) ? raw : []).filter((x): x is RoundResults<A> =>
          typeof x === 'object' && x !== null && typeof x.key === 'string' && (x.lang === 'en' || x.lang === 'fr')
          && Array.isArray(x.answers) && x.answers.every((a: unknown) => opts.isAnswer(a)))
      } catch {
        return []
      }
    }

    function writeWaiting(at: string, items: RoundResults<A>[]) {
      try {
        if (items.length) store().setItem(at, JSON.stringify(items))
        else store().removeItem(at)
      } catch {
        // Not kept: it still counts while the page stays open
      }
    }

    /** The server's progress (answer number `n`), with what still waits on this device laid over it */
    function take(state: RoundState<P>, n: number) {
      if (n < taken) return
      taken = n
      const seen = new Set(state.seen ?? [])
      const waiting = readWaiting(key)
      const left = waiting.filter(x => !seen.has(x.key))
      if (left.length !== waiting.length) writeWaiting(key, left)
      show(left.reduce((p, item) => opts.lay(p, item, today()), state.progress))
    }

    async function send(server: Api, owner: string, item: RoundResults<A>): Promise<{ state: RoundState<P>; n: number } | 'refused' | 'away'> {
      const n = ++issued
      flying.add(item.key)
      try {
        const state = await opts.send(server, item)
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
        const state = await opts.fetch(server)
        if (gen === generation) take(state, n)
      } catch {
        // The building works from what is known here
      }
    }

    function record(lang: Lang, answers: A[], personId: number | null = who.value) {
      if (answers.length === 0) return
      const item: RoundResults<A> = { key: newKey(), lang, answers }
      const owner = personId === null ? key : `${opts.prefix}.${personId}`
      writeWaiting(owner, [...readWaiting(owner), item])
      if (owner !== key) return
      show(opts.lay(progress.value, item, today()))
      if (!api) return
      const gen = generation
      void send(api, owner, item).then(answer => {
        if (typeof answer === 'object' && gen === generation) take(answer.state, answer.n)
      })
    }

    return { progress, who, init, load, record }
  })
}
