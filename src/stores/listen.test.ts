import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { fakeApi, type FakeApi } from '@/services/fakeApi'
import { useListenStore } from './listen'

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

const right = (scene: string) => ({ scene, right: true })
const sent = (api: FakeApi) => api.calls.filter(c => c.startsWith('listenResults'))

describe('listen store', () => {
  let api: FakeApi
  let storage: Storage
  const open = async (personId = 2) => {
    const listen = useListenStore()
    listen.init(api, personId, storage, () => '2026-11-12')
    await listen.load()
    return listen
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    api = fakeApi()
    storage = memory()
  })

  it('takes his record from the server', async () => {
    api.listen_ = { 'en:travel:platform': { right: 2, last_right: '2026-11-10', last_asked: '2026-11-10' } }
    const listen = await open()
    expect(listen.progress).toEqual(api.listen_)
  })

  it('moves the record at once and sends the round once', async () => {
    const listen = await open()
    listen.record('en', [right('en:travel:platform'), { scene: 'en:food:menu', right: false }])
    expect(listen.progress['en:travel:platform']).toEqual({ right: 1, last_right: '2026-11-12', last_asked: '2026-11-12' })
    expect(listen.progress['en:food:menu']).toEqual({ right: 0, last_right: null, last_asked: '2026-11-12' })
    await flushPromises()
    expect(sent(api)).toHaveLength(1)
    expect(api.listen_['en:travel:platform'].right).toBe(1)
    expect(listen.progress['en:travel:platform'].right).toBe(1)
    expect(storage.getItem('brightville.listen.2')).toBeNull()
  })

  it('a round sent while the server is away waits and goes with the next load, once', async () => {
    const listen = await open()
    api.offline = true
    listen.record('en', [right('en:travel:platform')])
    await flushPromises()
    expect(storage.getItem('brightville.listen.2')).not.toBeNull()
    api.offline = false
    api.calls = []
    await listen.load()
    await listen.load()
    expect(sent(api)).toHaveLength(1)
    expect(api.listen_['en:travel:platform'].right).toBe(1)
    expect(listen.progress['en:travel:platform'].right).toBe(1)
    expect(storage.getItem('brightville.listen.2')).toBeNull()
  })

  it('a round of a child who handed the device on waits for that child', async () => {
    const listen = await open(2)
    listen.init(api, 3, storage, () => '2026-11-12')
    listen.record('en', [right('en:travel:platform')], 2)
    await flushPromises()
    expect(listen.progress['en:travel:platform']).toBeUndefined()
    expect(storage.getItem('brightville.listen.2')).not.toBeNull()
    expect(sent(api)).toHaveLength(0)
  })

  it('a round the server refuses is let go', async () => {
    const listen = await open()
    api.refuseListen = true
    listen.record('en', [right('en:travel:platform')])
    await flushPromises()
    expect(storage.getItem('brightville.listen.2')).toBeNull()
  })

  it('keeps what it last had while the server is away', async () => {
    api.listen_ = { 'en:travel:platform': { right: 1, last_right: '2026-11-10', last_asked: '2026-11-10' } }
    await open()
    setActivePinia(createPinia())
    api.offline = true
    const again = await open()
    expect(again.progress['en:travel:platform'].right).toBe(1)
  })
})
