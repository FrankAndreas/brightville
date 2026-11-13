export const SOUND_KINDS = ['sparkle', 'bell', 'chime', 'siren', 'piano', 'drum'] as const
export type SoundKind = (typeof SOUND_KINDS)[number]

let ctx: AudioContext | null = null

/**
 * Creates (once) and resumes the shared audio context. iOS only allows this
 * from a user gesture, so call it on a tap. Returns the context, or null.
 */
export function unlockAudio(): AudioContext | null {
  const w = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
  const Ctx = w.AudioContext || w.webkitAudioContext
  if (!Ctx) return null
  if (!ctx) ctx = new Ctx()
  void ctx.resume?.()
  return ctx
}

interface Tone { type?: OscillatorType; freq: number; to?: number; start?: number; length: number; volume?: number }

// One oscillator through its own gain envelope
function tone(ac: AudioContext, { type = 'sine', freq, to, start = 0, length, volume = 0.3 }: Tone) {
  const t = ac.currentTime + start
  const osc = ac.createOscillator()
  const amp = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + length)
  amp.gain.setValueAtTime(0.0001, t)
  amp.gain.linearRampToValueAtTime(volume, t + 0.01)
  amp.gain.exponentialRampToValueAtTime(0.0001, t + length)
  osc.connect(amp)
  amp.connect(ac.destination)
  osc.start(t)
  osc.stop(t + length + 0.02)
}

const SOUNDS: Record<SoundKind, (ac: AudioContext) => void> = {
  sparkle: ac => [1320, 1760, 2350].forEach((freq, i) => tone(ac, { freq, start: i * 0.06, length: 0.15, volume: 0.15 })),
  bell: ac => { tone(ac, { freq: 880, length: 0.4 }); tone(ac, { freq: 1760, length: 0.25, volume: 0.1 }) },
  chime: ac => { tone(ac, { freq: 1568, length: 0.35, volume: 0.2 }); tone(ac, { freq: 2093, length: 0.3, volume: 0.1 }) },
  siren: ac => tone(ac, { type: 'square', freq: 660, to: 990, length: 0.3, volume: 0.08 }),
  piano: ac => tone(ac, { type: 'triangle', freq: 523, length: 0.4, volume: 0.35 }),
  drum: ac => tone(ac, { freq: 160, to: 50, length: 0.25, volume: 0.6 }),
}

/** One soft note at `freq` hertz, for tunes and counting up; silent without Web Audio. */
export function playNote(freq: number, length = 0.3, volume = 0.22): void {
  const ac = ctx ?? unlockAudio()
  if (!ac) return
  tone(ac, { type: 'triangle', freq, length, volume })
}

/** One short sound of the given kind; silent without Web Audio. */
export function playBeat(kind: SoundKind): void {
  const ac = ctx ?? unlockAudio()
  if (!ac) return
  SOUNDS[kind](ac)
}
