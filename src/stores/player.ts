import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ApiError, type Api, type Film, type ServerState, type StickerRow } from '@/services/api'

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
  /** The Cinema's films, the same for everyone */
  const films = ref<Film[]>([])
  /** Earning visits the server doesn't know about yet */
  const waiting = ref<PendingVisit[]>([])
  /** The server's day, as of its last answer */
  const day = ref('')
  /** The stickers this person has */
  const stickers = ref<StickerRow[]>([])
  /** New stickers to celebrate in the town, oldest first */
  const toCelebrate = ref<string[]>([])
  /** Stickers queued once already: each is celebrated at most once per visit to the game */
  const announced = new Set<string>()

  let api: Api | null = null
  let storage: Storage | undefined
  let outboxKey = ''
  let flushing: Promise<void> | null = null
  let loginLost: () => void = () => {}
  /**
   * The round asked for at a door whose answer never came. Asking again with the same key either finds it bought
   * (no second charge) or buys it now; a key from another day buys nothing.
   */
  const unanswered = new Map<string, { key: string; day: string }>()

  /** A 401 or 403: the login ended or access was taken away, which the page must show rather than retry for ever */
  function checkLogin(e: unknown): boolean {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      loginLost()
      return true
    }
    return false
  }

  const goalReached = computed(() => visitsToday.value >= dailyGoal.value)
  const timeUp = computed(() => playMinutes.value !== null && playSeconds.value >= playMinutes.value * 60)
  const pending = computed(() => waiting.value.length)
  /** Stickers the child hasn't seen yet: the album glows */
  const unseen = computed(() => stickers.value.filter(s => !s.seen).map(s => s.id))

  /** Takes the server's list of stickers; the new ones, not yet seen, are queued for celebrating */
  function takeStickers(rows: StickerRow[]) {
    stickers.value = rows
    for (const s of rows) {
      if (s.seen || announced.has(s.id)) continue
      announced.add(s.id)
      toCelebrate.value = [...toCelebrate.value, s.id]
    }
  }

  /** Stickers a visit just earned */
  function earned(ids: string[] | undefined) {
    const fresh = (ids ?? []).filter(id => !stickers.value.some(s => s.id === id))
    if (fresh.length === 0) return
    const at = new Date().toISOString()
    takeStickers([...stickers.value, ...fresh.map(id => ({ id, earned_at: at, seen: false }))])
  }

  function apply(state: ServerState) {
    stars.value = state.stars
    visitsToday.value = state.visits
    dailyGoal.value = state.daily_goal
    playSeconds.value = state.play_seconds
    playMinutes.value = state.play_minutes
    day.value = state.day
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

  /**
   * `personId` keeps one child's waiting visits apart from another's on the same device. `onLoginLost` is called
   * when the server no longer takes the login.
   */
  function init(server: Api, personId: number, store?: Storage, onLoginLost: () => void = () => {}) {
    api = server
    storage = store
    outboxKey = `brightville.outbox.${personId}`
    waiting.value = readOutbox()
    loaded.value = false
    loginLost = onLoginLost
    unanswered.clear()
    stickers.value = []
    toCelebrate.value = []
    announced.clear()
    // A send still under way belongs to the person before; it checks and stops by itself
    flushing = null
  }

  let retryTimer: ReturnType<typeof setTimeout> | undefined

  /** Sends what waits again after `seconds`, once, for the person playing then */
  function retryLater(seconds: number) {
    clearTimeout(retryTimer)
    const owner = outboxKey
    retryTimer = setTimeout(() => {
      if (owner === outboxKey) void flush()
    }, Math.max(1, seconds) * 1000)
  }

  /** Sends what waits, oldest first. Stops at the first one the server can't be reached for. */
  function flush(): Promise<void> {
    flushing ??= sendWaiting().finally(() => { flushing = null })
    return flushing
  }

  async function sendWaiting() {
    // The person whose visits these are: the device may change hands while a request is under way
    const owner = outboxKey
    while (api && owner === outboxKey && waiting.value.length > 0) {
      const visit = waiting.value[0]
      try {
        const answer = await api.visit(visit.building, visit.stars, visit.key)
        if (owner !== outboxKey) return
        waiting.value = waiting.value.slice(1)
        writeOutbox()
        apply(answer.state)
        earned(answer.stickers)
      } catch (e) {
        if (owner !== outboxKey || checkLogin(e)) return
        // Sooner than its Stars can be earned (the server's cool-down): it waits here, shown, and goes again then
        if (e instanceof ApiError && e.code === 'too_soon') {
          retryLater(e.retryAfter ?? 60)
          return
        }
        // The server will never take this one (a building that no longer exists): let it go. Anything else,
        // an error page from a proxy included, may pass: keep it
        const refused = e instanceof ApiError && (e.code === 'unknown_building' || e.code === 'wrong_kind')
        if (!refused) return
        waiting.value = waiting.value.slice(1)
        writeOutbox()
      }
    }
  }

  /** Asks the server again: after time has passed, a building was left, or the connection came back. */
  async function refresh() {
    if (!api) return
    // The person asked for: the device may change hands while the answers are under way
    const owner = outboxKey
    await flush()
    if (owner !== outboxKey) return
    const [state, filmList, stickerRows] = await Promise.allSettled([api.state(), api.films(), api.stickers()])
    if (owner !== outboxKey) return
    // What fails keeps showing what we have; the next refresh tries again
    if (state.status === 'fulfilled') apply(state.value)
    else checkLogin(state.reason)
    if (filmList.status === 'fulfilled') films.value = filmList.value
    if (stickerRows.status === 'fulfilled') takeStickers(stickerRows.value)
  }

  /** A visit to Malen or Ausmalen, for the logbook and the stickers. Lost when the server can't be reached. */
  async function visitFree(building: string): Promise<void> {
    if (!api) return
    const owner = outboxKey
    try {
      const answer = await api.freeVisit(building, newKey())
      if (owner === outboxKey) earned(answer.stickers)
    } catch (e) {
      if (owner === outboxKey) checkLogin(e)
    }
  }

  /** The town showed these: they are seen. Any others left in the queue wait in the album as new. */
  async function celebrated(ids: string[]): Promise<void> {
    toCelebrate.value = []
    await markSeen(ids)
  }

  /** The album was opened: every sticker in it has been seen */
  async function sawAll(): Promise<void> {
    await markSeen(unseen.value)
  }

  async function markSeen(ids: string[]) {
    if (ids.length === 0) return
    stickers.value = stickers.value.map(s => (ids.includes(s.id) ? { ...s, seen: true } : s))
    // Seen in the album: the town doesn't celebrate them again afterwards
    toCelebrate.value = toCelebrate.value.filter(id => !ids.includes(id))
    try {
      await api?.stickersSeen(ids)
    } catch (e) {
      // Shown as new again next time at worst
      checkLogin(e)
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
    const kept = unanswered.get(building)
    const key = kept && kept.day === day.value ? kept.key : newKey()
    unanswered.set(building, { key, day: day.value })
    try {
      apply((await api.play(building, key)).state)
      unanswered.delete(building)
      return 'ok'
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'offline'
      if (code === 'locked' || code === 'poor' || code === 'time_up') {
        unanswered.delete(building)
        // The server knows better (a new day, a parent's change): show what it knows before saying why
        await refresh()
        return code
      }
      if (!checkLogin(e)) void refresh()
      return 'offline'
    }
  }

  /** Tells the server how long was played. A lost report is the child's gain. */
  async function reportPlayTime(seconds: number): Promise<void> {
    const whole = Math.round(seconds)
    if (!api || whole <= 0) return
    try {
      apply(await api.playTime(Math.min(whole, 3600)))
    } catch (e) {
      // not worth a retry
      checkLogin(e)
    }
  }

  return {
    stars, visitsToday, dailyGoal, playSeconds, playMinutes, goalReached, timeUp, loaded, pending,
    films, init, refresh, earn, buy, reportPlayTime,
    stickers, toCelebrate, unseen, visitFree, celebrated, sawAll,
  }
})
