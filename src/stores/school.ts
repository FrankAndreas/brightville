import { ref } from 'vue'
import { defineStore } from 'pinia'
import { applyResults, startLadders, type Ladder, type LadderState, type Ladders } from '@/core/ladders'
import { ApiError, type Api, type SchoolResultsIn, type SchoolState } from '@/services/api'

const LADDERS: Ladder[] = ['zaehlen', 'rechnen']

const newKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

/** One visit's first-try answers, for each solved task */
export type VisitResults = { ladder: Ladder; firstTry: boolean }[]

/** A visit's answers laid over the ladders, each only at the step it was asked at (as the server does) */
function lay(ladders: Ladders, item: SchoolResultsIn): Ladders {
  const next = { ...ladders }
  for (const ladder of LADDERS) {
    const r = item[ladder]
    if (r.results.length && r.step === next[ladder].step) next[ladder] = applyResults(next[ladder], r.results, ladder)
  }
  return next
}

/**
 * The School's two Lehrplan 21 ladders for the child playing. The server keeps them (backend/app/school.py); a visit's
 * answers move her steps here at once, wait on the device until the server has them, and are sent again with the next
 * load if they were lost.
 */
export const useSchoolStore = defineStore('school', () => {
  const ladders = ref<Ladders>(startLadders(false))
  /** Who the store is for: a visit keeps its answers for the child who started it */
  const who = ref<number | null>(null)

  let api: Api | null = null
  let storage: Storage | undefined
  let key = ''
  /** Results on their way, so a load doesn't send them a second time */
  const flying = new Set<string>()
  let generation = 0
  /** Requests are numbered as they go out: an answer older than the one taken last is not taken */
  let issued = 0
  let taken = 0

  const store = () => storage ?? window.localStorage

  function init(server: Api, personId: number, s?: Storage) {
    api = server
    storage = s
    key = `brightville.school.${personId}`
    who.value = personId
    ladders.value = readKnown() ?? startLadders(false)
    flying.clear()
    generation++
    taken = issued
  }

  /** The steps last known on this device, so the School asks at her steps while the server is away */
  function readKnown(): Ladders | null {
    try {
      const raw: unknown = JSON.parse(store().getItem(`${key}.ladders`) ?? 'null')
      const ok = (x: unknown): x is LadderState => typeof x === 'object' && x !== null
        && typeof (x as LadderState).step === 'number' && Array.isArray((x as LadderState).window)
      const r = raw as Ladders | null
      return r && ok(r.zaehlen) && ok(r.rechnen) ? { zaehlen: r.zaehlen, rechnen: r.rechnen } : null
    } catch {
      return null
    }
  }

  function show(next: Ladders) {
    ladders.value = next
    try {
      store().setItem(`${key}.ladders`, JSON.stringify(next))
    } catch {
      // Not kept: the server has them
    }
  }

  function readWaiting(at: string): SchoolResultsIn[] {
    try {
      const raw: unknown = JSON.parse(store().getItem(at) ?? '[]')
      // Anything broken by hand or by an older page is left out, so it can't stop the rest
      return (Array.isArray(raw) ? raw : []).filter((x): x is SchoolResultsIn =>
        typeof x === 'object' && x !== null && typeof x.key === 'string'
        && LADDERS.every(l => typeof x[l] === 'object' && x[l] !== null && typeof x[l].step === 'number'
          && Array.isArray(x[l].results) && x[l].results.every((r: unknown) => typeof r === 'boolean')))
    } catch {
      return []
    }
  }

  function writeWaiting(at: string, items: SchoolResultsIn[]) {
    try {
      if (items.length) store().setItem(at, JSON.stringify(items))
      else store().removeItem(at)
    } catch {
      // Not kept: it still counts while the page stays open
    }
  }

  /**
   * The server's ladders (answer number `n`), with what still waits on this device laid over them. What the server
   * names as had is let go, even when the answer to sending it was lost.
   */
  function take(state: SchoolState, n: number) {
    if (n < taken) return
    taken = n
    const seen = new Set(state.seen)
    const waiting = readWaiting(key)
    const left = waiting.filter(x => !seen.has(x.key))
    if (left.length !== waiting.length) writeWaiting(key, left)
    show(left.reduce(lay, { zaehlen: state.zaehlen, rechnen: state.rechnen }))
  }

  const refused = (e: unknown) => e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 403

  /** Sends one visit's answers: the server's answer and its number, 'refused' (let go) or 'away' (it waits) */
  async function send(server: Api, owner: string, item: SchoolResultsIn): Promise<{ state: SchoolState; n: number } | 'refused' | 'away'> {
    const n = ++issued
    flying.add(item.key)
    try {
      const state = await server.schoolResults(item)
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

  /** Sends what waited, then takes the server's ladders */
  async function load(): Promise<void> {
    if (!api) return
    const server = api
    const owner = key
    const gen = generation
    try {
      for (const item of readWaiting(owner).filter(x => !flying.has(x.key))) {
        // One the server refuses is let go; the rest still go
        if ((await send(server, owner, item)) === 'away') throw new Error('away')
      }
      const n = ++issued
      const state = await server.school()
      if (gen === generation) take(state, n)
    } catch {
      // The School asks at the steps known here
    }
  }

  /**
   * A visit is over: its answers move her steps at once and go to the server (or wait here until it is back). `personId`:
   * the child who started the visit; if someone else plays now, the answers wait for her.
   */
  function record(results: VisitResults, steps: Record<Ladder, number>, personId: number | null = who.value) {
    if (results.length === 0) return
    const item: SchoolResultsIn = {
      key: newKey(),
      zaehlen: { step: steps.zaehlen, results: results.filter(r => r.ladder === 'zaehlen').map(r => r.firstTry) },
      rechnen: { step: steps.rechnen, results: results.filter(r => r.ladder === 'rechnen').map(r => r.firstTry) },
    }
    const owner = personId === null ? key : `brightville.school.${personId}`
    writeWaiting(owner, [...readWaiting(owner), item])
    if (owner !== key) return
    show(lay(ladders.value, item))
    if (!api) return
    const gen = generation
    void send(api, owner, item).then(answer => {
      if (typeof answer === 'object' && gen === generation) take(answer.state, answer.n)
    })
  }

  return { ladders, who, init, load, record }
})
