import { GLYPHS } from './letters'

// How well she knows each letter, and her words and sentences: the same rules as the server
// (backend/app/writing.py), so the page can go on while the server is away. The server is the truth.

/** How much of the letter is shown: the whole path, dots along it, only where to start, or nothing */
export type Help = 'full' | 'dots' | 'start' | 'none'

/** 0 not met yet, 1 the full letter, 2 dots, 3 only the start dot, 4 known (no help) */
export type Level = 0 | 1 | 2 | 3 | 4

export interface LetterState {
  level: Level
  /** Clean writes in a row (positive) or bumpy ones (negative) */
  streak: number
  practised_at: string | null
}

/** The letters she has met, by glyph */
export type Letters = Record<string, LetterState>

const STREAK = 3
const KNOWN = 4

/** One write: three clean in a row move the letter up a level, three bumpy down one; the other kind starts again */
export function applyWrite(s: LetterState, clean: boolean, at: string): LetterState {
  const streak = clean ? Math.max(s.streak, 0) + 1 : Math.min(s.streak, 0) - 1
  if (streak >= STREAK) return { level: Math.min(s.level + 1, KNOWN) as Level, streak: 0, practised_at: at }
  if (streak <= -STREAK) return { level: Math.max(s.level - 1, 1) as Level, streak: 0, practised_at: at }
  return { level: s.level, streak, practised_at: at }
}

const HELP: Help[] = ['full', 'full', 'dots', 'start', 'none']

export function helpFor(level: Level): Help {
  return HELP[level]
}

export const MAX_TEXT = 30
export const MAX_TEXTS = 20

export type TextProblem = 'empty' | 'letters' | 'too-long' | 'exists' | 'too-many'

/** Capitals, single spaces, nothing around */
export function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().toUpperCase()
}

/** Why a text can't join the list, or null if it can */
export function checkText(text: string, list: string[]): TextProblem | null {
  if (list.length >= MAX_TEXTS) return 'too-many'
  const t = normalizeText(text)
  if (!t) return 'empty'
  // 'ß'.toUpperCase() is 'SS': the parents' spelling must not change unseen
  if (text.includes('ß') || ![...t].every(c => c === ' ' || GLYPHS[c])) return 'letters'
  if (t.length > MAX_TEXT) return 'too-long'
  if (list.includes(t)) return 'exists'
  return null
}
