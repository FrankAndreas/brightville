import type { Lang } from '@/core/vocab/types'
import { againText, taskText, type RaumTask } from './raum'
import { delta, describe as describeDe, holds, nounPhrase, THINGS, type Clue, type Place, type Word, type WorldObject } from './world'

// The Spielwelt's sentences, in German (her Kindergarten Spielwelt, exactly as before) and in English and French for
// the Oberstufe. A clue is said by its position word and object; "left of" / "right of" as seen on the screen.

/** Everything the Spielwelt says, in one language */
export interface WorldTexts {
  /** "Put the ball under the table." / "The cat is behind the tree. Can you find it?" */
  task(task: RaumTask): string
  /** Again, with only the clues still to be met: "Put it under the table." */
  again(task: RaumTask, clues: Clue[]): string
  /** Where a thing he let go of lies now: "The ball is now on the bed." */
  describe(thingId: string, place: Place, objects: WorldObject[]): string
  /** He tapped the wrong thing: "That's the duck." */
  thatIs(thingId: string): string
  /** He found it: "Great! There's the cat!" */
  found(thingId: string): string
  cheer: string
  /** After the five tasks */
  free: string
}

const thingDe = (id: string, kase: 'nom' | 'acc') => {
  const t = THINGS.find(x => x.id === id)
  return t ? nounPhrase(t, kase) : id
}

/** Her Kindergarten Spielwelt's German, as it always was */
export const GERMAN_TEXTS: WorldTexts = {
  task: taskText,
  again: (task, clues) => againText(task, clues),
  describe: (id, place, objects) => describeDe(id, place, objects),
  thatIs: id => `Das ist ${thingDe(id, 'nom')}.`,
  found: id => `Super! Da ist ${thingDe(id, 'nom')}!`,
  cheer: 'Super!',
  free: 'Super gemacht! Jetzt darfst du frei spielen.',
}

export const EN_NOUNS: Record<string, string> = {
  bett: 'bed', tisch: 'table', schrank: 'cupboard', kiste: 'box', baum: 'tree', bank: 'bench', zaun: 'fence',
  bruecke: 'bridge', rutschbahn: 'slide', sandkasten: 'sandpit', schaukel: 'swing', garage: 'garage', auto: 'car',
  stein: 'stone', busch: 'bush', hundehuette: 'kennel',
  ball: 'ball', teddy: 'teddy bear', katze: 'cat', ente: 'duck', eimer: 'bucket', buch: 'book', hut: 'hat', apfel: 'apple',
}

