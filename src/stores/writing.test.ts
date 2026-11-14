import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { fakeApi, type FakeApi } from '@/services/fakeApi'
import { useWritingStore } from './writing'

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

const met = (level: 1 | 2 | 3 | 4) => ({ level, streak: 0, practised_at: null })

describe('writing store', () => {
  let api: FakeApi
  let storage: Storage
  const open = async (personId = 1) => {
    const writing = useWritingStore()
    writing.init(api, personId, storage)
    await writing.load()
    return writing
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    api = fakeApi()
    storage = memory()
  })

  it('takes her texts, letters and how many new letters are left', async () => {
    api.writing_.texts = ['MIA', 'LENA']
    api.writing_.letters = { M: met(2) }
    const writing = await open()
    expect(writing.loaded).toBe(true)
    expect(writing.texts).toEqual(['MIA', 'LENA'])
    expect(writing.letters.M.level).toBe(2)
    expect(writing.newLeft).toBe(2)
  })

  it('moves a letter up after three clean writes, here and on the server', async () => {
    api.writing_.letters = { M: met(1) }
    const writing = await open()
    for (let i = 0; i < 3; i++) writing.recordWrite('M', 1, true)
    expect(writing.letters.M.level).toBe(2)
    await flushPromises()
    expect(api.writing_.letters.M.level).toBe(2)
    expect(writing.letters.M.level).toBe(2)
  })

  it('keeps writes while the server is away and sends them with the next load', async () => {
    api.writing_.letters = { M: met(1) }
    const writing = await open()
    api.offline = true
    for (let i = 0; i < 3; i++) writing.recordWrite('M', 1, true)
    await flushPromises()
    expect(writing.letters.M.level).toBe(2)
    expect(api.writing_.letters.M.level).toBe(1)
    api.offline = false
    // A fresh page: what waits comes from the device
    setActivePinia(createPinia())
    const again = await open()
    expect(api.writing_.letters.M.level).toBe(2)
    expect(again.letters.M.level).toBe(2)
  })

  it('shows waiting writes over an older answer from the server', async () => {
    api.writing_.letters = { M: met(1) }
    const writing = await open()
    api.offline = true
    writing.recordWrite('M', 1, true)
    await flushPromises()
    api.offline = false
    api.writing_.texts = ['MIA']
    // The load sends the write first, then reads
    await writing.load()
    expect(writing.letters.M.streak).toBe(1)
    expect(api.writing_.letters.M.streak).toBe(1)
  })

  it('counts a write once even if its answer was lost and it is sent again', async () => {
    api.writing_.letters = { M: met(1) }
    const writing = await open()
    api.loseAnswers = true
    writing.recordWrite('M', 1, true)
    await flushPromises()
    api.loseAnswers = false
    await writing.load()
    expect(api.writing_.letters.M.streak).toBe(1)
    expect(writing.letters.M.streak).toBe(1)
  })

  it('introduces a letter: at the first level, one new letter fewer today', async () => {
    const writing = await open()
    writing.introduce('L')
    expect(writing.letters.L.level).toBe(1)
    expect(writing.newLeft).toBe(1)
    await flushPromises()
    expect(api.writing_.letters.L.level).toBe(1)
  })

  it('lets go of an introduction the server refuses, and asks again', async () => {
    api.writing_.introducedOn = { A: '2026-11-12', B: '2026-11-12' }
    api.writing_.letters = { A: met(2), B: met(2) }
    const writing = await open()
    expect(writing.newLeft).toBe(0)
    writing.introduce('L')
    await flushPromises()
    expect(writing.letters.L).toBeUndefined()
    expect(storage.getItem('brightville.writing.1')).toBeNull()
  })

  it('ignores an answer meant for the child before', async () => {
    api.writing_.letters = { M: met(1) }
    const writing = await open(1)
    writing.recordWrite('M', 1, true)
    writing.init(api, 2, storage)
    await flushPromises()
    expect(writing.letters).toEqual({})
  })

  it('does not count a write twice when the letters come back before the write\'s own answer', async () => {
    api.writing_.letters = { M: met(1) }
    const writing = await open()
    // The server has the write at once, but its answer is slow
    const send = api.sendWrites
    let answer = () => {}
    api.sendWrites = writes => {
      const done = send(writes)
      return new Promise(resolve => { answer = () => resolve(done) })
    }
    writing.recordWrite('M', 1, true)
    await flushPromises()
    expect(api.writing_.letters.M.streak).toBe(1)
    await writing.load()
    expect(writing.letters.M.streak).toBe(1)
    answer()
    await flushPromises()
    expect(writing.letters.M.streak).toBe(1)
  })

  describe('a letter met while the server is away', () => {
    afterEach(() => { vi.useRealTimers() })

    it('counts for the day she met it', async () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date(2026, 10, 11, 18, 0))
      const writing = await open()
      api.offline = true
      writing.introduce('L')
      await flushPromises()
      vi.setSystemTime(new Date(2026, 10, 12, 9, 0))
      api.offline = false
      await writing.load()
      expect(api.writing_.introducedOn.L).toBe('2026-11-11')
      expect(writing.newLeft).toBe(2)
    })
  })

  it('goes on without the server after a while', async () => {
    api.offline = true
    const writing = await open()
    expect(writing.loaded).toBe(true)
    expect(writing.texts).toEqual([])
    expect(writing.newLeft).toBe(2)
  })
})
