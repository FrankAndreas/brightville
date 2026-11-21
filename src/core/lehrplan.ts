// The Lehrplan 21 (Zyklus 1) behind the game, for the parents' page: what each building practises, how far each
// subject is along (one bar each, from its ladders), and what was practised this week. Codes are the template's
// (v-fe.lehrplan.ch).
// The child never sees any of it.

import type { LogDay } from './diary'
import { LADDERS, share, type Ladder, type Ladders } from './ladders'
import { LETTERS } from './writing/letters'
import type { Letters } from './writing/levels'

/** The entwicklungsorientierte Zugänge of Zyklus 1 */
export const ZUGAENGE: Record<number, string> = {
  1: 'Körper, Gesundheit und Motorik',
  2: 'Wahrnehmung',
  3: 'Zeitliche Orientierung',
  4: 'Räumliche Orientierung',
  5: 'Zusammenhänge und Gesetzmässigkeiten',
  6: 'Fantasie und Kreativität',
  7: 'Lernen und Reflexion',
  8: 'Sprache und Kommunikation',
  9: 'Eigenständigkeit und soziales Handeln',
}
/** Mein Haus and the shops (9) aren't logged as visits: they can't show as practised */
const NOT_LOGGED = [9]

/** The subjects, in the order shown */
export const FACHBEREICHE: Record<string, string> = {
  MA: 'Mathematik',
  D: 'Deutsch',
  BG: 'Bildnerisches Gestalten',
  BS: 'Bewegung und Sport',
  MU: 'Musik',
}

export interface Tag {
  /** Kompetenz codes (MA.1.A.2) or a subject's short name (BG) */
  codes: string[]
  zugaenge: number[]
}

/** What each building practises; play buildings practise nothing on the list */
export const TAGS: Record<string, Tag> = {
  school: { codes: ['MA.1.A.2', 'MA.1.A.3'], zugaenge: [5, 8] },
  schreiben: { codes: ['D.4'], zugaenge: [8, 1] },
  bibliothek: { codes: ['D.1', 'D.6'], zugaenge: [8] },
  unterschiede: { codes: [], zugaenge: [2] },
  arcade: { codes: [], zugaenge: [2] },
  farblabor: { codes: ['BG'], zugaenge: [6, 5] },
  malen: { codes: ['BG'], zugaenge: [6] },
  ausmalen: { codes: ['BG'], zugaenge: [6] },
  yoga: { codes: ['BS'], zugaenge: [1] },
  huepfhalle: { codes: ['BS'], zugaenge: [1] },
  tanzsaal: { codes: ['BS', 'MU'], zugaenge: [1] },
  schlange: { codes: [], zugaenge: [] },
  bonbonjagd: { codes: [], zugaenge: [] },
  flatterflug: { codes: [], zugaenge: [] },
  reimhaus: { codes: ['D.1.A.1'], zugaenge: [8, 2] },
  muster: { codes: ['MA.1.B', 'MA.3'], zugaenge: [5, 2] },
  kalender: { codes: ['MA.3'], zugaenge: [3, 8] },
  spielwelt: { codes: ['MA.2'], zugaenge: [4, 2] },
  trommelhaus: { codes: ['MU'], zugaenge: [1, 2] },
  kino: { codes: [], zugaenge: [] },
  haus: { codes: [], zugaenge: [9] },
  laden: { codes: [], zugaenge: [9] },
  moebel: { codes: [], zugaenge: [9] },
}

/** A ladder as the parents' page shows it */
export interface LadderDef {
  name: string
  /** The subject it counts for (a key of FACHBEREICHE) */
  subject: string
  /** What each step asks, steps 1–5 and "fertig" */
  steps: string[]
  /** The step a child typically has reached at the end of Kindergarten (1–6) */
  kgStep: number
}

/**
 * Every ladder once: its name, its subject, its steps and where Kindergarten ends. The step texts, the subjects'
 * bars and their Kindergarten lines are all made from this table (the rules live in shared/ladders.json).
 */
export const LADDER_DEFS: Record<Ladder, LadderDef> = {
  zaehlen: {
    name: 'Zählen', subject: 'MA', kgStep: 3, // step 3 reached
    steps: [
      'bis 10 zählen, Würfel',
      'bis 20 zählen, was kommt danach',
      'vor- und rückwärts bis 20, in 2er-Schritten, Blitzblick',
      'bis 100 in 1er-, 2er-, 5er- und 10er-Schritten',
      'vor- und rückwärts bis 100',
      'fertig (Ende 2. Klasse)',
    ],
  },
  rechnen: {
    name: 'Rechnen', subject: 'MA', kgStep: 3, // step 3 reached
    steps: [
      'plus bis 5',
      'plus bis 10',
      'plus und minus bis 10, verdoppeln',
      'plus und minus bis 20',
      'Zehner bis 100 ohne Übertrag',
      'fertig (Ende 2. Klasse)',
    ],
  },
  muster: {
    name: 'Muster', subject: 'MA', kgStep: 4, // rows yes; gaps and two features are 1st grade
    steps: [
      'Reihen mit zwei Farben',
      'Reihen mit drei Farben',
      'Reihen mit Formen und Grössen',
      'Sortieren nach Farbe und Art',
      'Lücken, Grösse, zwei Merkmale',
      'fertig (Ende 2. Klasse)',
    ],
  },
  zeit: {
    name: 'Zeit', subject: 'MA', kgStep: 5, // the day, the week, yesterday and tomorrow, the seasons; the clock is 1st grade
    steps: [
      'Tagesablauf ordnen',
      'Morgen, Mittag, Abend, Nacht',
      'Wochentage',
      'gestern, morgen, Jahreszeiten',
      'volle und halbe Stunden',
      'fertig (Ende 2. Klasse)',
    ],
  },
  raum: {
    name: 'Raum', subject: 'MA', kgStep: 4, // auf to zwischen; links and rechts are 1st grade
    steps: [
      'auf, unter, in',
      'neben, vor, hinter',
      'zwischen',
      'links, rechts',
      'zwei Angaben zusammen',
      'fertig (Ende 2. Klasse)',
    ],
  },
  reimen: {
    name: 'Reimen', subject: 'D', kgStep: 6, // done: hearing rhymes, first sounds and syllables is a Kindergarten goal
    steps: [
      'reimt sich? aus zwei Bildern',
      'reimt sich? aus drei Bildern',
      'Anlaute: was fängt gleich an',
      'Silben trommeln bis 3',
      'Silben bis 4 und Anlaute gemischt',
      'fertig (Ende Kindergarten)',
    ],
  },
  rhythmus: {
    name: 'Rhythmus', subject: 'MU', kgStep: 4, // copying rhythms is 1st grade
    steps: [
      'Takt halten',
      'schnell und langsam',
      'laut und leise',
      'Rhythmen nachklatschen',
      'längere Rhythmen',
      'fertig (Ende 2. Klasse)',
    ],
  },
}

