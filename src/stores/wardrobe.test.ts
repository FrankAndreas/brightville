import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { DEFAULT_LOOK, type Look } from '@/core/look'
import { ApiError, type WardrobeState } from '@/services/api'
import { fakeApi, type FakeApi } from '@/services/fakeApi'
import { usePlayerStore } from './player'
import { useWardrobeStore } from './wardrobe'

function memory(): Storage {
  const data = new Map<string, string>()
  return {
    getItem: k => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: k => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() { return data.size },
  }
}

const BLUE: Look = { body: '#4f8fe8', hair: 'buns', hairColor: '#222222', glasses: 'round' }

describe('wardrobe store', () => {
  let api: FakeApi
  let storage: Storage
  const open = async (personId = 1) => {
    const player = usePlayerStore()
    player.init(api, personId, storage)
    await player.refresh()
    const wardrobe = useWardrobeStore()
    wardrobe.init(api, personId, storage)
    await wardrobe.load()
    return { wardrobe, player }
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    api = fakeApi({ stars: 40, visits: 2 })
    storage = memory()
  })

  it('takes the server\'s wardrobe, and shows the orange blob until a look is saved', async () => {
    api.wardrobe_.look = null
    const { wardrobe } = await open()
    expect(wardrobe.loaded).toBe(true)
    expect(wardrobe.look).toBeNull()
    expect(wardrobe.dress).toEqual({ look: DEFAULT_LOOK, worn: {} })
    await wardrobe.saveLook(BLUE)
    expect(wardrobe.dress.look).toEqual(BLUE)
    expect(api.wardrobe_.look).toEqual(BLUE)
  })

  it('puts something on at once, even while the server is away, and sends it later', async () => {
    const { wardrobe } = await open()
    api.wardrobe_.owned = [{ id: 'krone', how: 'bought', got_at: '2026-11-12T10:00:00+01:00' }]
    await wardrobe.load()
    api.offline = true
    await wardrobe.wear('head', 'krone')
    expect(wardrobe.dress.worn).toEqual({ head: 'krone' })
    api.offline = false
    await wardrobe.load()
    expect(api.calls).toContain('setWorn {"head":"krone"}')
    expect(api.wardrobe_.worn).toEqual({ head: 'krone' })
  })

  it('buys: Stars from the server, the add-on owned and worn; then nothing more today', async () => {
    const { wardrobe, player } = await open()
    expect(await wardrobe.buy('schal')).toBe('ok')
    expect(player.stars).toBe(20)
    expect(wardrobe.owned.map(o => o.id)).toEqual(['schal'])
    expect(wardrobe.dress.worn).toEqual({ neck: 'schal' })
    expect(wardrobe.boughtToday).toBe(true)
    expect(await wardrobe.buy('kappe')).toBe('bought_today')
  })

  it('answers why a purchase is refused, and never buys without the server', async () => {
    api = fakeApi({ stars: 5, visits: 2 })
    const { wardrobe } = await open()
    expect(await wardrobe.buy('schal')).toBe('poor')
    api.offline = true
    expect(await wardrobe.buy('schleife')).toBe('offline')
    expect(wardrobe.owned).toEqual([])
  })

  it('never takes a failed answer for "no look yet": only the server saying so counts', async () => {
    api.wardrobe_.look = BLUE
    api.offline = true
    const { wardrobe } = await open()
    expect(wardrobe.known).toBe(false)
    api.offline = false
    await wardrobe.load()
    expect(wardrobe.known).toBe(true)
    expect(wardrobe.look).toEqual(BLUE)
  })

  it('keeps what still waits on the device over a later answer from the server', async () => {
    api.wardrobe_.owned = [
      { id: 'krone', how: 'bought', got_at: '2026-11-12T10:00:00+01:00' },
      { id: 'schal', how: 'bought', got_at: '2026-11-12T10:00:00+01:00' },
    ]
    const { wardrobe } = await open()
    api.offline = true
    await wardrobe.wear('head', 'krone')
    api.offline = false
    // Another change gets through; the crown, still waiting, stays on
    await wardrobe.wear('neck', 'schal')
    expect(wardrobe.dress.worn).toEqual({ head: 'krone', neck: 'schal' })
    await wardrobe.load()
    expect(api.wardrobe_.worn).toEqual({ head: 'krone', neck: 'schal' })
  })

  it('drops a waiting change the server refuses for good, and loads anyway', async () => {
    storage.setItem('brightville.wardrobe.1', JSON.stringify({ worn: { head: 'krone' } }))
    api.setWorn = () => Promise.reject(new ApiError(422, 'bad'))
    const { wardrobe } = await open()
    expect(wardrobe.known).toBe(true)
    expect(storage.getItem('brightville.wardrobe.1')).toBeNull()
  })

  it('keeps an offline change with the child who made it, when the device changes hands meanwhile', async () => {
    const { wardrobe } = await open(1)
    api.wardrobe_.owned = [{ id: 'krone', how: 'bought', got_at: '2026-11-12T10:00:00+01:00' }]
    api.setWorn = () => new Promise((_, reject) => setTimeout(() => reject(new ApiError(0, 'offline')), 5))
    const pending = wardrobe.wear('head', 'krone')
    wardrobe.init(api, 2, storage)
    await pending
    expect(JSON.parse(storage.getItem('brightville.wardrobe.1')!)).toEqual({ worn: { head: 'krone' } })
  })

  it('clears only what it sent, not a change made while it was sending', async () => {
    storage.setItem('brightville.wardrobe.1', JSON.stringify({ worn: { head: 'krone' } }))
    const send = api.setWorn
    api.setWorn = async worn => {
      // Meanwhile, another change waits
      storage.setItem('brightville.wardrobe.1', JSON.stringify({ worn: { head: 'krone', neck: 'schal' } }))
      return send(worn)
    }
    await open()
    expect(JSON.parse(storage.getItem('brightville.wardrobe.1')!)).toEqual({ worn: { neck: 'schal' } })
  })

  it('shows only what she owns on her character', async () => {
    api.wardrobe_.worn = { head: 'krone' }
    const { wardrobe } = await open()
    expect(wardrobe.dress.worn).toEqual({})
  })

  it('does not keep the game waiting when the wardrobe never answers', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      api.wardrobe = () => new Promise(() => {})
      const wardrobe = useWardrobeStore()
      wardrobe.init(api, 1, storage)
      void wardrobe.load()
      await vi.advanceTimersByTimeAsync(5000)
      expect(wardrobe.loaded).toBe(true)
      expect(wardrobe.known).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not let an answer that left before a purchase undo it', async () => {
    const { wardrobe } = await open()
    let answerStale: (s: WardrobeState) => void = () => {}
    const stale = { ...api.wardrobe_, owned: [] }
    api.wardrobe = () => new Promise(resolve => { answerStale = resolve })
    const loading = wardrobe.load()
    expect(await wardrobe.buy('schal')).toBe('ok')
    answerStale(stale)
    await loading
    expect(wardrobe.owned.map(o => o.id)).toEqual(['schal'])
  })

  it('drops an answer that arrives after the device changed hands', async () => {
    api.wardrobe_.look = null
    const { wardrobe } = await open(1)
    api.wardrobe_.look = BLUE
    const late = wardrobe.load()
    wardrobe.init(api, 2, storage)
    await late
    expect(wardrobe.look).toBeNull()
  })
})
