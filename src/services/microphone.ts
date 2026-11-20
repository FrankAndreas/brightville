import { unlockAudio } from './sound'

// The Trommelhaus's microphone: how loud the room is, about a hundred times a second, while she answers. Nothing is
// recorded, kept or sent. It stays open through the visit (reopening may ask again on an iPad) and is only read while
// she answers; it is closed when she leaves or switches to tapping.

/** One loudness reading: 0 (silence) to about 1, at `t` ms (performance.now) */
export interface Level { t: number; level: number }

export interface Microphone {
  /** Starts reporting levels; returns a function that stops */
  listen(each: (l: Level) => void): () => void
  close(): void
}

const EVERY_MS = 10

export const hasMicrophone = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

/** Asks for the microphone (call it on a tap: the iPad wants that); null if there is none or the answer is no */
export async function openMicrophone(): Promise<Microphone | null> {
  if (!hasMicrophone()) return null
  let stream: MediaStream
  try {
    // Her own loudness counts: the iPad mustn't even it out. No echo filter: the house never plays while it listens,
    // and on iPads it quiets the speaker for as long as the microphone is open.
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false,
    })
  } catch {
    return null
  }
  const ac = unlockAudio()
  if (!ac) {
    stream.getTracks().forEach(t => t.stop())
    return null
  }
  const source = ac.createMediaStreamSource(stream)
  const analyser = ac.createAnalyser()
  // About 40 ms of sound per reading: a clap's peak isn't missed between readings
  analyser.fftSize = 2048
  source.connect(analyser)
  const samples = new Float32Array(analyser.fftSize)
  return {
    listen(each) {
      const id = setInterval(() => {
        analyser.getFloatTimeDomainData(samples)
        let sum = 0
        for (const s of samples) sum += s * s
        each({ t: performance.now(), level: Math.sqrt(sum / samples.length) })
      }, EVERY_MS)
      return () => clearInterval(id)
    },
    close() {
      source.disconnect()
      stream.getTracks().forEach(t => t.stop())
    },
  }
}
