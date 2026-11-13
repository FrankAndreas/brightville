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
  /** What the character is built from: the orange blob until she chose a look */
  const dress = computed<Dress>(() => ({ look: look.value ?? DEFAULT_LOOK, worn: { ...worn.value } }))

  let api: Api | null = null
  let storage: Storage | undefined
  let key = ''

  function init(server: Api, personId: number, store?: Storage) {
    api = server
    storage = store
    key = `brightville.wardrobe.${personId}`
    look.value = null
    worn.value = {}
    owned.value = []
    boughtToday.value = false
    loaded.value = false
  }

  function take(state: WardrobeState) {
    look.value = isLook(state.look) ? state.look : null
    worn.value = { ...state.worn }
    owned.value = state.owned
    boughtToday.value = state.bought_today
    loaded.value = true
  }

  function readWaiting(): Waiting {
    try {
      const raw: unknown = JSON.parse((storage ?? window.localStorage).getItem(key) ?? '{}')
      return typeof raw === 'object' && raw !== null ? (raw as Waiting) : {}
    } catch {
      return {}
    }
  }

  function writeWaiting(next: Waiting) {
    try {
      const store = storage ?? window.localStorage
      if (next.look || (next.worn && Object.keys(next.worn).length)) store.setItem(key, JSON.stringify(next))
      else store.removeItem(key)
    } catch {
      // Not kept: it still shows while the page stays open
    }
  }

  /** Asks the server, sending first what waited here */
  async function load(): Promise<void> {
    if (!api) return
    const owner = key
    const server = api
    try {
      const waiting = readWaiting()
      if (waiting.look) await server.saveLook(waiting.look)
      if (waiting.worn && Object.keys(waiting.worn).length) await server.setWorn(waiting.worn)
      if (owner !== key) return
      writeWaiting({})
      const state = await server.wardrobe()
      if (owner !== key) return
      take(state)
    } catch {
      if (owner === key) loaded.value = true
    }
  }

  async function saveLook(next: Look): Promise<void> {
    look.value = next
    const owner = key
    try {
      const state = await api!.saveLook(next)
      if (owner === key) take(state)
    } catch {
      if (owner === key) writeWaiting({ ...readWaiting(), look: next })
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
      if (owner === key) take(state)
    } catch {
      if (owner === key) {
        const waiting = readWaiting()
        writeWaiting({ ...waiting, worn: { ...(waiting.worn ?? {}), [place]: id } })
      }
    }
  }

  async function buy(item: string): Promise<BuyResult> {
    if (!api) return 'offline'
    const owner = key
    try {
      const answer = await api.buy(item, newKey())
      if (owner !== key) return 'offline'
      usePlayerStore().applyState(answer.state)
      take(answer.wardrobe)
      return 'ok'
    } catch (e) {
      if (e instanceof ApiError && e.code !== 'offline' && e.status !== 0) return e.code as BuyResult
      return 'offline'
    }
  }

  return { look, worn, owned, boughtToday, loaded, dress, init, load, saveLook, wear, buy }
})
