/** Why the camera can't be used: the child's screen is the same, a parent may want to know. */
export class CameraError extends Error {
  constructor(public reason: 'denied' | 'missing') {
    super(`camera ${reason}`)
    this.name = 'CameraError'
  }
}

/** Opens the front camera. Pictures stay in the page; nothing is recorded. */
export async function openCamera(): Promise<MediaStream> {
  if (typeof navigator.mediaDevices?.getUserMedia !== 'function') throw new CameraError('missing')
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      audio: false,
    })
  } catch (e) {
    const name = (e as { name?: string } | null)?.name
    throw new CameraError(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'missing')
  }
}

/** Switches the camera off; its light goes out. */
export function closeCamera(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop()
}

/** Calls back when the camera goes away, e.g. is unplugged. */
export function onCameraLost(stream: MediaStream, cb: () => void): void {
  for (const track of stream.getVideoTracks()) track.addEventListener('ended', cb)
}