/** What each step asks, per ladder */
export const STEP_TEXT = Object.fromEntries(LADDERS.map(l => [l, LADDER_DEFS[l].steps])) as Record<Ladder, string[]>

const KNOWN = 4

/** The letters (not digits) she knows, as a share of all 29 */
export function lettersShare(letters: Letters): number {
  return LETTERS.filter(g => letters[g]?.level === KNOWN).length / LETTERS.length
}

/** How far she is in one subject: the average of its ladders (and, for Deutsch, the letters), in whole percent */
export interface SubjectProgress {
  code: string
  name: string
  /** 100 is the end of Zyklus 1 (end of 2nd grade) */
  percent: number
  /** Where Kindergarten typically ends, in percent */
  kg: number
  ladders: Ladder[]
  /** Schreiben's letters count here (Deutsch) */
  letters: boolean
}

/** Schreiben's letters count for Deutsch; writing starts in 1st grade, so their Kindergarten target is 0 */
const LETTERS_SUBJECT = 'D'

/** One bar per subject that has a ladder, in the subjects' order: no single number that every new ladder would move */
export function subjectProgress(ladders: Ladders, letters: Letters): SubjectProgress[] {
  return Object.entries(FACHBEREICHE).flatMap(([code, name]) => {
    const own = LADDERS.filter(l => LADDER_DEFS[l].subject === code)
    if (own.length === 0) return []
    const withLetters = code === LETTERS_SUBJECT
    const shares = [...own.map(l => share(ladders[l].step)), ...(withLetters ? [lettersShare(letters)] : [])]
    const targets = [...own.map(l => share(LADDER_DEFS[l].kgStep)), ...(withLetters ? [0] : [])]
    const mean = (xs: number[]) => Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100)
    return [{ code, name, percent: mean(shares), kg: mean(targets), ladders: own, letters: withLetters }]
  })
}

/** Today and the six days before, as "YYYY-MM-DD", today first */
export function weekDays(today: string): string[] {
  const [y, m, d] = today.split('-').map(Number)
  return Array.from({ length: 7 }, (_, k) => new Date(Date.UTC(y, m - 1, d - k)).toISOString().slice(0, 10))
}

export interface Visits { building: string; times: number }

/** This week's visits, free visits and rounds of play per building, in the order first seen */
function weekVisits(days: LogDay[], today: string): Map<string, number> {
  const week = new Set(weekDays(today))
  const times = new Map<string, number>()
  for (const d of days) {
    if (!week.has(d.day)) continue
    // Rounds of play count too (the Arcade's memory game is Wahrnehmung); purchases don't
    for (const e of d.entries) if (e.kind !== 'buy') times.set(e.building, (times.get(e.building) ?? 0) + 1)
  }
  return times
}

const visitsOf = (times: Map<string, number>, buildings: string[]): Visits[] =>
  buildings.filter(b => times.has(b)).map(b => ({ building: b, times: times.get(b) ?? 0 }))

/** This week by Zugang: the buildings visited, and whether any building practises it yet */
export function practice(days: LogDay[], today: string): { zugang: number; name: string; visits: Visits[]; hasBuilding: boolean }[] {
  const times = weekVisits(days, today)
  return Object.keys(ZUGAENGE).map(Number).filter(z => !NOT_LOGGED.includes(z)).map(z => {
    const buildings = Object.keys(TAGS).filter(b => TAGS[b].zugaenge.includes(z))
    return { zugang: z, name: ZUGAENGE[z], visits: visitsOf(times, buildings), hasBuilding: buildings.length > 0 }
  })
}

/** Every subject with this week's visits to the buildings that practise it */
export function subjects(days: LogDay[], today: string): { code: string; name: string; visits: Visits[] }[] {
  const times = weekVisits(days, today)
  return Object.entries(FACHBEREICHE).map(([code, name]) => {
    const buildings = Object.keys(TAGS).filter(b => TAGS[b].codes.some(c => c.split('.')[0] === code))
    return { code, name, visits: visitsOf(times, buildings) }
  })
}
