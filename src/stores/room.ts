import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { furnitureDef, type Spot } from '@/core/furniture'
import { ApiError, type Api, type RoomState } from '@/services/api'
import { usePlayerStore } from './player'
import { useWardrobeStore, type BuyResult } from './wardrobe'

/** Placements made while the server was away, sent with the next load */
interface Waiting {
  placed?: Partial<Record<Spot, string | null>>
}

const newKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

/** How long the game waits for the room before it goes on without it (the next refresh asks again) */
const PATIENCE_MS = 5000

/**
 * Her room (stage 8), kept by the server: her furniture and what stands on each spot. Placing shows at once and waits
 * on the device while the server is away, as the wardrobe does; buying needs the server. One purchase a day counts
 * across both shops, so a purchase here tells the wardrobe store, and the other way round.
 */
export const useRoomStore = defineStore('room', () => {
  const stored = ref<Partial<Record<Spot, string>>>({})
  const owned = ref<RoomState['owned']>([])
  const boughtToday = ref(false)
  const loaded = ref(false)
  /** The server answered at least once: only then are pieces she doesn't own left out */
  const known = ref(false)
  /** What stands where: known pieces on their own spot, and (once known) only hers */
  const placed = computed<Partial<Record<Spot, string>>>(() => {
    const mine = new Set(owned.value.map(o => o.id))
    return Object.fromEntries(Object.entries(stored.value).filter(([spot, id]) =>
      id && furnitureDef(id)?.spot === spot && (!known.value || mine.has(id))))
  })

  let api: Api | null = null
  let storage: Storage | undefined
  let key = ''
  /** Counts answers from changes, so a load that left before one can't undo it */
  let changes = 0
  /** A purchase whose answer never came keeps its key for the day: sent again, it buys once */
  const unanswered = new Map<string, { key: string; day: string }>()

  function init(server: Api, personId: number, store?: Storage) {
    api = server
    storage = store
    key = `brightville.room.${personId}`
    stored.value = {}
    owned.value = []
    boughtToday.value = false
    loaded.value = false
    known.value = false
    unanswered.clear()
  }

  function readWaiting(at: string): Waiting {
    try {
      const raw: unknown = JSON.parse((storage ?? window.localStorage).getItem(at) ?? '{}')
      if (typeof raw !== 'object' || raw === null) return {}
      const w = raw as Waiting
      return { placed: typeof w.placed === 'object' && w.placed ? w.placed : undefined }
    } catch {
      return {}
    }
  }

  function writeWaiting(at: string, next: Waiting) {
    try {
      const store = storage ?? window.localStorage
      if (next.placed && Object.keys(next.placed).length) store.setItem(at, JSON.stringify(next))
      else store.removeItem(at)
    } catch {
      // Not kept: it still shows while the page stays open
    }
  }

  /** The server's room, with what still waits on this device laid over it */
  function overlay(placed: Partial<Record<Spot, string>>): Partial<Record<Spot, string>> {
    const next = { ...placed }
    for (const [spot, id] of Object.entries(readWaiting(key).placed ?? {}) as [Spot, string | null][]) {
      if (id === null) delete next[spot]
      else next[spot] = id
    }
    return next
  }

  function take(state: RoomState) {
    stored.value = overlay(state.placed)
    owned.value = state.owned
    boughtToday.value = state.bought_today
    loaded.value = true
    known.value = true
  }

  /** Takes what was sent out of what waits, leaving any change made meanwhile */
  function sent(at: string, done: Partial<Record<Spot, string | null>>) {
    const rest = { ...(readWaiting(at).placed ?? {}) }
    for (const [spot, id] of Object.entries(done) as [Spot, string | null][]) if (rest[spot] === id) delete rest[spot]
    writeWaiting(at, { placed: rest })
  }

  const refused = (e: unknown) => e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 403

  async function load(): Promise<void> {
    if (!api) return
    const owner = key
    const server = api
    const patience = setTimeout(() => { if (owner === key) loaded.value = true }, PATIENCE_MS)
    try {
      const waiting = readWaiting(owner).placed
      if (waiting && Object.keys(waiting).length) {
        try {
          await server.setPlaced(waiting)
        } catch (e) {
          if (!refused(e)) throw e
        }
        sent(owner, waiting)
      }
      if (owner !== key) return
      const before = changes
      const state = await server.room()
      if (owner !== key || changes !== before) return
      take(state)
    } catch {
      // Not an empty room: the house shows what is known here, with what waits on the device, and the next refresh
      // asks again
      if (owner === key) {
        stored.value = overlay(stored.value)
        loaded.value = true
      }
    } finally {
      clearTimeout(patience)
    }
  }

  /** Puts a piece on its spot, or (null) takes it away */
  async function place(spot: Spot, id: string | null): Promise<void> {
    const next = { ...stored.value }
    if (id === null) delete next[spot]
    else next[spot] = id
    stored.value = next
    const owner = key
    // Waits on the device until the server has it: an answer to an earlier placement then keeps this one on screen,
    // and if the server is away it is kept for the child who placed it, even if the device changes hands meanwhile
    writeWaiting(owner, { placed: { ...(readWaiting(owner).placed ?? {}), [spot]: id } })
    try {
      const state = await api!.setPlaced({ [spot]: id })
      changes += 1
      sent(owner, { [spot]: id })
      if (owner !== key) return
      take(state)
    } catch (e) {
      // Refused for good: let it go (the next load takes the server's room)
      if (refused(e)) sent(owner, { [spot]: id })
    }
  }

  async function buy(item: string): Promise<BuyResult> {
    if (!api) return 'offline'
    const owner = key
    const day = usePlayerStore().day
    const kept = unanswered.get(item)
    const buyKey = kept && kept.day === day ? kept.key : newKey()
    unanswered.set(item, { key: buyKey, day })
    try {
      const answer = await api.buyFurniture(item, buyKey)
      unanswered.delete(item)
      changes += 1
      if (owner !== key) return 'offline'
      usePlayerStore().applyState(answer.state)
      take(answer.room)
      // One purchase a day across both shops
      useWardrobeStore().boughtToday = true
      return 'ok'
    } catch (e) {
      if (e instanceof ApiError && e.code !== 'offline' && e.status !== 0) {
        unanswered.delete(item)
        return e.code as BuyResult
      }
      return 'offline'
    }
  }

  return { placed, owned, boughtToday, loaded, known, init, load, place, buy }
})
