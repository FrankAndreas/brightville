import { ref } from 'vue'
import { defineStore } from 'pinia'
import { applyResults, startLadders, type Ladder, type Ladders } from '@/core/ladders'
import { ApiError, type Api, type SchoolResultsIn } from '@/services/api'

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

  let api: Api | null = null
  let storage: Storage | undefined
  let key = ''
  /** Results sent and not answered yet: while any is out, an answer isn't laid over what is shown */
  let out = 0
  const flying = new Set<string>()
  let generation = 0

  function init(server: Api, personId: number, store?: Storage) {
    api = server
    storage = store
    key = `brightville.school.${personId}`
    ladders.value = startLadders(false)
    out = 0
    flying.clear()
    generation++
  }

  function readWaiting(at: string): SchoolResultsIn[] {
    try {
      const raw: unknown = JSON.parse((storage ?? window.localStorage).getItem(at) ?? '[]')
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
      const store = storage ?? window.localStorage
      if (items.length) store.setItem(at, JSON.stringify(items))
      else store.removeItem(at)
    } catch {
      // Not kept: it still counts while the page stays open
    }
  }

  /** The server's ladders, with what still waits on this device laid over them */
  function take(state: Ladders) {
    ladders.value = readWaiting(key).reduce(lay, state)
  }

  const refused = (e: unknown) => e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 403

  /** Sends one visit's answers: the server's ladders, or null when it didn't answer (what was refused is let go) */
  async function send(server: Api, owner: string, gen: number, item: SchoolResultsIn): Promise<Ladders | null> {
    out++
    flying.add(item.key)
    try {
      const state = await server.schoolResults(item)
      writeWaiting(owner, readWaiting(owner).filter(x => x.key !== item.key))
      return state
    } catch (e) {
      if (refused(e)) writeWaiting(owner, readWaiting(owner).filter(x => x.key !== item.key))
      return null
    } finally {
      if (gen === generation) {
        out--
        flying.delete(item.key)
      }
    }
  }

  async function load(): Promise<void> {
    if (!api) return
    const server = api
    const owner = key
    const gen = generation
    try {
      for (const item of readWaiting(owner).filter(x => !flying.has(x.key))) {
        if ((await send(server, owner, gen, item)) === null) throw new Error('offline')
      }
      const state = await server.school()
      if (gen === generation && out === 0) take(state)
    } catch {
      // The School asks at the steps known here
    }
  }

  /** A visit is over: its answers move her steps at once and go to the server (or wait here until it is back) */
  function record(results: VisitResults, steps: Record<Ladder, number>) {
    if (results.length === 0) return
    const item: SchoolResultsIn = {
      key: newKey(),
      zaehlen: { step: steps.zaehlen, results: results.filter(r => r.ladder === 'zaehlen').map(r => r.firstTry) },
      rechnen: { step: steps.rechnen, results: results.filter(r => r.ladder === 'rechnen').map(r => r.firstTry) },
    }
    ladders.value = lay(ladders.value, item)
    const owner = key
    writeWaiting(owner, [...readWaiting(owner), item])
    if (!api) return
    const gen = generation
    void send(api, owner, gen, item).then(state => {
      if (state && gen === generation && out === 0) take(state)
    })
  }

  return { ladders, init, load, record }
})
