import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError } from '@/services/api'
import { fakeApi, type FakeApi } from '@/services/fakeApi'
import { usePlayerStore } from './player'

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

describe('player store', () => {
  let api: FakeApi
  let storage: Storage
  const open = async (personId = 1) => {
    const player = usePlayerStore()
    player.init(api, personId, storage)
    await player.refresh()
    return player
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    api = fakeApi({ stars: 4, visits: 1 })
    storage = memory()
  })

  it('shows what the server has', async () => {
    const player = await open()
    expect(player.stars).toBe(4)
    expect(player.visitsToday).toBe(1)
    expect(player.dailyGoal).toBe(2)
    expect(player.goalReached).toBe(false)
    expect(player.timeUp).toBe(false)
    expect(player.loaded).toBe(true)
  })

  it('is not loaded, and shows nothing, before the server answered', async () => {
    api.offline = true
    const player = await open()
    expect(player.loaded).toBe(false)
    expect(player.stars).toBe(0)
  })

  it('earns: the Stars show at once and the server confirms', async () => {
    const player = await open()
    const earning = player.earn('school', 7)
    expect(player.stars).toBe(11)
    expect(player.visitsToday).toBe(2)
    expect(await earning).toBe(true)
    expect(api.state_.stars).toBe(11)
    expect(player.pending).toBe(0)
  })

  it('says only once that the goal was reached', async () => {
    const player = await open()
    expect(await player.earn('school', 1)).toBe(true)
    expect(await player.earn('school', 1)).toBe(false)
  })

  it('earns nothing for no Stars', async () => {
    const player = await open()
    expect(await player.earn('school', 0)).toBe(false)
    expect(await player.earn('school', -3)).toBe(false)
    expect(await player.earn('school', 1.5)).toBe(false)
    expect(api.calls.filter(c => c.startsWith('visit'))).toEqual([])
    expect(player.stars).toBe(4)
  })

  it('takes the server\'s number when the building gives less than asked', async () => {
    const player = await open()
    await player.earn('yoga', 50)
    expect(player.stars).toBe(13)
  })

  it('keeps a visit the server did not get and sends it again later', async () => {
    const player = await open()
    api.offline = true
    expect(await player.earn('school', 5)).toBe(true)
    expect(player.stars).toBe(9)
    expect(player.pending).toBe(1)
    await player.refresh()
    expect(player.stars).toBe(9)
    api.offline = false
    await player.refresh()
    expect(player.pending).toBe(0)
    expect(api.state_.stars).toBe(9)
    expect(player.stars).toBe(9)
  })

  it('sends a kept visit after the page was closed and opened again, once', async () => {
    let player = await open()
    api.offline = true
    await player.earn('school', 5)
    setActivePinia(createPinia())
    api.offline = false
    player = await open()
    expect(player.stars).toBe(9)
    await player.refresh()
    expect(api.state_.stars).toBe(9)
    expect(api.calls.filter(c => c.startsWith('visit'))).toHaveLength(2)
  })

  it('never sends one child\'s kept visit as another', async () => {
    const player = await open(1)
    api.offline = true
    await player.earn('school', 5)
    setActivePinia(createPinia())
    api.offline = false
    api.state_.stars = 0
    const other = await open(2)
    expect(other.pending).toBe(0)
    expect(api.state_.stars).toBe(0)
  })

  it('pays once for a round whose answer got lost, and lets the child in on the next try', async () => {
    Object.assign(api.state_, { stars: 10, visits: 2 })
    const player = await open()
    api.loseAnswers = true
    expect(await player.buy('arcade')).toBe('offline')
    expect(api.state_.stars).toBe(7)
    api.loseAnswers = false
    expect(await player.buy('arcade')).toBe('ok')
    expect(api.state_.stars).toBe(7)
    expect(await player.buy('arcade')).toBe('ok')
    expect(api.state_.stars).toBe(4)
  })

  it('does not carry a lost round into the next day', async () => {
    Object.assign(api.state_, { stars: 10, visits: 2 })
    const player = await open()
    api.loseAnswers = true
    await player.buy('arcade')
    api.loseAnswers = false
    api.newDay('2026-11-13')
    await player.refresh()
    expect(await player.buy('arcade')).toBe('locked')
  })

  it('keeps a waiting visit through an error page without a code', async () => {
    const player = await open()
    api.offline = true
    await player.earn('school', 5)
    api.offline = false
    const send = api.visit
    api.visit = async () => { throw new ApiError(404, 'offline') }
    await player.refresh()
    expect(player.pending).toBe(1)
    api.visit = send
    await player.refresh()
    expect(player.pending).toBe(0)
    expect(api.state_.stars).toBe(9)
  })

  it('says when the login is gone, instead of quietly failing', async () => {
    const lost = vi.fn()
    const player = usePlayerStore()
    player.init(api, 1, storage, lost)
    await player.refresh()
    api.state = async () => { throw new ApiError(401, 'not_logged_in', 'https://hub/?next=') }
    await player.refresh()
    expect(lost).toHaveBeenCalledTimes(1)
    api.visit = async () => { throw new ApiError(403, 'no_access') }
    await player.earn('school', 2)
    expect(lost).toHaveBeenCalledTimes(2)
    expect(player.pending).toBe(1)
  })

  it('keeps each person\'s waiting visits apart when the device changes hands mid-send', async () => {
    storage.setItem('brightville.outbox.2', JSON.stringify([{ building: 'school', stars: 2, key: 'ben-1' }]))
    const player = await open(1)
    api.offline = true
    await player.earn('school', 5)
    api.offline = false
    let answer!: () => void
    const send = api.visit
    api.visit = (...args) => new Promise(resolve => { answer = () => resolve(send(...args)) })
    const sending = player.refresh()
    player.init(api, 2, storage)
    answer()
    await sending
    expect(player.pending).toBe(1)
    expect(JSON.parse(storage.getItem('brightville.outbox.2')!)).toHaveLength(1)
    // Mia's visit stays queued under her name; sent again later, its key makes it count once
    expect(JSON.parse(storage.getItem('brightville.outbox.1')!)).toHaveLength(1)
  })

  it('drops a kept visit the server refuses for good', async () => {
    const player = await open()
    api.offline = true
    await player.earn('castle-that-was-removed', 5)
    api.offline = false
    api.visit = async () => { throw new ApiError(404, 'unknown_building') }
    await player.refresh()
    expect(player.pending).toBe(0)
    expect(player.stars).toBe(4)
  })

  it('buys a round when the server agrees', async () => {
    api.state_.visits = 2
    const player = await open()
    expect(await player.buy('arcade')).toBe('ok')
    expect(player.stars).toBe(1)
    expect(await player.buy('arcade')).toBe('poor')
    expect(player.stars).toBe(1)
  })

  it('passes on why a round was refused', async () => {
    const player = await open()
    expect(await player.buy('arcade')).toBe('locked')
    api.state_.visits = 2
    api.state_.play_minutes = 10
    api.state_.play_seconds = 600
    expect(await player.buy('arcade')).toBe('time_up')
    api.offline = true
    expect(await player.buy('arcade')).toBe('offline')
    expect(player.stars).toBe(4)
  })

  it('knows when today\'s play time is used up', async () => {
    api.state_.play_minutes = 10
    api.state_.play_seconds = 599
    const player = await open()
    expect(player.timeUp).toBe(false)
    await player.reportPlayTime(1)
    expect(player.timeUp).toBe(true)
  })

  it('does not mind a play-time report that gets lost', async () => {
    const player = await open()
    api.offline = true
    await expect(player.reportPlayTime(30)).resolves.toBeUndefined()
    await expect(player.reportPlayTime(0)).resolves.toBeUndefined()
  })

  it('follows the server into a new day', async () => {
    api.state_.visits = 2
    const player = await open()
    expect(player.goalReached).toBe(true)
    api.newDay('2026-11-13')
    await player.refresh()
    expect(player.goalReached).toBe(false)
    expect(player.stars).toBe(4)
  })

  it('works without any storage', async () => {
    const player = usePlayerStore()
    const broken = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } } as unknown as Storage
    player.init(api, 1, broken)
    await player.refresh()
    api.offline = true
    expect(await player.earn('school', 2)).toBe(true)
    expect(player.stars).toBe(6)
  })
})
