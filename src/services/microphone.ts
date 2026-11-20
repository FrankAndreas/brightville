import { unlockAudio } from './sound'

// The Trommelhaus's microphone: how loud the room is, about a hundred times a second, while she answers. Nothing is
// recorded, kept or sent; it is closed again as soon as she has answered.

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
    // Her own loudness counts: the iPad mustn't even it out. The echo filter helps against the house's own sounds.
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false }, video: false,
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
  analyser.fftSize = 512
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
