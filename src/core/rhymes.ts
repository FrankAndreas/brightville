// The Reimhaus's words and the tasks of a visit: rhymes, first sounds and syllables (Lehrplan 21 D.1.A.1). Everything
// is spoken; each word has a picture with one obvious Standard German name. The ladder's steps are the design's table
// (docs/superpowers/specs/2026-11-20-brightville-reimhaus-design.md).

import { WINDOW } from './ladders'
export interface Word {
  id: string
  /** What the voice says */
  say: string
  emoji: string
  /** Written pieces the voice says apart; they join to the word */
  syllables: string[]
  /** Words with the same value rhyme */
  rhyme?: string
  /** The first sound ('S', 'Sch', 'M' …), only where it is clear and at least three words share it */
  sound?: string
  /** How it starts to the ear (St and Sp as Sch, Au as A): a wrong picture never starts like the asked word */
  start: string
}

export type RhymeTask =
  /** `answer`: the right picture's word id */
  | { type: 'rhyme' | 'sound'; word: Word; choices: Word[]; answer: string }
  | { type: 'syllables'; word: Word; answer: number }

/** Shown before the first task while she is new to a step: said, with its pictures, nothing to tap; a syllable
 * example then drums its word */
export interface Example {
  kind: RhymeTask['type']
  words: Word[]
  text: string
  /** Syllables: the drum lights up this many times */
  beats?: number
}

export const TASKS_PER_VISIT = 5
const LAST_STEP = 6

/** [say, emoji, syllables joined by '-', rhyme] */
const LIST: [string, string, string, string?][] = [
  ['Maus', '🐭', 'Maus', 'aus'], ['Haus', '🏠', 'Haus', 'aus'], ['Strauß', '💐', 'Strauß', 'aus'],
  ['Hose', '👖', 'Ho-se', 'ose'], ['Rose', '🌹', 'Ro-se', 'ose'],
  ['Hand', '✋', 'Hand', 'and'], ['Strand', '🏖️', 'Strand', 'and'],
  ['Kuh', '🐮', 'Kuh', 'uh'], ['Schuh', '👟', 'Schuh', 'uh'],
  ['Hase', '🐰', 'Ha-se', 'ase'], ['Nase', '👃', 'Na-se', 'ase'],
  ['Socke', '🧦', 'So-cke', 'ocke'], ['Glocke', '🔔', 'Glo-cke', 'ocke'],
  ['Igel', '🦔', 'I-gel', 'igel'], ['Spiegel', '🪞', 'Spie-gel', 'igel'],
  ['Bein', '🦵', 'Bein', 'ein'], ['Schwein', '🐷', 'Schwein', 'ein'], ['Stein', '🪨', 'Stein', 'ein'],
  ['Boot', '⛵', 'Boot', 'ot'], ['Brot', '🍞', 'Brot', 'ot'],
  ['Tee', '🍵', 'Tee', 'ee'], ['Schnee', '❄️', 'Schnee', 'ee'], ['Klee', '🍀', 'Klee', 'ee'],
  ['Hund', '🐶', 'Hund', 'und'], ['Mund', '👄', 'Mund', 'und'],
  ['Zahn', '🦷', 'Zahn', 'ahn'], ['Hahn', '🐓', 'Hahn', 'ahn'],
  ['Sonne', '☀️', 'Son-ne'], ['Sofa', '🛋️', 'So-fa'], ['Salat', '🥗', 'Sa-lat'],
  ['Mond', '🌙', 'Mond'], ['Muschel', '🐚', 'Mu-schel'],
  ['Banane', '🍌', 'Ba-na-ne'], ['Bär', '🐻', 'Bär'], ['Baum', '🌳', 'Baum'], ['Buch', '📖', 'Buch'],
  ['Bus', '🚌', 'Bus'], ['Biene', '🐝', 'Bie-ne'],
  ['Fisch', '🐟', 'Fisch'], ['Frosch', '🐸', 'Frosch'], ['Feder', '🪶', 'Fe-der'], ['Fuchs', '🦊', 'Fuchs'],
  ['Fliege', '🪰', 'Flie-ge'], ['Hut', '🎩', 'Hut'],
  ['Käse', '🧀', 'Kä-se'], ['Kerze', '🕯️', 'Ker-ze'], ['Krone', '👑', 'Kro-ne'], ['Kuchen', '🍰', 'Ku-chen'],
  ['Tomate', '🍅', 'To-ma-te'], ['Tiger', '🐯', 'Ti-ger'],
  ['Löwe', '🦁', 'Lö-we'], ['Leiter', '🪜', 'Lei-ter'], ['Löffel', '🥄', 'Löf-fel'],
  ['Rakete', '🚀', 'Ra-ke-te'], ['Regenbogen', '🌈', 'Re-gen-bo-gen'], ['Ring', '💍', 'Ring'],
  ['Zitrone', '🍋', 'Zi-tro-ne'], ['Zebra', '🦓', 'Ze-bra'],
  ['Nashorn', '🦏', 'Nas-horn'], ['Geschenk', '🎁', 'Ge-schenk'], ['Gurke', '🥒', 'Gur-ke'], ['Drache', '🐉', 'Dra-che'],
  ['Apfel', '🍎', 'Ap-fel'], ['Ananas', '🍍', 'A-na-nas'], ['Ameise', '🐜', 'A-mei-se'],
  ['Auto', '🚗', 'Au-to'], ['Elefant', '🐘', 'E-le-fant'], ['Wolke', '☁️', 'Wol-ke'],
  ['Schildkröte', '🐢', 'Schild-krö-te'], ['Kartoffel', '🥔', 'Kar-tof-fel'],
  ['Schere', '✂️', 'Sche-re'], ['Schnecke', '🐌', 'Schne-cke'], ['Schlange', '🐍', 'Schlan-ge'],
  ['Schokolade', '🍫', 'Scho-ko-la-de'], ['Sonnenblume', '🌻', 'Son-nen-blu-me'],
  ['Avocado', '🥑', 'A-vo-ca-do'],
]

