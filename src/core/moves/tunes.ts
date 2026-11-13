/** 100 beats a minute: slow enough for a five-year-old to follow a move per bar */
export const BEAT_MS = 600
export const BEATS_PER_BAR = 4
export const BARS_PER_SONG = 16
export const BEATS_PER_SONG = BEATS_PER_BAR * BARS_PER_SONG

const STEPS: Record<string, number> = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }

/** The pitch of a note name such as "C5" or "F#4", in hertz. */
export function noteFreq(name: string): number {
  const m = /^([A-G])(#?)([3-6])$/.exec(name)
  if (!m) throw new Error(`not a note: ${name}`)
  const semitones = STEPS[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) - 4) * 12
  return 440 * 2 ** (semitones / 12)
}

/**
 * A tune written as two phrases of four bars, played A A B A. One token per beat:
 * a note name, or "-" to let the beat rest.
 */
function tune(a: string, b: string): (number | null)[] {
  const beats = (phrase: string) => phrase.split(/\s+/).filter(t => t !== '|').map(t => (t === '-' ? null : noteFreq(t)))
  const [pa, pb] = [beats(a), beats(b)]
  return [...pa, ...pa, ...pb, ...pa]
}

// Three made-up happy tunes in C major. One pitch per beat or a rest; the dance hall adds a drum on each bar.
export const TUNES: (number | null)[][] = [
  tune(
    'C5 E5 G5 E5 | F5 A5 G5 - | E5 G5 F5 D5 | C5 E5 C5 -',
    'A4 C5 F5 C5 | G4 B4 D5 G5 | E5 C5 D5 B4 | C5 - G4 -',
  ),
  tune(
    'G4 G4 C5 C5 | D5 D5 E5 - | F5 E5 D5 C5 | D5 - G4 -',
    'E5 E5 F5 F5 | G5 G5 A5 - | G5 F5 E5 D5 | C5 - - -',
  ),
  tune(
    'C5 G4 A4 G4 | C5 G4 E5 - | D5 C5 D5 E5 | C5 - - -',
    'F5 E5 D5 C5 | B4 C5 D5 - | E5 D5 C5 A4 | G4 - B4 -',
  ),
]
