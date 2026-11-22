import type { Lang } from '@/core/vocab/types'

// Times and dates in words, English and French: the form shown first, then every form that also counts. All number
// words are written out in tables (none is built by rules that could go wrong).

export const MONTHS: Record<Lang | 'de', string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  fr: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
}

/** Monday first */
export const DAYS: Record<Lang | 'de', string[]> = {
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  fr: ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'],
  de: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'],
}

const EN_HOURS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve']
/** How many minutes past or to, in words */
const EN_PAST: Record<number, string> = { 5: 'five', 10: 'ten', 15: 'quarter', 20: 'twenty', 25: 'twenty-five' }
/** The digital reading of the minutes ("eight oh five") */
const EN_DIGITAL: Record<number, string> = {
  5: 'oh five', 10: 'ten', 15: 'fifteen', 20: 'twenty', 25: 'twenty-five', 30: 'thirty', 35: 'thirty-five', 40: 'forty',
  45: 'forty-five', 50: 'fifty', 55: 'fifty-five',
}

const EN_ORDINALS = [
  '', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth',
  'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth',
  'twenty-first', 'twenty-second', 'twenty-third', 'twenty-fourth', 'twenty-fifth', 'twenty-sixth', 'twenty-seventh',
  'twenty-eighth', 'twenty-ninth', 'thirtieth', 'thirty-first',
]

/** French hours 0..23, feminine (une heure, vingt et une heures) */
const FR_HOURS = [
  'zéro', 'une', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize',
  'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf', 'vingt', 'vingt et une', 'vingt-deux', 'vingt-trois',
]
const FR_MINUTES: Record<number, string> = {
  5: 'cinq', 10: 'dix', 15: 'quinze', 20: 'vingt', 25: 'vingt-cinq', 30: 'trente', 35: 'trente-cinq', 40: 'quarante',
  45: 'quarante-cinq', 50: 'cinquante', 55: 'cinquante-cinq',
}
/** French numbers 1..31 for dates (the 1st is "premier") */
const FR_DAYS = [
  '', 'premier', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize',
  'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf', 'vingt', 'vingt et un', 'vingt-deux', 'vingt-trois',
  'vingt-quatre', 'vingt-cinq', 'vingt-six', 'vingt-sept', 'vingt-huit', 'vingt-neuf', 'trente', 'trente et un',
]

const unique = (forms: string[]) => [...new Set(forms)]

/** English ordinal in words: 1 → "first" … 31 → "thirty-first" */
export function ordinalWord(day: number): string {
  return EN_ORDINALS[day] ?? ''
}

function suffix(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) return 'th'
  return { 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] ?? 'th'
}

const nextHour = (hour: number) => (hour % 12) + 1

function englishTime(hour: number, minute: number): string[] {
  const forms: string[] = []
  if (minute === 0) forms.push(`${EN_HOURS[hour]} o'clock`)
  else if (minute === 30) forms.push(`half past ${EN_HOURS[hour]}`)
  else if (minute < 30) forms.push(`${EN_PAST[minute]} past ${EN_HOURS[hour]}`)
  else forms.push(`${EN_PAST[60 - minute]} to ${EN_HOURS[nextHour(hour)]}`)
  if (minute === 15) forms.push(`a quarter past ${EN_HOURS[hour]}`)
  if (minute === 45) forms.push(`a quarter to ${EN_HOURS[nextHour(hour)]}`)
  forms.push(minute === 0 ? EN_HOURS[hour] : `${EN_HOURS[hour]} ${EN_DIGITAL[minute]}`)
  return [...forms, ...forms.map(f => `it's ${f}`), ...forms.map(f => `it is ${f}`)]
}

/** "huit heures", "une heure", "midi" (or "minuit") for 12 */
function frHour(hour: number, twelve: 'midi' | 'minuit'): string {
  if (hour === 12) return twelve
  return hour === 1 ? 'une heure' : `${FR_HOURS[hour]} heures`
}

function frenchSaid(hour: number, minute: number, twelve: 'midi' | 'minuit'): string[] {
  if (minute === 0) return [frHour(hour, twelve)]
  if (minute === 15) return [`${frHour(hour, twelve)} et quart`]
  if (minute === 30) return hour === 12 ? [`${twelve} et demi`, `${twelve} et demie`] : [`${frHour(hour, twelve)} et demie`]
  if (minute < 30) return [`${frHour(hour, twelve)} ${FR_MINUTES[minute]}`]
  const to = minute === 45 ? 'le quart' : FR_MINUTES[60 - minute]
  return [`${frHour(nextHour(hour), twelve)} moins ${to}`]
}

/** The 24-hour form of hour 0..23: "seize heures trente", "vingt et une heures" */
function french24(hour24: number, minute: number): string {
  const h = hour24 === 1 ? 'une heure' : `${FR_HOURS[hour24]} heures`
  return minute === 0 ? h : `${h} ${FR_MINUTES[minute]}`
}

function frenchTime(hour: number, minute: number): string[] {
  const forms = [
    ...frenchSaid(hour, minute, 'midi'),
    ...frenchSaid(hour, minute, 'minuit'),
    french24(hour % 12 === 0 ? 12 : hour, minute),
    ...(hour === 12 ? [] : [french24(hour + 12, minute)]),
  ]
  return [...forms, ...forms.map(f => `il est ${f}`)]
}

/** A time on a 12-hour clock (hour 1..12, minute 0..55 in fives) in words: the form shown first, then all that count */
export function timeWords(lang: Lang, hour: number, minute: number): string[] {
  return unique(lang === 'en' ? englishTime(hour, minute) : frenchTime(hour, minute))
}

/** A date (day 1..31, month 1..12) in words: the form shown first, then all that count */
export function dateWords(lang: Lang, day: number, month: number): string[] {
  if (lang === 'en') {
    const m = MONTHS.en[month - 1]
    const ord = ordinalWord(day)
    const num = `${day}${suffix(day)}`
    return unique([`the ${ord} of ${m}`, `${m} ${num}`, `${num} ${m}`, `${m} ${day}`, `${m} the ${ord}`, `the ${num} of ${m}`, `${day} ${m}`])
  }
  const m = MONTHS.fr[month - 1]
  return unique([`le ${FR_DAYS[day]} ${m}`, `le ${day === 1 ? '1er' : day} ${m}`, ...(day === 1 ? [`le 1 ${m}`] : [])])
}

/** "8:05" */
export function shownTime(hour: number, minute: number): string {
  return `${hour}:${String(minute).padStart(2, '0')}`
}

/** "14.7." */
export function shownDate(day: number, month: number): string {
  return `${day}.${month}.`
}
