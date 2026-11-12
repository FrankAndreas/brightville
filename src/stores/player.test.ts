import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { SaveData } from '@/core/save'
import type { SaveStore } from '@/services/storage'
import { usePlayerStore } from './player'

function fakeStore(stars: number): SaveStore & { saved: SaveData[] } {
  const saved: SaveData[] = []
  return { saved, load: () => ({ version: 1, stars }), save: d => void saved.push({ ...d }) }
}

describe('player store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('starts from the store and saves each award', () => {
    const store = fakeStore(5)
    const player = usePlayerStore()
    player.init(store)
    expect(player.stars).toBe(5)
    player.award(3)
    expect(player.stars).toBe(8)
    expect(store.saved).toEqual([{ version: 1, stars: 8 }])
  })

  it.each([0, -1, 1.5, NaN, Infinity])('ignores award(%s)', count => {
    const store = fakeStore(5)
    const player = usePlayerStore()
    player.init(store)
    player.award(count)
    expect(player.stars).toBe(5)
    expect(store.saved).toEqual([])
  })

  it('counts stars without a store, just does not save', () => {
    const player = usePlayerStore()
    expect(() => player.award(2)).not.toThrow()
    expect(player.stars).toBe(2)
  })
})
