import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { ApiError } from '@/services/api'
import { fakeApi, type FakeApi } from '@/services/fakeApi'
import { usePlayerStore } from './player'
import { useRoomStore } from './room'
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

const owned = (...ids: string[]) => ids.map(id => ({ id, got_at: '2026-11-12T10:00:00+01:00' }))

describe('room store', () => {
  let api: FakeApi
  let storage: Storage
  const open = async (personId = 1) => {
    const player = usePlayerStore()
    player.init(api, personId, storage)
    await player.refresh()
    const wardrobe = useWardrobeStore()
    wardrobe.init(api, personId, storage)
    await wardrobe.load()
    const room = useRoomStore()
    room.init(api, personId, storage)
    await room.load()
    return { room, wardrobe, player }
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    api = fakeApi({ stars: 100, visits: 2 })
    storage = memory()
  })

  it('takes the server\'s room', async () => {
    api.room_.owned = owned('kaktus')
    api.room_.placed = { pflanze: 'kaktus' }
    const { room } = await open()
    expect(room.known).toBe(true)
    expect(room.placed).toEqual({ pflanze: 'kaktus' })
  })

  it('places a piece at once while the server is away, and sends it later', async () => {
    api.room_.owned = owned('holzbett', 'zeltbett')
    api.room_.placed = { bett: 'zeltbett' }
    const { room } = await open()
    api.offline = true
    await room.place('bett', 'holzbett')
    expect(room.placed).toEqual({ bett: 'holzbett' })
    api.offline = false
    await room.load()
    expect(api.calls).toContain('setPlaced {"bett":"holzbett"}')
    expect(api.room_.placed).toEqual({ bett: 'holzbett' })
  })

  it('keeps a placement with the child who made it, when the device changes hands meanwhile', async () => {
    api.room_.owned = owned('kaktus')
    const { room } = await open(1)
    api.setPlaced = () => new Promise((_, reject) => setTimeout(() => reject(new ApiError(0, 'offline')), 5))
    const pending = room.place('pflanze', 'kaktus')
    room.init(api, 2, storage)
    await pending
    expect(JSON.parse(storage.getItem('brightville.room.1')!)).toEqual({ placed: { pflanze: 'kaktus' } })
  })

  it('keeps a second placement on screen when the first one\'s answer arrives before it', async () => {
    api.room_.owned = owned('holzbett', 'kaktus')
    const { room } = await open()
    const send = api.setPlaced
    const answers: (() => void)[] = []
    api.setPlaced = placed => new Promise((resolve, reject) => {
      answers.push(() => { send(placed).then(resolve, reject) })
    })
    const first = room.place('bett', 'holzbett')
    const second = room.place('pflanze', 'kaktus')
    answers[0]()
    await first
    expect(room.placed).toEqual({ bett: 'holzbett', pflanze: 'kaktus' })
    answers[1]()
    await second
    expect(room.placed).toEqual({ bett: 'holzbett', pflanze: 'kaktus' })
  })

  it('shows what waits on the device when the page opens while the server is away', async () => {
    api.room_.owned = owned('holzbett')
    const { room } = await open()
    api.offline = true
    await room.place('bett', 'holzbett')
    // The page is opened again, still without the server
    setActivePinia(createPinia())
    const again = useRoomStore()
    again.init(api, 1, storage)
    await again.load()
    expect(again.placed).toEqual({ bett: 'holzbett' })
  })

  it('takes a refused placement off the screen again', async () => {
    api.room_.owned = owned('holzbett')
    const { room } = await open()
    api.setPlaced = () => Promise.reject(new ApiError(422, 'invalid'))
    await room.place('bett', 'holzbett')
    await flushPromises()
    expect(room.placed).toEqual({})
  })

  it('doesn\'t let an answer for the child before undo the next child\'s room', async () => {
    api.room_.owned = owned('holzbett')
    const { room } = await open(1)
    const send = api.setPlaced
    let answerA = () => {}
    api.setPlaced = placed => new Promise((resolve, reject) => { answerA = () => { send(placed).then(resolve, reject) } })
    const placing = room.place('bett', 'holzbett')
    // The device passes to child 2, whose room is asked for while child 1's answer is still out
    room.init(api, 2, storage)
    const ask = api.room
    let answerB = () => {}
    api.room = () => new Promise((resolve, reject) => { answerB = () => { ask().then(resolve, reject) } })
    const loading = room.load()
    await flushPromises()
    answerA()
    await placing
    answerB()
    await loading
    expect(room.known).toBe(true)
  })

  it('draws an unknown piece as an empty spot', async () => {
    api.room_.owned = owned('kaktus')
    api.room_.placed = { pflanze: 'kaktus', bild: 'gibtsnicht' }
    const { room } = await open()
    expect(room.placed).toEqual({ pflanze: 'kaktus' })
  })

  it('buys furniture; then the wardrobe knows something was bought today', async () => {
    const { room, wardrobe, player } = await open()
    expect(await room.buy('kaktus')).toBe('ok')
    expect(room.placed).toEqual({ pflanze: 'kaktus' })
    expect(player.stars).toBe(85)
    expect(wardrobe.boughtToday).toBe(true)
    expect(await room.buy('sonnenbild')).toBe('bought_today')
  })

  it('and after a purchase in the Kleiderladen, the room knows', async () => {
    const { room, wardrobe } = await open()
    expect(await wardrobe.buy('schal')).toBe('ok')
    expect(room.boughtToday).toBe(true)
  })

  it('answers why a purchase is refused, and never buys without the server', async () => {
    api = fakeApi({ stars: 5, visits: 2 })
    const { room } = await open()
    expect(await room.buy('kaktus')).toBe('poor')
    api.offline = true
    expect(await room.buy('sonnenbild')).toBe('offline')
    expect(room.owned).toEqual([])
  })
})
