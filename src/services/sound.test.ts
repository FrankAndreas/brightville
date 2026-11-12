import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The audio context is shared module state, so every test gets a fresh module
async function load() {
  vi.resetModules()
  return import('./sound')
}

const param = () => ({
  value: 0,
  setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(),
})

class FakeAudioContext {
  static instances = 0
  currentTime = 0
  destination = {}
  started = 0
  resume = vi.fn(() => Promise.resolve())
  constructor() { FakeAudioContext.instances++ }
  createOscillator() {
    return { type: 'sine', frequency: param(), connect: vi.fn(), start: () => this.started++, stop: vi.fn() }
  }
  createGain() {
    return { gain: param(), connect: vi.fn() }
  }
}

describe('sound without Web Audio', () => {
  beforeEach(() => {
    vi.stubGlobal('AudioContext', undefined)
    vi.stubGlobal('webkitAudioContext', undefined)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('never throws', async () => {
    const { unlockAudio, playBeat } = await load()
    expect(unlockAudio()).toBeNull()
    expect(() => playBeat('bell')).not.toThrow()
  })
})

describe('sound with Web Audio', () => {
  beforeEach(() => {
    FakeAudioContext.instances = 0
    vi.stubGlobal('AudioContext', FakeAudioContext)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('creates the context once and resumes it', async () => {
    const { unlockAudio } = await load()
    unlockAudio()
    unlockAudio()
    expect(FakeAudioContext.instances).toBe(1)
  })

  it('plays every sound kind', async () => {
    const { unlockAudio, playBeat, SOUND_KINDS } = await load()
    const ctx = unlockAudio() as unknown as FakeAudioContext
    expect(ctx.resume).toHaveBeenCalled()
    expect(SOUND_KINDS).toEqual(['sparkle', 'bell', 'chime', 'siren', 'piano', 'drum'])
    for (const kind of SOUND_KINDS) {
      const before = ctx.started
      playBeat(kind)
      expect(ctx.started).toBeGreaterThan(before)
    }
  })
})
