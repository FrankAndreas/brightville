import { describe, expect, it } from 'vitest'
import { SAVE_KEY, localSaveStore } from './storage'

function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    getItem: k => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: k => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    get length() { return map.size },
  }
}

describe('localSaveStore', () => {
  it('loads what it saved under brightville.save', () => {
    const storage = memoryStorage()
    const store = localSaveStore(storage)
    store.save({ version: 1, stars: 7 })
    expect(SAVE_KEY).toBe('brightville.save')
    expect(storage.getItem('brightville.save')).not.toBeNull()
    expect(localSaveStore(storage).load()).toEqual({ version: 1, stars: 7 })
  })

  it('does not throw when setItem throws', () => {
    const storage = memoryStorage()
    storage.setItem = () => { throw new Error('quota') }
    expect(() => localSaveStore(storage).save({ version: 1, stars: 1 })).not.toThrow()
  })

  it('does not throw when getItem throws and returns an empty save', () => {
    const storage = memoryStorage()
    storage.getItem = () => { throw new Error('blocked') }
    expect(localSaveStore(storage).load()).toEqual({ version: 1, stars: 0 })
  })
})