/** The first sound as she hears it; none where a written start hides it (St, Sp, Ei, Au …) or a vowel isn't A */
function firstSound(say: string): string | undefined {
  if (/^Sch/.test(say)) return 'Sch'
  if (/^(St|Sp|Ei|Eu|Au|Äu|V|Ch|Ph|Qu)/.test(say)) return undefined
  const first = say[0]
  if (/[EIOUÄÖÜ]/.test(first)) return undefined
  return first
}

/** How a word starts to the ear, to keep wrong pictures from starting the same way */
function heardStart(say: string): string {
  if (/^(Sch|St|Sp)/.test(say)) return 'Sch'
  if (/^Au/.test(say)) return 'A'
  if (/^(Eu|Äu)/.test(say)) return 'Eu'
  if (/^Ei/.test(say)) return 'Ei'
  return say[0]
}

const toId = (say: string) =>
  say.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')

const RAW: Word[] = LIST.map(([say, emoji, syllables, rhyme]) => ({
  id: toId(say), say, emoji, syllables: syllables.split('-'), rhyme, sound: firstSound(say), start: heardStart(say),
}))
/** A first sound only three words or more share is asked */
const SOUNDS = new Set(
  [...new Set(RAW.map(w => w.sound))].filter(s => s && RAW.filter(w => w.sound === s).length >= 3),
)
export const WORDS: Word[] = RAW.map(w => (w.sound && SOUNDS.has(w.sound) ? w : { ...w, sound: undefined }))

const byId = (id: string) => WORDS.find(w => w.id === id) as Word

