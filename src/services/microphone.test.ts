import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasMicrophone, openMicrophone } from './microphone'
import { unlockAudio } from './sound'

vi.mock('./sound', () => ({ unlockAudio: vi.fn() }))

describe('the microphone', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('is missing without mediaDevices', async () => {
    vi.stubGlobal('navigator', {})
    expect(hasMicrophone()).toBe(false)
    expect(await openMicrophone()).toBeNull()
  })

  it('gives nothing when she or the iPad says no', async () => {
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(() => Promise.reject(new Error('NotAllowedError'))) } })
    expect(hasMicrophone()).toBe(true)
    expect(await openMicrophone()).toBeNull()
  })

  it('asks for sound only, without the iPad changing her loudness', async () => {
    const getUserMedia = vi.fn(() => Promise.reject(new Error('no')))
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
    await openMicrophone()
    // No echo filter: on iPads it quiets the speaker
    expect(getUserMedia).toHaveBeenCalledWith({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false })
  })

  // With the browser's own filters off, the room's low hum comes through and raises the clap threshold (a laptop's
  // quiet room read 0.03; 0.002 above 400 Hz): only what lies above it is measured
  it('measures the loudness above the low rumble', async () => {
    const node = (name: string) => ({ name, connect: vi.fn(), disconnect: vi.fn() })
    const source = node('source')
    const filter = { ...node('filter'), type: '', frequency: { value: 0 } }
    const analyser = { ...node('analyser'), fftSize: 0, getFloatTimeDomainData: vi.fn() }
    vi.mocked(unlockAudio).mockReturnValue({
      createMediaStreamSource: () => source, createBiquadFilter: () => filter, createAnalyser: () => analyser,
    } as unknown as AudioContext)
    const stream = { getTracks: () => [] }
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn(() => Promise.resolve(stream)) } })
    expect(await openMicrophone()).not.toBeNull()
    expect(filter.type).toBe('highpass')
    expect(filter.frequency.value).toBeGreaterThanOrEqual(300)
    expect(source.connect).toHaveBeenCalledWith(filter)
    expect(filter.connect).toHaveBeenCalledWith(analyser)
  })
})
