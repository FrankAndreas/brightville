import { numberWord } from './numbers'
import { stickerDef } from './stickers'

/** One thing done on a day: an earning visit (+Stars), a round of play (−Stars) or a free visit */
export interface LogEntry {
  building: string
  kind: 'visit' | 'play' | 'free'
  stars: number
  /** "HH:MM" at home */
  at: string
}

/** A page of the logbook */
export interface LogDay {
  /** "YYYY-MM-DD" at home */
  day: string
  goal_reached: boolean
  entries: LogEntry[]
  /** Sticker ids earned that day */
  stickers: string[]
  /** Paintings last changed that day */
  paintings: { id: string; updated: number }[]
}

// The words of the logbook: days and entries as the voice says them, and as one line of text for the parents.

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
const ORDINALS = [
  '', 'erster', 'zweiter', 'dritter', 'vierter', 'fünfter', 'sechster', 'siebter', 'achter', 'neunter', 'zehnter',
  'elfter', 'zwölfter', 'dreizehnter', 'vierzehnter', 'fünfzehnter', 'sechzehnter', 'siebzehnter', 'achtzehnter',
  'neunzehnter', 'zwanzigster', 'einundzwanzigster', 'zweiundzwanzigster', 'dreiundzwanzigster', 'vierundzwanzigster',
  'fünfundzwanzigster', 'sechsundzwanzigster', 'siebenundzwanzigster', 'achtundzwanzigster', 'neunundzwanzigster',
  'dreißigster', 'einunddreißigster',
]

/** A "YYYY-MM-DD" day as a calendar date; the weekday doesn't depend on the device's time zone */
function parts(day: string) {
  const [y, m, d] = day.split('-').map(Number)
  return { weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay(), month: m, date: d }
}

/** "Donnerstag, zwölfter November" */
export function spokenDate(day: string): string {
  const { weekday, month, date } = parts(day)
  return `${WEEKDAYS[weekday]}, ${ORDINALS[date]} ${MONTHS[month - 1]}`
}

/** "Do 12.11." */
export function shortDate(day: string): string {
  const { weekday, month, date } = parts(day)
  return `${WEEKDAYS[weekday].slice(0, 2)} ${date}.${month}.`
}

export function starsSaid(n: number): string {
  return n === 1 ? 'ein Stern' : `${numberWord(n)} Sterne`
}

/** What the voice says for a tapped entry. */
export function entrySaid(entry: LogEntry, name: (building: string) => string): string {
  if (entry.kind === 'visit') return `${name(entry.building)}, ${starsSaid(entry.stars)}.`
  if (entry.kind === 'play') return `${name(entry.building)}, ${starsSaid(-entry.stars)} ausgegeben.`
  return `${name(entry.building)}.`
}

/** One day as a line of text for the parents. */
export function dayLine(day: LogDay, name: (building: string) => string): string {
  const things = day.entries.map(e =>
    e.kind === 'visit' ? `${name(e.building)} +${e.stars}` : e.kind === 'play' ? `${name(e.building)} −${-e.stars}` : name(e.building))
  let line = `${shortDate(day.day)}: ${things.join(', ') || 'gemalt'}.`
  if (day.goal_reached) line += ' Tagesziel erreicht.'
  const stickers = day.stickers.map(id => stickerDef(id)?.name ?? id)
  if (stickers.length) line += ` ${stickers.length === 1 ? 'Neuer Sticker' : 'Neue Sticker'}: ${stickers.join(', ')}.`
  return line
}
