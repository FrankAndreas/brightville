import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { dayOf, goalReached as isGoalReached, visitsOn } from '@/core/daily'
import { SAVE_VERSION } from '@/core/save'
import type { SaveStore } from '@/services/storage'

export const usePlayerStore = defineStore('player', () => {
  const stars = ref(0)
  /** The day `visits` belongs to */
  const day = ref('')
  const visits = ref(0)
  /** Today, as of the last look at the clock */
  const today = ref(dayOf(new Date()))

  let saveStore: SaveStore | null = null
  let now: () => Date = () => new Date()

  const visitsToday = computed(() => visitsOn({ day: day.value, visits: visits.value }, today.value))
  const goalReached = computed(() => isGoalReached(visitsToday.value))

  const save = () => saveStore?.save({ version: SAVE_VERSION, stars: stars.value, day: day.value, visits: visits.value })

  function init(store: SaveStore, clock: () => Date = () => new Date()) {
    saveStore = store
    now = clock
    const loaded = store.load()
    stars.value = loaded.stars
    day.value = loaded.day
    visits.value = loaded.visits
    refreshDay()
  }

  /** Looks at the clock again; on a new day the goal starts over. */
  function refreshDay() {
    today.value = dayOf(now())
  }

  /** Adds earned Stars. Only positive whole numbers count. */
  function award(count: number) {
    if (!Number.isInteger(count) || count <= 0) return
    stars.value += count
    save()
  }

  /** Pays Stars. False, and nothing changes, when there aren't enough. */
  function spend(count: number): boolean {
    if (!Number.isInteger(count) || count <= 0 || stars.value < count) return false
    stars.value -= count
    save()
    return true
  }

  /** Counts one earning visit today. True when this visit reached the daily goal. */
  function recordVisit(): boolean {
    refreshDay()
    const before = visitsToday.value
    day.value = today.value
    visits.value = before + 1
    save()
    return !isGoalReached(before) && isGoalReached(visits.value)
  }

  return { stars, day, visits, visitsToday, goalReached, init, refreshDay, award, spend, recordVisit }
})
