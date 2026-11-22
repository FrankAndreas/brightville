import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { ApiError, type Api } from '@/services/api'
import { defineRoundStore } from './rounds'

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

/** A tiny server: his progress is the sum of the numbers sent, each round counted once by its key */
function tinyServer() {
  const server = { total: 0, keys: new Set<string>(), offline: false, refuse: false, sent: 0 }
  const answer = () => ({ progress: server.total, seen: [...server.keys] })
  const fetch = async () => {
    if (server.offline) throw new ApiError(0, 'offline')
    return answer()
  }
  const send = async (_: Api, item: { key: string; answers: { n: number }[] }) => {
    if (server.offline) throw new ApiError(0, 'offline')
    server.sent++
    if (server.refuse) throw new ApiError(422, 'refused')
    if (!server.keys.has(item.key)) {
      server.keys.add(item.key)
      server.total += item.answers.reduce((s, a) => s + a.n, 0)
    }
    return answer()
  }
  return { server, fetch, send }
}

describe('a store of results that wait on the device', () => {
  let tiny: ReturnType<typeof tinyServer>
  let storage: Storage
  const useTiny = () => defineRoundStore<number, { n: number }>('tiny', {
    prefix: 'brightville.tiny',
    fetch: () => tiny.fetch(),
    send: (api, item) => tiny.send(api, item),
    lay: (p, item) => p + item.answers.reduce((s, a) => s + a.n, 0),
    isAnswer: (x): x is { n: number } => typeof x === 'object' && x !== null && typeof (x as { n: unknown }).n === 'number',
    empty: () => 0,
  })()
  const open = async (personId = 2) => {
    const store = useTiny()
    store.init({} as Api, personId, storage, () => '2026-11-12')
    await store.load()
    return store
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    tiny = tinyServer()
    storage = memory()
  })

  it('takes the server\'s progress', async () => {
    tiny.server.total = 7
    expect((await open()).progress).toBe(7)
  })

  it('moves at once and sends the round once', async () => {
    const store = await open()
    store.record('en', [{ n: 3 }])
    expect(store.progress).toBe(3)
    await flushPromises()
    expect(tiny.server.total).toBe(3)
    expect(tiny.server.sent).toBe(1)
    expect(store.progress).toBe(3)
    expect(storage.getItem('brightville.tiny.2')).toBeNull()
  })

  it('a round sent while the server is away waits and goes once with the next load', async () => {
    const store = await open()
    tiny.server.offline = true
    store.record('en', [{ n: 3 }])
    await flushPromises()
    expect(storage.getItem('brightville.tiny.2')).not.toBeNull()
    tiny.server.offline = false
    await store.load()
    await store.load()
    expect(tiny.server.total).toBe(3)
    expect(store.progress).toBe(3)
    expect(storage.getItem('brightville.tiny.2')).toBeNull()
  })

  it('a round of a child who handed the device on waits for that child', async () => {
    const store = await open(2)
    store.init({} as Api, 3, storage, () => '2026-11-12')
    store.record('en', [{ n: 3 }], 2)
    await flushPromises()
    expect(store.progress).toBe(0)
    expect(storage.getItem('brightville.tiny.2')).not.toBeNull()
    expect(tiny.server.sent).toBe(0)
  })

  it('a refused round is let go', async () => {
    const store = await open()
    tiny.server.refuse = true
    store.record('en', [{ n: 3 }])
    await flushPromises()
    expect(storage.getItem('brightville.tiny.2')).toBeNull()
  })
})
