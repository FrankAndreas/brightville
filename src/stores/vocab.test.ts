import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { fakeApi, type FakeApi } from '@/services/fakeApi'
import { useVocabStore } from './vocab'

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

const right = (word: string) => ({ word, right: true })
const LIST = { lang: 'en' as const, name: 'Unit 3', words: [{ de: 'der Zug', foreign: 'train' }] }

describe('vocab store', () => {
  let api: FakeApi
  let storage: Storage
  const open = async (personId = 2) => {
    const vocab = useVocabStore()
    vocab.init(api, personId, storage, () => '2026-11-12')
    await vocab.load()
    return vocab
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    api = fakeApi()
    storage = memory()
  })

  it('takes his lists and progress from the server', async () => {
    api.vocab_.lists = [{ id: 1, ...LIST }]
    api.vocab_.progress = { 'en:own:train': { box: 2, due: '2026-11-14' } }
    const vocab = await open()
    expect(vocab.lists).toEqual(api.vocab_.lists)
    expect(vocab.progress).toEqual(api.vocab_.progress)
  })

  it('moves a word at once and sends the round once', async () => {
    const vocab = await open()
    vocab.record('en', [right('en:travel:station')])
    expect(vocab.progress['en:travel:station']).toEqual({ box: 1, due: '2026-11-13' })
    await flushPromises()
    expect(api.calls.filter(c => c.startsWith('vocabResults'))).toHaveLength(1)
    expect(api.vocab_.progress['en:travel:station']).toEqual({ box: 1, due: '2026-11-13' })
    expect(storage.getItem('brightville.vocab.2')).toBeNull()
  })

  it('a round sent while the server is away waits and goes with the next load, once', async () => {
    const vocab = await open()
    api.offline = true
    vocab.record('en', [right('en:travel:station')])
    await flushPromises()
    expect(storage.getItem('brightville.vocab.2')).not.toBeNull()
    expect(vocab.progress['en:travel:station'].box).toBe(1)
    api.offline = false
    api.calls = []
    await vocab.load()
    await vocab.load()
    expect(api.calls.filter(c => c.startsWith('vocabResults'))).toHaveLength(1)
    expect(api.vocab_.progress['en:travel:station'].box).toBe(1)
    expect(storage.getItem('brightville.vocab.2')).toBeNull()
  })

  it('a round of a child who handed the device on waits for that child', async () => {
    const vocab = await open(2)
    vocab.init(api, 3, storage, () => '2026-11-12')
    vocab.record('en', [right('en:travel:station')], 2)
    await flushPromises()
    expect(vocab.progress['en:travel:station']).toBeUndefined()
    expect(storage.getItem('brightville.vocab.2')).not.toBeNull()
    expect(api.calls.filter(c => c.startsWith('vocabResults'))).toHaveLength(0)
  })

  it('a round the server refuses is let go', async () => {
    const vocab = await open()
    api.refuseVocab = true
    vocab.record('en', [right('en:travel:station')])
    await flushPromises()
    expect(storage.getItem('brightville.vocab.2')).toBeNull()
  })

  it('saves and deletes lists through the server, and says when it is away', async () => {
    const vocab = await open()
    expect(await vocab.saveList(LIST)).toBe('ok')
    expect(vocab.lists.map(l => l.name)).toEqual(['Unit 3'])
    const id = vocab.lists[0].id
    expect(await vocab.saveList({ ...LIST, id, name: 'Unit 4' })).toBe('ok')
    expect(vocab.lists.map(l => l.name)).toEqual(['Unit 4'])
    api.offline = true
    expect(await vocab.saveList({ ...LIST, name: 'x' })).toBe('away')
    expect(await vocab.deleteList(id)).toBe('away')
    api.offline = false
    expect(await vocab.deleteList(id)).toBe('ok')
    expect(vocab.lists).toEqual([])
  })

  it('a refused list says why', async () => {
    const vocab = await open()
    expect(await vocab.saveList({ ...LIST, name: ' ' })).toBe('empty')
  })

  it('keeps what it last had while the server is away', async () => {
    api.vocab_.lists = [{ id: 1, ...LIST }]
    await open()
    setActivePinia(createPinia())
    api.offline = true
    const again = await open()
    expect(again.lists.map(l => l.name)).toEqual(['Unit 3'])
  })
})
