import { unlockAudio } from './sound'

// The Trommelhaus's microphone: how loud the room is, about a hundred times a second, while she answers. Nothing is
// recorded, kept or sent. It stays open through the visit (reopening may ask again on an iPad) and is only read while
// she answers (and once at the start, to hear the house's quiet drum); it is closed when she leaves or switches to tapping.

/** One loudness reading: 0 (silence) to about 1, at `t` ms (performance.now) */
export interface Level { t: number; level: number }

export interface Microphone {
  /** Starts reporting levels; returns a function that stops */
  listen(each: (l: Level) => void): () => void
  close(): void
  /** The stream itself, for the test page (debug/trommel.html) to record what the microphone hears */
  stream?: MediaStream
}

const EVERY_MS = 10
/** Below this the microphone's offset and rumble lie, not a clap */
const LOWEST_HZ = 400

export const hasMicrophone = () => typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

/** Asks for the microphone (call it on a tap: the iPad wants that); null if there is none or the answer is no */
export async function openMicrophone(): Promise<Microphone | null> {
  if (!hasMicrophone()) return null
  let stream: MediaStream
  try {
    // Her own loudness counts: the iPad mustn't even it out. No echo filter: the house plays only its quiet drum while
    // it listens (and measures it), and on iPads the filter quiets the speaker for as long as the microphone is open.
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
  // With the browser's own filters off, the room's low hum and rumble come through: on a laptop it read 0.03 in a
  // quiet room (and the clap threshold rose to 0.1), against 0.002 above 400 Hz. A clap lies mostly at 0.8–3 kHz and
  // loses almost nothing; the house's quiet drum (260 Hz down to 120 Hz) nearly all: only what is above is measured.
  const filter = ac.createBiquadFilter()
  filter.type = 'highpass'
  filter.frequency.value = LOWEST_HZ
  const analyser = ac.createAnalyser()
  // About 40 ms of sound per reading: a clap's peak isn't missed between readings
  analyser.fftSize = 2048
  source.connect(filter)
  filter.connect(analyser)
  const samples = new Float32Array(analyser.fftSize)
  return {
    stream,
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
