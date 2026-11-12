import { describe, expect, it, vi } from 'vitest'
import { renewOnce } from './renew'

function memory(): Storage {
  const data = new Map<string, string>()
  return { getItem: k => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) } as Storage
}

describe('renewOnce', () => {
  it('goes through the hub once a day at most', () => {
    const go = vi.fn()
    const storage = memory()
    expect(renewOnce('https://hub/?next=', go, storage, 1_000_000)).toBe(true)
    expect(go).toHaveBeenCalledWith(`https://hub/?next=${encodeURIComponent(window.location.href)}`)
    expect(renewOnce('https://hub/?next=', go, storage, 1_000_000 + 3600_000)).toBe(false)
    expect(renewOnce('https://hub/?next=', go, storage, 1_000_000 + 25 * 3600_000)).toBe(true)
    expect(go).toHaveBeenCalledTimes(2)
  })

  it('never goes without storage, so it can never loop', () => {
    const go = vi.fn()
    const blocked = { getItem() { throw new Error('blocked') } } as unknown as Storage
    expect(renewOnce('https://hub/?next=', go, blocked)).toBe(false)
    expect(go).not.toHaveBeenCalled()
  })
})