function pick<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)]
}
function shuffle<T>(items: T[], random: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const rhymes = (a: Word, b: Word) => a.rhyme !== undefined && a.rhyme === b.rhyme
const sameSound = (a: Word, b: Word) => a.sound !== undefined && a.sound === b.sound
/** Pictures that are plainly wrong: neither rhyme nor first sound in common with the asked word, not even to the ear */
const others = (word: Word) =>
  WORDS.filter(w => w.id !== word.id && !rhymes(w, word) && !sameSound(w, word) && w.start !== word.start)

/** Syllables as the voice should say them, apart: a piece alone like "cke" would be spelled out, "ke" is said */
export function sayAsHeard(syllables: string[]): string {
  return syllables.map(s => s.replace(/^ck/, 'k').replace(/^c(?=[aou])/, 'k')).join(' – ')
}
export const spokenSyllables = (word: Word) => sayAsHeard(word.syllables)

function pictureTask(type: 'rhyme' | 'sound', choiceCount: number, used: Set<string>, random: () => number): RhymeTask {
  const fits = (w: Word, x: Word) => (type === 'rhyme' ? rhymes(w, x) : sameSound(w, x) && !rhymes(w, x))
  const askable = WORDS.filter(w => !used.has(w.id) && WORDS.some(x => x.id !== w.id && fits(w, x)))
  const word = pick(askable, random)
  const right = pick(WORDS.filter(x => x.id !== word.id && fits(word, x)), random)
  const wrong = shuffle(others(word), random).slice(0, choiceCount - 1)
  return { type, word, choices: shuffle([right, ...wrong], random), answer: right.id }
}

function syllableTask(max: number, used: Set<string>, random: () => number, count?: number): RhymeTask {
  const n = count ?? 1 + Math.floor(random() * max)
  const word = pick(WORDS.filter(w => !used.has(w.id) && w.syllables.length === n), random)
  return { type: 'syllables', word, answer: n }
}

type Maker = (used: Set<string>, random: () => number) => RhymeTask
const rhyme = (choices: number): Maker => (used, random) => pictureTask('rhyme', choices, used, random)
const sound: Maker = (used, random) => pictureTask('sound', 3, used, random)
const syllables = (max: number, count?: number): Maker => (used, random) => syllableTask(max, used, random, count)

/** What each step asks, in order */
const STEPS: Maker[][] = [
  Array(5).fill(rhyme(2)),
  Array(5).fill(rhyme(3)),
  Array(5).fill(sound),
  Array(5).fill(syllables(3)),
  [syllables(4, 4), sound, syllables(4), sound, syllables(4)],
  [rhyme(3), syllables(4), sound, rhyme(3), syllables(4)],
]

/** The five tasks of a visit at `step` (1–5, 6 = "fertig"); no word is asked twice */
export function buildRhymeSession(step: number, random: () => number = Math.random): RhymeTask[] {
  const makers = STEPS[Math.min(Math.max(step, 1), LAST_STEP) - 1]
  const used = new Set<string>()
  return makers.map(make => {
    const task = make(used, random)
    used.add(task.word.id)
    return task
  })
}

const syllableExample = (id: string, count: string): Example => {
  const word = byId(id)
  const said = spokenSyllables(word)
  return {
    kind: 'syllables', words: [word], beats: word.syllables.length,
    text: `${said}. Hör mal: ${said}. ${count} Silben. Ich trommle mit:`,
  }
}

/** The example before the first task: at steps 1–5 while her answers at the step are fewer than two visits' worth */
export function exampleFor(step: number, windowLength: number): Example | null {
  if (step >= LAST_STEP || windowLength >= WINDOW.reimen) return null
  if (step <= 2) {
    return {
      kind: 'rhyme', words: [byId('maus'), byId('haus')],
      text: 'Maus – Haus. Hör mal: Maus, Haus. Das klingt am Ende gleich. Das reimt sich!',
    }
  }
  if (step === 3) {
    return { kind: 'sound', words: [byId('sonne'), byId('sofa')], text: 'Sonne – Sofa. Sonne, Sofa: die fangen gleich an!' }
  }
  return step === 4 ? syllableExample('banane', 'Drei') : syllableExample('schokolade', 'Vier')
}
