// The Lehrplan 21 (Zyklus 1) behind the game, for the parents' page: what each building practises, how far the
// six measured parts are, and what was practised this week. Codes are the template's (v-fe.lehrplan.ch).
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
/** Walking the town (4), Mein Haus and the shops (9) aren't logged as visits: they can't show as practised */
const NOT_LOGGED = [4, 9]

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
  kino: { codes: [], zugaenge: [] },
  haus: { codes: [], zugaenge: [9] },
  laden: { codes: [], zugaenge: [9] },
  moebel: { codes: [], zugaenge: [9] },
}

/** What each step asks, steps 1–5 and "fertig" */
export const STEP_TEXT: Record<Ladder, string[]> = {
  zaehlen: [
    'bis 10 zählen, Würfel',
    'bis 20 zählen, was kommt danach',
    'vor- und rückwärts bis 20, in 2er-Schritten, Blitzblick',
    'bis 100 in 1er-, 2er-, 5er- und 10er-Schritten',
    'vor- und rückwärts bis 100',
    'fertig (Ende 2. Klasse)',
  ],
  rechnen: [
    'plus bis 5',
    'plus bis 10',
    'plus und minus bis 10, verdoppeln',
    'plus und minus bis 20',
    'Zehner bis 100 ohne Übertrag',
    'fertig (Ende 2. Klasse)',
  ],
  reimen: [
    'reimt sich? aus zwei Bildern',
    'reimt sich? aus drei Bildern',
    'Anlaute: was fängt gleich an',
    'Silben klatschen bis 3',
    'Silben bis 4 und Anlaute gemischt',
    'fertig (Ende Kindergarten)',
  ],
  muster: [
    'Reihen mit zwei Farben',
    'Reihen mit drei Farben',
    'Reihen mit Formen und Grössen',
    'Sortieren nach Farbe und Art',
    'Lücken, Grösse, zwei Merkmale',
    'fertig (Ende 2. Klasse)',
  ],
  zeit: [
    'Tagesablauf ordnen',
    'Morgen, Mittag, Abend, Nacht',
    'Wochentage',
    'gestern, morgen, Jahreszeiten',
    'volle und halbe Stunden',
    'fertig (Ende 2. Klasse)',
  ],
}

/**
 * Where Kindergarten typically ends on each ladder: Zählen and Rechnen step 3 reached, Reimen done (hearing rhymes,
 * first sounds and syllables is a Kindergarten goal), Muster step 4 reached (rows yes; gaps and two features are 1st
 * grade), Zeit step 5 reached (the day, the week, yesterday and tomorrow, the seasons; the clock is 1st grade), writing
 * starts in 1st grade
 */
export const KG_TARGETS: Record<Ladder | 'letters', number> = { zaehlen: 0.4, rechnen: 0.4, reimen: 1, muster: 0.6, zeit: 0.8, letters: 0 }
const PARTS = Object.keys(KG_TARGETS).length
const KNOWN = 4

/** The end of Kindergarten on the overall bar, in percent */
export function kgMark(): number {
  return Math.round((Object.values(KG_TARGETS).reduce((a, b) => a + b, 0) / PARTS) * 100)
}

/** The letters (not digits) she knows, as a share of all 29 */
export function lettersShare(letters: Letters): number {
  return LETTERS.filter(g => letters[g]?.level === KNOWN).length / LETTERS.length
}

/** One number: the ladders' and the letters' average share, in whole percent; 100 is the end of Zyklus 1 */
export function overall(ladders: Ladders, letters: Letters): number {
  const shares = LADDERS.reduce((sum, l) => sum + share(ladders[l].step), 0) + lettersShare(letters)
  return Math.round((shares / PARTS) * 100)
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
