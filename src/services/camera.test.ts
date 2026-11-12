import { afterEach, describe, expect, it, vi } from 'vitest'
import { CameraError, closeCamera, onCameraLost, openCamera } from './camera'

function named(name: string): Error {
  const e = new Error(name)
  e.name = name
  return e
}

function fakeStream() {
  const listeners: Record<string, () => void> = {}
  const video = { kind: 'video', stop: vi.fn(), addEventListener: (type: string, cb: () => void) => { listeners[type] = cb } }
  const stream = { getTracks: () => [video], getVideoTracks: () => [video] } as unknown as MediaStream
  return { stream, video, end: () => listeners.ended?.() }
}

const stubGetUserMedia = (impl: (c: MediaStreamConstraints) => Promise<MediaStream>) => {
  const getUserMedia = vi.fn(impl)
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
  return getUserMedia
}

describe('camera', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('asks for video only, no audio', async () => {
    const { stream } = fakeStream()
    const getUserMedia = stubGetUserMedia(async () => stream)
    await expect(openCamera()).resolves.toBe(stream)
    const constraints = getUserMedia.mock.calls[0][0]
    expect(constraints.audio).toBe(false)
    expect(constraints.video).toMatchObject({ facingMode: 'user' })
  })

  it.each(['NotAllowedError', 'SecurityError'])('throws CameraError denied for %s', async name => {
    stubGetUserMedia(() => Promise.reject(named(name)))
    const error = await openCamera().catch(e => e)
    expect(error).toBeInstanceOf(CameraError)
    expect(error.reason).toBe('denied')
  })

  it.each(['NotFoundError', 'NotReadableError', 'OverconstrainedError'])('throws CameraError missing for %s', async name => {
    stubGetUserMedia(() => Promise.reject(named(name)))
    const error = await openCamera().catch(e => e)
    expect(error).toBeInstanceOf(CameraError)
    expect(error.reason).toBe('missing')
  })

  it('throws CameraError missing when mediaDevices does not exist', async () => {
    vi.stubGlobal('navigator', {})
    const error = await openCamera().catch(e => e)
    expect(error).toBeInstanceOf(CameraError)
    expect(error.reason).toBe('missing')
  })

  it('closeCamera stops every track', () => {
    const { stream, video } = fakeStream()
    closeCamera(stream)
    expect(video.stop).toHaveBeenCalledTimes(1)
  })

  it('onCameraLost fires when the video track ends', () => {
    const { stream, end } = fakeStream()
    const lost = vi.fn()
    onCameraLost(stream, lost)
    expect(lost).not.toHaveBeenCalled()
    end()
    expect(lost).toHaveBeenCalledTimes(1)
  })
})
