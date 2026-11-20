// The Kalender's tasks: the order of a day, morning to night, the days of the week, yesterday and tomorrow from the
// real day, the seasons and the full and half hours (Lehrplan 21 MA.3, Zugang 3). Everything is said aloud; the
// ladder's steps are the design's table (docs/superpowers/specs/2026-11-20-brightville-kalender-design.md).

import { WINDOW } from './ladders'
import { numberWord } from './numbers'
import { pick, shuffle } from './random'

export const DAYS = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']
/** Each day keeps its colour, in the week strip and on the cards */
export const DAY_COLOURS = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#ec407a']

export type TimeOfDay = 'morgen' | 'mittag' | 'abend' | 'nacht'
export type Season = 'fruehling' | 'sommer' | 'herbst' | 'winter'
export interface ClockTime { hour: number; half: boolean }
export interface Activity {
  id: string
  say: string
  emoji: string
  /** A small sign of the time of day on the picture (☀️ midday, 🌙 evening) */
  badge?: string
}

export type Choice = { id: string; say: string } & (
  | { kind: 'sun'; time: TimeOfDay }
  | { kind: 'day'; day: number }
  | { kind: 'season'; season: Season; emoji: string }
  | { kind: 'clock'; clock: ClockTime })

export type ZeitTask =
  /** `items` in the right order, `shown` shuffled */
  | { type: 'order'; items: Activity[]; shown: Activity[] }
  /**
   * `answer`: the right choice's id. Day questions: `focus` is the day the question names (lit in the week strip),
   * `aboutToday` whether it asks about today (only then the strip shows today's sun)
   */
  | {
    type: 'pick'; topic: 'time' | 'day' | 'season' | 'clock'; question: string; choices: Choice[]; answer: string
    focus?: number; aboutToday?: boolean
  }

export interface ExampleLine {
  text: string
  light?: string
  /** An order picture moves into its place */
  place?: string
  /** The example's clock shows this time */
  clock?: ClockTime
}
export interface ZeitExample { task: ZeitTask; lines: ExampleLine[] }

export const TASKS_PER_VISIT = 5
const LAST_STEP = 6

/**
 * Things every child does every day, in one order only (not anziehen: many have breakfast first; not Zähne putzen,
 * spielen or baden: they come at several times). The pictures carry their time: an alarm clock, a sun, a moon.
 */
const ACTIVITIES: Activity[] = [
  { id: 'aufstehen', say: 'aufstehen', emoji: '⏰' },
  { id: 'fruehstuecken', say: 'frühstücken', emoji: '🥣' },
  { id: 'mittagessen', say: 'zu Mittag essen', emoji: '🍝', badge: '☀️' },
  { id: 'abendessen', say: 'zu Abend essen', emoji: '🍲', badge: '🌙' },
  { id: 'schlafen', say: 'schlafen', emoji: '🛏️' },
]

const TIME_WORD: Record<TimeOfDay, string> = { morgen: 'Morgen', mittag: 'Mittag', abend: 'Abend', nacht: 'Nacht' }
const TIMES: TimeOfDay[] = ['morgen', 'mittag', 'abend', 'nacht']
/** Questions with one clear answer only */
const TIME_QUESTIONS: [string, TimeOfDay][] = [
  ['Wann frühstückst du?', 'morgen'], ['Wann geht die Sonne auf?', 'morgen'],
  ['Wann isst du zu Mittag?', 'mittag'], ['Wann steht die Sonne ganz hoch?', 'mittag'],
  ['Wann geht die Sonne unter?', 'abend'], ['Wann isst du zu Abend?', 'abend'],
  ['Wann scheint der Mond?', 'nacht'], ['Wann schlafen alle tief?', 'nacht'],
]

const SEASONS: Season[] = ['fruehling', 'sommer', 'herbst', 'winter']
const SEASON_WORD: Record<Season, string> = { fruehling: 'Frühling', sommer: 'Sommer', herbst: 'Herbst', winter: 'Winter' }
const SEASON_EMOJI: Record<Season, string> = { fruehling: '🌷', sommer: '☀️', herbst: '🍂', winter: '⛄' }
const SEASON_QUESTIONS: [string, Season][] = [
  ['Wann fällt Schnee?', 'winter'], ['Wann blühen die ersten Blumen?', 'fruehling'],
  ['Wann ist es am heissesten?', 'sommer'], ['Wann fallen die Blätter von den Bäumen?', 'herbst'],
]

