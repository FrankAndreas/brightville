import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasMicrophone, openMicrophone } from './microphone'

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
    expect(getUserMedia).toHaveBeenCalledWith({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false }, video: false })
  })
})
