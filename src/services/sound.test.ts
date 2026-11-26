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
  oscillators: { type: string; frequency: ReturnType<typeof param>; connect: () => void; start: () => void; stop: ReturnType<typeof vi.fn> }[] = []
  resume = vi.fn(() => Promise.resolve())
  constructor() { FakeAudioContext.instances++ }
  createOscillator() {
    const osc = { type: 'sine', frequency: param(), connect: vi.fn(), start: () => this.started++, stop: vi.fn() }
    this.oscillators.push(osc)
    return osc
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
    const { playNote } = await load()
    expect(() => playNote(440)).not.toThrow()
  })
})

describe('sound with Web Audio', () => {
  beforeEach(() => {
    FakeAudioContext.instances = 0
    vi.stubGlobal('AudioContext', FakeAudioContext)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('plays a note at the given pitch', async () => {
    const { unlockAudio, playNote } = await load()
    const ctx = unlockAudio() as unknown as FakeAudioContext
    playNote(440)
    expect(ctx.started).toBe(1)
  })

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
    expect(SOUND_KINDS).toEqual(['sparkle', 'bell', 'chime', 'siren', 'piano', 'drum', 'softDrum'])
    for (const kind of SOUND_KINDS) {
      const before = ctx.started
      playBeat(kind)
      expect(ctx.started).toBeGreaterThan(before)
    }
  })

  // Laptop and iPad speakers play almost nothing below 200 Hz: a drum of only a low sine (160 → 50 Hz) was silent there
  it('gives the drum a higher skin and click that small speakers can play', async () => {
    const { unlockAudio, playBeat } = await load()
    const ctx = unlockAudio() as unknown as FakeAudioContext
    playBeat('drum')
    const starts = ctx.oscillators.map(o => o.frequency.setValueAtTime.mock.calls[0][0] as number)
    expect(Math.min(...starts)).toBeLessThan(200)
    expect(starts.filter(f => f >= 250).length).toBeGreaterThanOrEqual(2)
  })

  it('moos: one low sawtooth gliding down for about 0.6 s', async () => {
    const { unlockAudio, playMoo } = await load()
    const ctx = unlockAudio() as unknown as FakeAudioContext
    playMoo()
    expect(ctx.oscillators).toHaveLength(1)
    const [osc] = ctx.oscillators
    expect(osc.type).toBe('sawtooth')
    const [from] = osc.frequency.setValueAtTime.mock.calls[0]
    const [to, at] = osc.frequency.exponentialRampToValueAtTime.mock.calls[0]
    expect(from).toBeLessThan(250)
    expect(to).toBeLessThan(from)
    expect(at).toBeCloseTo(0.6, 2)
    expect(osc.stop).toHaveBeenCalledWith(expect.closeTo(0.62, 2))
  })

  it('stays silent for a moo without Web Audio', async () => {
    vi.stubGlobal('AudioContext', undefined)
    vi.stubGlobal('webkitAudioContext', undefined)
    const { playMoo } = await load()
    expect(() => playMoo()).not.toThrow()
  })
})