export const FR_NOUNS: Record<string, { noun: string; gender: 'm' | 'f' }> = {
  bett: { noun: 'lit', gender: 'm' }, tisch: { noun: 'table', gender: 'f' }, schrank: { noun: 'armoire', gender: 'f' },
  kiste: { noun: 'caisse', gender: 'f' }, baum: { noun: 'arbre', gender: 'm' }, bank: { noun: 'banc', gender: 'm' },
  zaun: { noun: 'clôture', gender: 'f' }, bruecke: { noun: 'pont', gender: 'm' }, rutschbahn: { noun: 'toboggan', gender: 'm' },
  sandkasten: { noun: 'bac à sable', gender: 'm' }, schaukel: { noun: 'balançoire', gender: 'f' },
  garage: { noun: 'garage', gender: 'm' }, auto: { noun: 'voiture', gender: 'f' }, stein: { noun: 'pierre', gender: 'f' },
  busch: { noun: 'buisson', gender: 'm' }, hundehuette: { noun: 'niche', gender: 'f' },
  ball: { noun: 'ballon', gender: 'm' }, teddy: { noun: 'ours en peluche', gender: 'm' }, katze: { noun: 'chat', gender: 'm' },
  ente: { noun: 'canard', gender: 'm' }, eimer: { noun: 'seau', gender: 'm' }, buch: { noun: 'livre', gender: 'm' },
  hut: { noun: 'chapeau', gender: 'm' }, apfel: { noun: 'pomme', gender: 'f' },
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

const EN_WORDS: Record<Word, string> = {
  auf: 'on', unter: 'under', in: 'in', neben: 'next to', vor: 'in front of', hinter: 'behind', zwischen: 'between',
  'links neben': 'to the left of', 'rechts neben': 'to the right of',
}
const theEn = (id: string) => `the ${EN_NOUNS[id]}`
const clueEn = (c: Clue) =>
  c.word === 'zwischen' ? `between ${theEn(c.object)} and ${theEn(c.other ?? '')}` : `${EN_WORDS[c.word]} ${theEn(c.object)}`

/** French words that take "de" (à côté de, à gauche de, à droite de) contract with the article */
const FR_WORDS: Record<Word, { word: string; de?: true }> = {
  auf: { word: 'sur' }, unter: { word: 'sous' }, in: { word: 'dans' }, neben: { word: 'à côté', de: true },
  vor: { word: 'devant' }, hinter: { word: 'derrière' }, zwischen: { word: 'entre' },
  'links neben': { word: 'à gauche', de: true }, 'rechts neben': { word: 'à droite', de: true },
}
/** Elided before a vowel ("l'arbre"). No noun here starts with h: a mute-h noun would need adding here by hand, since an
 *  aspirated h ("le hamac") is not elided */
const startsWithVowel = (s: string) => /^[aeiouâàéèêîïôûœ]/i.test(s)
/** "le lit", "la table", "l'arbre" */
function theFr(id: string): string {
  const { noun, gender } = FR_NOUNS[id]
  if (startsWithVowel(noun)) return `l'${noun}`
  return `${gender === 'm' ? 'le' : 'la'} ${noun}`
}
/** "du lit", "de la table", "de l'arbre" */
function ofFr(id: string): string {
  const the = theFr(id)
  return the.startsWith('le ') ? `du ${the.slice(3)}` : `de ${the}`
}
function clueFr(c: Clue): string {
  if (c.word === 'zwischen') return `entre ${theFr(c.object)} et ${theFr(c.other ?? '')}`
  const w = FR_WORDS[c.word]
  return w.de ? `${w.word} ${ofFr(c.object)}` : `${w.word} ${theFr(c.object)}`
}
const pronounFr = (id: string) => (FR_NOUNS[id].gender === 'm' ? 'le' : 'la')

/** The one clue that says best where a thing lies now (as the German describe does), or none: on the ground */
function whereNow(place: Place, objects: WorldObject[]): Clue | null {
  if (place.on) return { word: 'auf', object: place.on }
  if (place.inside) return { word: 'in', object: place.inside }
  if (place.under) return { word: 'unter', object: place.under }
  const closest = objects.reduce((a, b) => (Math.abs(delta(a.x, place.x)) <= Math.abs(delta(b.x, place.x)) ? a : b))
  for (const word of ['vor', 'hinter', 'neben'] as Word[]) {
    if (holds(place, { word, object: closest.id }, objects)) return { word, object: closest.id }
  }
  return null
}

const ENGLISH: WorldTexts = {
  task: task => {
    const clues = task.clues.map(clueEn).join(' and ')
    return task.type === 'place' ? `Put ${theEn(task.thing)} ${clues}.` : `${capital(theEn(task.thing))} is ${clues}. Can you find it?`
  },
  again: (_task, clues) => `Put it ${clues.map(clueEn).join(' and ')}.`,
  describe: (id, place, objects) => {
    const clue = whereNow(place, objects)
    return `${capital(theEn(id))} is now ${clue ? clueEn(clue) : 'on the ground'}.`
  },
  thatIs: id => `That's ${theEn(id)}.`,
  found: id => `Great! There's ${theEn(id)}!`,
  cheer: 'Great!',
  free: 'Well done! Now you can play as you like.',
}

const FRENCH: WorldTexts = {
  task: task => {
    const clues = task.clues.map(clueFr).join(' et ')
    return task.type === 'place'
      ? `Mets ${theFr(task.thing)} ${clues}.`
      : `${capital(theFr(task.thing))} est ${clues}. Tu ${pronounFr(task.thing)} trouves?`
  },
  again: (task, clues) => `Mets-${pronounFr(task.thing)} ${clues.map(clueFr).join(' et ')}.`,
  describe: (id, place, objects) => {
    const clue = whereNow(place, objects)
    return `${capital(theFr(id))} est maintenant ${clue ? clueFr(clue) : 'par terre'}.`
  },
  thatIs: id => `C'est ${theFr(id)}.`,
  found: id => `Super! Voilà ${theFr(id)}!`,
  cheer: 'Super!',
  free: 'Bravo! Maintenant, tu peux jouer comme tu veux.',
}

/** The Spielwelt's sentences in a language */
export function worldTexts(lang: Lang): WorldTexts {
  return lang === 'en' ? ENGLISH : FRENCH
}
