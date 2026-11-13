import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { DEFAULT_LOOK, type Look } from '@/core/look'
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
