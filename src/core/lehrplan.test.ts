import { describe, expect, it } from 'vitest'
import { BUILDINGS } from '@/buildings/registry'
import type { LogDay, LogEntry } from './diary'
import type { Ladders } from './ladders'
import { FACHBEREICHE, kgMark, lettersShare, overall, practice, STEP_TEXT, subjects, TAGS, weekDays, ZUGAENGE } from './lehrplan'
import type { Letters } from './writing/levels'

const ladders = (zaehlen: number, rechnen: number, reimen = 1): Ladders => ({
  zaehlen: { step: zaehlen, window: [] }, rechnen: { step: rechnen, window: [] }, reimen: { step: reimen, window: [] },
})
const known = (glyphs: string): Letters =>
  Object.fromEntries([...glyphs].map(g => [g, { level: 4 as const, streak: 0, practised_at: null }]))
const entry = (building: string, kind: LogEntry['kind'] = 'visit'): LogEntry => ({ building, kind, stars: 3, at: '10:00' })
const day = (d: string, ...entries: LogEntry[]): LogDay => ({ day: d, goal_reached: false, entries, stickers: [], paintings: [] })

const TODAY = '2026-11-20'

describe('Lehrplan 21', () => {
  it('tags every building, with Zugänge 1–9 and known subjects', () => {
    for (const b of BUILDINGS) expect(TAGS[b.id], b.id).toBeDefined()
    for (const tag of Object.values(TAGS)) {
      for (const z of tag.zugaenge) expect(ZUGAENGE[z]).toBeDefined()
      for (const code of tag.codes) expect(FACHBEREICHE[code.split('.')[0]]).toBeDefined()
    }
    expect(Object.keys(ZUGAENGE)).toHaveLength(9)
  })

  it('has a text for every step', () => {
    expect(STEP_TEXT.zaehlen).toHaveLength(6)
    expect(STEP_TEXT.rechnen).toHaveLength(6)
    expect(STEP_TEXT.reimen).toHaveLength(6)
  })

  it('makes one number from the four ladders', () => {
    expect(overall(ladders(1, 1, 1), {})).toBe(0)
    const all = known('ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ')
    expect(overall(ladders(6, 6, 6), all)).toBe(100)
    expect(overall(ladders(3, 2, 4), known('MIAPLENO'))).toBe(Math.round(((0.4 + 0.2 + 0.6 + 8 / 29) / 4) * 100))
  })

  it('tags the Reimhaus as Deutsch, Sprache and Wahrnehmung', () => {
    expect(TAGS.reimhaus).toEqual({ codes: ['D.1.A.1'], zugaenge: [8, 2] })
  })

  it('counts only letters she knows, not digits or letters still practised', () => {
    const letters: Letters = { ...known('AB12'), C: { level: 3, streak: 0, practised_at: null } }
    expect(lettersShare(letters)).toBeCloseTo(2 / 29)
  })

  it('marks the end of Kindergarten', () => {
    expect(kgMark()).toBe(45)
  })

  it('takes the last seven calendar days, today first', () => {
    expect(weekDays(TODAY)).toEqual(['2026-11-20', '2026-11-19', '2026-11-18', '2026-11-17', '2026-11-16', '2026-11-15', '2026-11-14'])
    expect(weekDays('2026-03-02')[2]).toBe('2026-02-28')
  })

  it('groups this week\'s visits by Zugang', () => {
    const days = [day('2026-11-17', entry('yoga'), entry('laden', 'buy')), day('2026-11-11', entry('yoga'))]
    const rows = practice(days, TODAY)
    expect(rows.map(r => r.zugang)).toEqual([1, 2, 3, 5, 6, 7, 8])
    expect(rows.find(r => r.zugang === 1)?.visits).toEqual([{ building: 'yoga', times: 1 }])
    expect(rows.find(r => r.zugang === 3)).toMatchObject({ visits: [], hasBuilding: false })
    expect(rows.find(r => r.zugang === 2)).toMatchObject({ visits: [], hasBuilding: true })
  })

  it('counts a round of a tagged play building, but not of the others', () => {
    const days = [day('2026-11-18', entry('arcade', 'play'), entry('schlange', 'play'))]
    expect(practice(days, TODAY).find(r => r.zugang === 2)?.visits).toEqual([{ building: 'arcade', times: 1 }])
  })

  it('lists every subject with this week\'s visits', () => {
    const days = [day('2026-11-19', entry('malen', 'free'), entry('malen', 'free'))]
    const bg = subjects(days, TODAY).find(s => s.code === 'BG')
    expect(bg).toEqual({ code: 'BG', name: 'Bildnerisches Gestalten', visits: [{ building: 'malen', times: 2 }] })
    expect(subjects(days, TODAY).map(s => s.code)).toEqual(['MA', 'D', 'BG', 'BS', 'MU'])
  })
})
