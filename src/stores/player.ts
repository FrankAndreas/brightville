import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ApiError, type Api, type ServerState } from '@/services/api'

/** Why a round of play can't start: the server's reasons, or no answer from it */
export type BuyResult = 'ok' | 'locked' | 'poor' | 'time_up' | 'offline'

interface PendingVisit {
  building: string
  stars: number
  key: string
}

const newKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

/**
 * The Stars and today's numbers of whoever is playing. The server keeps them and decides; this store shows them.
 * Earned Stars show at once and are never lost: a visit the server didn't get waits in the browser and is sent again.
 */
export const usePlayerStore = defineStore('player', () => {
  const stars = ref(0)
  const visitsToday = ref(0)
  const dailyGoal = ref(2)
  const playSeconds = ref(0)
  /** Minutes of play per day; null for no limit */
  const playMinutes = ref<number | null>(null)
  /** True once the server has answered */
  const loaded = ref(false)
  /** Earning visits the server doesn't know about yet */
  const waiting = ref<PendingVisit[]>([])

  let api: Api | null = null
  let storage: Storage | undefined
  let outboxKey = ''
  let flushing: Promise<void> | null = null

  const goalReached = computed(() => visitsToday.value >= dailyGoal.value)
  const timeUp = computed(() => playMinutes.value !== null && playSeconds.value >= playMinutes.value * 60)
  const pending = computed(() => waiting.value.length)

  function apply(state: ServerState) {
    stars.value = state.stars
    visitsToday.value = state.visits
    dailyGoal.value = state.daily_goal
    playSeconds.value = state.play_seconds
    playMinutes.value = state.play_minutes
    loaded.value = true
    // What still waits is not in the server's numbers yet
    for (const visit of waiting.value) addLocally(visit.stars)
  }

  function addLocally(count: number) {
    stars.value += count
    visitsToday.value += 1
  }

  function readOutbox(): PendingVisit[] {
    try {
      const raw: unknown = JSON.parse((storage ?? window.localStorage).getItem(outboxKey) ?? '[]')
      if (!Array.isArray(raw)) return []
      return raw.filter((v): v is PendingVisit =>
        typeof v?.building === 'string' && Number.isInteger(v?.stars) && v.stars > 0 && typeof v?.key === 'string')
    } catch {
      return []
    }
  }

  function writeOutbox() {
    try {
      (storage ?? window.localStorage).setItem(outboxKey, JSON.stringify(waiting.value))
    } catch {
      // Storage full or blocked: the visit still waits for as long as the page stays open
    }
  }

  /** `personId` keeps one child's waiting visits apart from another's on the same device. */
  function init(server: Api, personId: number, store?: Storage) {
    api = server
    storage = store
    outboxKey = `brightville.outbox.${personId}`
    waiting.value = readOutbox()
    loaded.value = false
  }

  /** Sends what waits, oldest first. Stops at the first one the server can't be reached for. */
  function flush(): Promise<void> {
    flushing ??= sendWaiting().finally(() => { flushing = null })
    return flushing
  }

  async function sendWaiting() {
    while (api && waiting.value.length > 0) {
      const visit = waiting.value[0]
      try {
        const answer = await api.visit(visit.building, visit.stars, visit.key)
        waiting.value = waiting.value.slice(1)
        writeOutbox()
        apply(answer.state)
      } catch (e) {
        // The server will never take this one (a building that no longer exists): let it go
        const refused = e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 403
        if (!refused) return
        waiting.value = waiting.value.slice(1)
        writeOutbox()
      }
    }
  }

  /** Asks the server again: after time has passed, a building was left, or the connection came back. */
  async function refresh() {
    if (!api) return
    await flush()
    try {
      apply(await api.state())
    } catch {
      // Keep showing what we have; the next refresh tries again
    }
  }

  /**
   * An earning visit. The Stars show at once; resolves to whether this visit reached today's goal.
   * Only positive whole numbers count.
   */
  async function earn(building: string, count: number): Promise<boolean> {
    if (!Number.isInteger(count) || count <= 0) return false
    const before = goalReached.value
    waiting.value = [...waiting.value, { building, stars: count, key: newKey() }]
    writeOutbox()
    addLocally(count)
    const reachedNow = !before && goalReached.value
    await flush()
    return reachedNow
  }

  /** Asks the server for a round of play. Nothing is taken unless it says yes. */
  async function buy(building: string): Promise<BuyResult> {
    if (!api) return 'offline'
    try {
      apply((await api.play(building, newKey())).state)
      return 'ok'
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'offline'
      if (code === 'locked' || code === 'poor' || code === 'time_up') {
        // The server knows better (a new day, a parent's change): show what it knows before saying why
        await refresh()
        return code
      }
      return 'offline'
    }
  }

  /** Tells the server how long was played. A lost report is the child's gain. */
  async function reportPlayTime(seconds: number): Promise<void> {
    const whole = Math.round(seconds)
    if (!api || whole <= 0) return
    try {
      apply(await api.playTime(Math.min(whole, 3600)))
    } catch {
      // not worth a retry
    }
  }

  return {
    stars, visitsToday, dailyGoal, playSeconds, playMinutes, goalReached, timeUp, loaded, pending,
    init, refresh, earn, buy, reportPlayTime,
  }
})
