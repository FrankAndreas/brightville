import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { SaveData } from '@/core/save'
import type { SaveStore } from '@/services/storage'
import { usePlayerStore } from './player'

function fakeStore(start: Partial<SaveData> = {}): SaveStore & { saved: SaveData[] } {
  const saved: SaveData[] = []
  return {
    saved,
    load: () => ({ version: 2, stars: 0, day: '', visits: 0, ...start }),
    save: d => void saved.push({ ...d }),
  }
}

/** A clock the test can move */
function clock(start = new Date(2026, 10, 12, 16, 0)) {
  let now = start
  return { now: () => now, set: (d: Date) => { now = d } }
}

describe('player store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('starts from the store and saves each award', () => {
    const store = fakeStore({ stars: 5 })
    const player = usePlayerStore()
    player.init(store, clock().now)
    expect(player.stars).toBe(5)
    player.award(3)
    expect(player.stars).toBe(8)
    expect(store.saved.at(-1)).toMatchObject({ version: 2, stars: 8 })
  })

  it.each([0, -1, 1.5, NaN, Infinity])('ignores award(%s)', count => {
    const store = fakeStore({ stars: 5 })
    const player = usePlayerStore()
    player.init(store, clock().now)
    player.award(count)
    expect(player.stars).toBe(5)
    expect(store.saved).toEqual([])
  })

  it('counts stars without a store, just does not save', () => {
    const player = usePlayerStore()
    expect(() => player.award(2)).not.toThrow()
    expect(player.stars).toBe(2)
  })

  it('recordVisit counts today and reports reaching the goal once', () => {
    const store = fakeStore()
    const player = usePlayerStore()
    player.init(store, clock().now)
    expect(player.goalReached).toBe(false)
    expect(player.recordVisit()).toBe(false)
    expect(player.visitsToday).toBe(1)
    expect(player.recordVisit()).toBe(true)
    expect(player.goalReached).toBe(true)
    expect(player.recordVisit()).toBe(false)
    expect(store.saved.at(-1)).toMatchObject({ day: '2026-11-12', visits: 3 })
  })

  it('picks up the visits of today from the save', () => {
    const player = usePlayerStore()
    player.init(fakeStore({ day: '2026-11-12', visits: 2 }), clock().now)
    expect(player.visitsToday).toBe(2)
    expect(player.goalReached).toBe(true)
  })

  it('starts the day empty when the save is from another day', () => {
    const player = usePlayerStore()
    player.init(fakeStore({ stars: 9, day: '2026-11-11', visits: 2 }), clock().now)
    expect(player.visitsToday).toBe(0)
    expect(player.stars).toBe(9)
  })

  it('forgets the visits of yesterday on a new day but keeps the stars', () => {
    const time = clock()
    const player = usePlayerStore()
    player.init(fakeStore({ stars: 4 }), time.now)
    player.recordVisit()
    player.recordVisit()
    time.set(new Date(2026, 10, 13, 7, 0))
    player.refreshDay()
    expect(player.visitsToday).toBe(0)
    expect(player.goalReached).toBe(false)
    expect(player.stars).toBe(4)
    expect(player.recordVisit()).toBe(false)
    expect(player.visitsToday).toBe(1)
  })

  it('spend removes exactly the cost and saves', () => {
    const store = fakeStore({ stars: 3 })
    const player = usePlayerStore()
    player.init(store, clock().now)
    expect(player.spend(3)).toBe(true)
    expect(player.stars).toBe(0)
    expect(store.saved.at(-1)).toMatchObject({ stars: 0 })
  })

  it.each([[2, 3], [5, 0], [5, -1], [5, 1.5], [5, NaN]])('spend refuses with %s stars and cost %s', (stars, cost) => {
    const store = fakeStore({ stars })
    const player = usePlayerStore()
    player.init(store, clock().now)
    expect(player.spend(cost)).toBe(false)
    expect(player.stars).toBe(stars)
    expect(store.saved).toEqual([])
  })
})
