import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { DEFAULT_LOOK, isLook, type Dress, type Look } from '@/core/look'
import type { Place } from '@/core/outfits'
import { ApiError, type Api, type WardrobeState } from '@/services/api'
import { usePlayerStore } from './player'

/** Why a purchase didn't happen: the server's code, or 'offline' (nothing was taken) */
export type BuyResult = 'ok' | 'offline' | 'locked' | 'bought_today' | 'shelf_locked' | 'owned' | 'poor' | 'not_for_sale' | 'unknown'

/** Changes made while the server was away, sent with the next load */
interface Waiting {
  look?: Look
  worn?: Partial<Record<Place, string | null>>
}

const newKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

/**
 * Her look and her add-ons (stage 7), kept by the server. Putting things on and changing the look show at once and
 * wait on the device while the server is away; buying needs the server.
 */
export const useWardrobeStore = defineStore('wardrobe', () => {
  const look = ref<Look | null>(null)
  const worn = ref<Partial<Record<Place, string>>>({})
  const owned = ref<WardrobeState['owned']>([])
  const boughtToday = ref(false)
  const loaded = ref(false)
  /** The server answered at least once: only then does a missing look mean "no look yet" (the look screen) */
  const known = ref(false)
  /**
   * What the character is built from: the orange blob until she chose a look, and only what she owns (once the
   * server said what that is)
   */
  const dress = computed<Dress>(() => {
    const mine = new Set(owned.value.map(o => o.id))
    const shown = known.value
      ? Object.fromEntries(Object.entries(worn.value).filter(([, id]) => id && mine.has(id)))
      : { ...worn.value }
    return { look: look.value ?? DEFAULT_LOOK, worn: shown }
  })

  let api: Api | null = null
  let storage: Storage | undefined
  let key = ''
  /** Counts answers from changes (a look, an add-on put on, a purchase): a load that left before one can't undo it */
  let changes = 0

  function init(server: Api, personId: number, store?: Storage) {
    api = server
    storage = store
    key = `brightville.wardrobe.${personId}`
    look.value = null
    worn.value = {}
    owned.value = []
    boughtToday.value = false
    loaded.value = false
    known.value = false
    unanswered.clear()
  }

  /** The server's state, with what still waits on this device laid over it (it is sent with the next load) */
  function take(state: WardrobeState) {
    const waiting = readWaiting(key)
    look.value = waiting.look ?? (isLook(state.look) ? state.look : null)
    const next = { ...state.worn }
    for (const [place, id] of Object.entries(waiting.worn ?? {}) as [Place, string | null][]) {
      if (id === null) delete next[place]
      else next[place] = id
    }
    worn.value = next
    owned.value = state.owned
    boughtToday.value = state.bought_today
    loaded.value = true
    known.value = true
  }

  /** What waits on the device for a person (by the storage key of the moment the change was made) */
  function readWaiting(at: string): Waiting {
    try {
      const raw: unknown = JSON.parse((storage ?? window.localStorage).getItem(at) ?? '{}')
      if (typeof raw !== 'object' || raw === null) return {}
      const w = raw as Waiting
      return { look: isLook(w.look) ? w.look : undefined, worn: typeof w.worn === 'object' && w.worn ? w.worn : undefined }
    } catch {
      return {}
    }
  }

  function writeWaiting(at: string, next: Waiting) {
    try {
      const store = storage ?? window.localStorage
      if (next.look || (next.worn && Object.keys(next.worn).length)) store.setItem(at, JSON.stringify(next))
      else store.removeItem(at)
    } catch {
      // Not kept: it still shows while the page stays open
    }
  }

  /** Takes out of what waits what has been sent, leaving anything changed meanwhile */
  function sent(at: string, done: Waiting) {
    const now = readWaiting(at)
    const look = done.look && JSON.stringify(now.look) === JSON.stringify(done.look) ? undefined : now.look
    const worn = { ...(now.worn ?? {}) }
    for (const [place, id] of Object.entries(done.worn ?? {}) as [Place, string | null][]) {
      if (worn[place] === id) delete worn[place]
    }
    writeWaiting(at, { look, worn })
  }

  /** A refusal for good (the server looked at it and said no): sending it again would never work */
  const refused = (e: unknown) => e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 403

  /** How long the game waits for the wardrobe before it starts without it (the next refresh asks again) */
  const PATIENCE_MS = 5000

  /** Asks the server, sending first what waited here */
  async function load(): Promise<void> {
    if (!api) return
    const owner = key
    const server = api
    const patience = setTimeout(() => { if (owner === key) loaded.value = true }, PATIENCE_MS)
    try {
      const waiting = readWaiting(owner)
      for (const part of [{ look: waiting.look }, { worn: waiting.worn }] as Waiting[]) {
        if (!part.look && !(part.worn && Object.keys(part.worn).length)) continue
        try {
          if (part.look) await server.saveLook(part.look)
          else await server.setWorn(part.worn!)
          sent(owner, part)
        } catch (e) {
          // Refused for good: let it go, or it blocks everything after it. Away: it waits, and so does the rest
          if (!refused(e)) throw e
          sent(owner, part)
        }
      }
      if (owner !== key) return
      const before = changes
      const state = await server.wardrobe()
      // A change answered meanwhile is newer than this answer
      if (owner !== key || changes !== before) return
      take(state)
    } catch {
      // Not "no look yet": the town shows what is known here, and the next refresh asks again
      if (owner === key) {
        const waiting = readWaiting(owner)
        if (waiting.look) look.value = waiting.look
        loaded.value = true
      }
    } finally {
      clearTimeout(patience)
    }
  }

  async function saveLook(next: Look): Promise<void> {
    look.value = next
    const owner = key
    try {
      const state = await api!.saveLook(next)
      changes += 1
      if (owner !== key) return
      // Through: an older look still waiting here is outdated
      writeWaiting(owner, { ...readWaiting(owner), look: undefined })
      take(state)
    } catch {
      // Kept for the child who chose it, even if the device changed hands meanwhile
      writeWaiting(owner, { ...readWaiting(owner), look: next })
    }
  }

  /** Puts on (an id) or takes off (null) what is in a place */
  async function wear(place: Place, id: string | null): Promise<void> {
    const next = { ...worn.value }
    if (id === null) delete next[place]
    else next[place] = id
    worn.value = next
    const owner = key
    try {
      const state = await api!.setWorn({ [place]: id })
      changes += 1
      if (owner !== key) return
      // Through: what waited for this place is outdated
      const waiting = readWaiting(owner)
      if (waiting.worn && place in waiting.worn) {
        const rest = { ...waiting.worn }
        delete rest[place]
        writeWaiting(owner, { ...waiting, worn: rest })
      }
      take(state)
    } catch {
      // Kept for the child who made it, even if the device changed hands meanwhile
      const waiting = readWaiting(owner)
      writeWaiting(owner, { ...waiting, worn: { ...(waiting.worn ?? {}), [place]: id } })
    }
  }

  /**
   * A purchase whose answer never came keeps its key for the day: sent again, the server finds it bought and charges
   * nothing twice (as the player store does for rounds of play)
   */
  const unanswered = new Map<string, { key: string; day: string }>()

  async function buy(item: string): Promise<BuyResult> {
    if (!api) return 'offline'
    const owner = key
    const day = usePlayerStore().day
    const kept = unanswered.get(item)
    const buyKey = kept && kept.day === day ? kept.key : newKey()
    unanswered.set(item, { key: buyKey, day })
    try {
      const answer = await api.buy(item, buyKey)
      unanswered.delete(item)
      changes += 1
      if (owner !== key) return 'offline'
      usePlayerStore().applyState(answer.state)
      take(answer.wardrobe)
      return 'ok'
    } catch (e) {
      if (e instanceof ApiError && e.code !== 'offline' && e.status !== 0) {
        unanswered.delete(item)
        return e.code as BuyResult
      }
      return 'offline'
    }
  }

  return { look, worn, owned, boughtToday, loaded, known, dress, init, load, saveLook, wear, buy }
})