/** Monday 0 … Sunday 6 */
export const weekdayOf = (date: Date) => (date.getDay() + 6) % 7

/** As in the Kindergarten's calendar: spring from 21 March, summer from 21 June, autumn from 23 September, winter from 21 December */
export function seasonOf(date: Date): Season {
  const at = (date.getMonth() + 1) * 100 + date.getDate()
  if (at >= 321 && at < 621) return 'fruehling'
  if (at >= 621 && at < 923) return 'sommer'
  if (at >= 923 && at < 1221) return 'herbst'
  return 'winter'
}

/** "drei Uhr", "ein Uhr", "halb vier" (3:30), "halb eins" (12:30) */
export function clockName(t: ClockTime): string {
  if (t.half) return `halb ${numberWord((t.hour % 12) + 1)}`
  return t.hour === 1 ? 'ein Uhr' : `${numberWord(t.hour)} Uhr`
}

const sunChoice = (time: TimeOfDay): Choice => ({ id: time, say: TIME_WORD[time], kind: 'sun', time })
const dayChoice = (day: number): Choice => ({ id: `day-${day}`, say: DAYS[day], kind: 'day', day })
const seasonChoice = (season: Season): Choice =>
  ({ id: season, say: SEASON_WORD[season], kind: 'season', season, emoji: SEASON_EMOJI[season] })
const clockChoice = (clock: ClockTime): Choice =>
  ({ id: `clock-${clock.hour}-${clock.half ? 30 : 0}`, say: clockName(clock), kind: 'clock', clock })

type Maker = (random: () => number, today: Date) => ZeitTask

const order: Maker = random => {
  const items = shuffle(ACTIVITIES, random).slice(0, 4).sort((a, b) => ACTIVITIES.indexOf(a) - ACTIVITIES.indexOf(b))
  let shown = shuffle(items, random)
  while (shown.every((x, i) => x === items[i])) shown = shuffle(items, random)
  return { type: 'order', items, shown }
}

const time: Maker = random => {
  const [question, answer] = pick(TIME_QUESTIONS, random)
  return { type: 'pick', topic: 'time', question, choices: TIMES.map(sunChoice), answer }
}

/** Three day cards: the right one and two others; `focus` the day the question names */
function dayPick(question: string, answer: number, focus: number, aboutToday: boolean, random: () => number): ZeitTask {
  const others = shuffle([0, 1, 2, 3, 4, 5, 6].filter(d => d !== answer), random).slice(0, 2)
  const choices = shuffle([answer, ...others], random).map(dayChoice)
  return { type: 'pick', topic: 'day', question, choices, answer: `day-${answer}`, focus, aboutToday }
}

const week: Maker = random => {
  const day = Math.floor(random() * 7)
  return random() < 0.5
    ? dayPick(`Was kommt nach ${DAYS[day]}?`, (day + 1) % 7, day, false, random)
    : dayPick(`Was kommt vor ${DAYS[day]}?`, (day + 6) % 7, day, false, random)
}

const yesterdayOrTomorrow: Maker = (random, today) => {
  const d = weekdayOf(today)
  return random() < 0.5
    ? dayPick(`Heute ist ${DAYS[d]}. Was war gestern?`, (d + 6) % 7, d, true, random)
    : dayPick(`Heute ist ${DAYS[d]}. Was ist morgen?`, (d + 1) % 7, d, true, random)
}

const season: Maker = (random, today) => {
  const questions: [string, Season][] = [...SEASON_QUESTIONS, ['Welche Jahreszeit haben wir jetzt?', seasonOf(today)]]
  const [question, answer] = pick(questions, random)
  return { type: 'pick', topic: 'season', question, choices: SEASONS.map(seasonChoice), answer }
}

const clock: Maker = random => {
  const right: ClockTime = { hour: 1 + Math.floor(random() * 12), half: random() < 0.5 }
  const flipped: ClockTime = { ...right, half: !right.half }
  const next: ClockTime = { ...right, hour: random() < 0.5 ? (right.hour % 12) + 1 : ((right.hour + 10) % 12) + 1 }
  const choices = shuffle([right, flipped, next], random).map(clockChoice)
  return { type: 'pick', topic: 'clock', question: `Welche Uhr zeigt ${clockName(right)}?`, choices, answer: clockChoice(right).id }
}

const STEPS: Maker[][] = [
  Array(5).fill(order),
  Array(5).fill(time),
  Array(5).fill(week),
  [yesterdayOrTomorrow, season, yesterdayOrTomorrow, season, season],
  [clock, yesterdayOrTomorrow, clock, season, clock],
  [time, week, clock, (r, t) => (r() < 0.5 ? yesterdayOrTomorrow(r, t) : season(r, t)), clock],
]

const keyOf = (t: ZeitTask) => (t.type === 'order' ? t.items.map(i => i.id).join() : t.question)

/** The five tasks of a visit at `step` (1–5, 6 = "fertig") on the day `today`; never the same question twice */
export function buildZeitSession(step: number, today: Date, random: () => number = Math.random): ZeitTask[] {
  const makers = STEPS[Math.min(Math.max(step, 1), LAST_STEP) - 1]
  const seen = new Set<string>()
  return makers.map(make => {
    let task = make(random, today)
    for (let tries = 0; seen.has(keyOf(task)) && tries < 100; tries++) task = make(random, today)
    seen.add(keyOf(task))
    return task
  })
}

const byId = (id: string) => ACTIVITIES.find(a => a.id === id) as Activity

/** The example before the first task: at steps 1–5 while her answers at the step are fewer than two visits' worth */
export function exampleFor(step: number, windowLength: number, today: Date): ZeitExample | null {
  if (step >= LAST_STEP || windowLength >= WINDOW.zeit) return null
  if (step === 1) {
    const items = ['aufstehen', 'fruehstuecken', 'mittagessen', 'schlafen'].map(byId)
    return {
      task: { type: 'order', items, shown: [items[2], items[0], items[3], items[1]] },
      lines: [
        { text: 'Schau: zuerst stehst du auf,', place: 'aufstehen', light: 'item-aufstehen' },
        { text: 'dann frühstückst du,', place: 'fruehstuecken', light: 'item-fruehstuecken' },
        { text: 'dann isst du zu Mittag,', place: 'mittagessen', light: 'item-mittagessen' },
        { text: 'und am Abend gehst du schlafen.', place: 'schlafen', light: 'item-schlafen' },
      ],
    }
  }
  if (step === 2) {
    return {
      task: { type: 'pick', topic: 'time', question: '', choices: TIMES.map(sunChoice), answer: 'morgen' },
      lines: [
        { text: 'Am Morgen geht die Sonne auf.', light: 'choice-morgen' },
        { text: 'Am Mittag steht sie hoch oben.', light: 'choice-mittag' },
        { text: 'Am Abend geht sie unter.', light: 'choice-abend' },
        { text: 'In der Nacht scheint der Mond.', light: 'choice-nacht' },
      ],
    }
  }
  const strip: ZeitTask = { type: 'pick', topic: 'day', question: '', choices: [], answer: '', aboutToday: step === 4 }
  if (step === 3) {
    return { task: strip, lines: [{ text: 'Die Woche hat sieben Tage:' }, ...DAYS.map((text, i) => ({ text, light: `strip-${i}` }))] }
  }
  if (step === 4) {
    const d = weekdayOf(today)
    return {
      task: strip,
      lines: [
        { text: `Heute ist ${DAYS[d]}.`, light: `strip-${d}` },
        { text: `Gestern war ${DAYS[(d + 6) % 7]}.`, light: `strip-${(d + 6) % 7}` },
        { text: `Morgen ist ${DAYS[(d + 1) % 7]}.`, light: `strip-${(d + 1) % 7}` },
      ],
    }
  }
  return {
    task: { type: 'pick', topic: 'clock', question: '', choices: [], answer: '' },
    lines: [
      { text: 'Der kurze Zeiger zeigt die Stunde.', clock: { hour: 3, half: false } },
      { text: 'Steht der lange Zeiger oben, ist es genau drei Uhr.' },
      { text: 'Steht der lange Zeiger unten, ist es halb vier.', clock: { hour: 3, half: true } },
    ],
  }
}
