import { describe, expect, it } from 'vitest'
import { BUILDINGS } from '@/buildings/registry'
import type { LogDay, LogEntry } from './diary'
import { LADDERS } from './ladders'
import { laddersAt } from './ladders.fixture'
import { FACHBEREICHE, LADDER_DEFS, lettersShare, practice, STEP_TEXT, subjectProgress, subjects, TAGS, weekDays, ZUGAENGE } from './lehrplan'
import type { Letters } from './writing/levels'

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

  it('names the Reimhaus\'s syllable steps as she does them, on the drum', () => {
    expect(STEP_TEXT.reimen[3]).toBe('Silben trommeln bis 3')
  })

  it('describes every ladder once: its name, its subject, six step texts and where Kindergarten ends', () => {
    expect(Object.keys(LADDER_DEFS).sort()).toEqual([...LADDERS].sort())
    for (const l of LADDERS) {
      expect(STEP_TEXT[l], l).toHaveLength(6)
      expect(FACHBEREICHE[LADDER_DEFS[l].subject], l).toBeDefined()
      expect(LADDER_DEFS[l].kgStep, l).toBeGreaterThanOrEqual(1)
      expect(LADDER_DEFS[l].kgStep, l).toBeLessThanOrEqual(6)
    }
  })

  it('shows how far she is per subject, each with where Kindergarten ends', () => {
    const at = subjectProgress(laddersAt({ zaehlen: 3, rechnen: 2, muster: 3, zeit: 2, raum: 5, reimen: 4, rhythmus: 2 }), known('MIAPLENO'))
    expect(at.map(s => s.code)).toEqual(['MA', 'D', 'MU'])
    const [ma, d, mu] = at
    expect(ma).toMatchObject({ name: 'Mathematik', ladders: ['zaehlen', 'rechnen', 'muster', 'zeit', 'raum'] })
    expect(ma.percent).toBe(Math.round(((0.4 + 0.2 + 0.4 + 0.2 + 0.8) / 5) * 100))
    expect(ma.kg).toBe(56)
    // Deutsch: Reimen and the letters she knows
    expect(d).toMatchObject({ ladders: ['reimen'], letters: true, kg: 50 })
    expect(d.percent).toBe(Math.round(((0.6 + 8 / 29) / 2) * 100))
    expect(mu).toMatchObject({ ladders: ['rhythmus'], percent: 20, kg: 60 })
  })

  it('reaches 100 % in every subject at the end of 2nd grade', () => {
    const all = known('ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ')
    expect(subjectProgress(laddersAt(Object.fromEntries(LADDERS.map(l => [l, 6]))), all).map(s => s.percent)).toEqual([100, 100, 100])
    expect(subjectProgress(laddersAt(), {}).map(s => s.percent)).toEqual([0, 0, 0])
  })

  it('tags the Trommelhaus as Musik, Körper and Wahrnehmung', () => {
    expect(TAGS.trommelhaus).toEqual({ codes: ['MU'], zugaenge: [1, 2] })
  })

  it('tags the Spielwelt as Form und Raum, Räumliche Orientierung and Wahrnehmung', () => {
    expect(TAGS.spielwelt).toEqual({ codes: ['MA.2'], zugaenge: [4, 2] })
  })

  it('tags the Kalender as Mathematik, Zeitliche Orientierung and Sprache', () => {
    expect(TAGS.kalender).toEqual({ codes: ['MA.3'], zugaenge: [3, 8] })
  })

  it('tags the Musterwerkstatt as Mathematik, Zusammenhänge and Wahrnehmung', () => {
    expect(TAGS.muster).toEqual({ codes: ['MA.1.B', 'MA.3'], zugaenge: [5, 2] })
  })

  it('tags the Reimhaus as Deutsch, Sprache and Wahrnehmung', () => {
    expect(TAGS.reimhaus).toEqual({ codes: ['D.1.A.1'], zugaenge: [8, 2] })
  })

  it('counts only letters she knows, not digits or letters still practised', () => {
    const letters: Letters = { ...known('AB12'), C: { level: 3, streak: 0, practised_at: null } }
    expect(lettersShare(letters)).toBeCloseTo(2 / 29)
  })

  it('takes the last seven calendar days, today first', () => {
    expect(weekDays(TODAY)).toEqual(['2026-11-20', '2026-11-19', '2026-11-18', '2026-11-17', '2026-11-16', '2026-11-15', '2026-11-14'])
    expect(weekDays('2026-03-02')[2]).toBe('2026-02-28')
  })

  it('groups this week\'s visits by Zugang', () => {
    const days = [day('2026-11-17', entry('yoga'), entry('laden', 'buy')), day('2026-11-11', entry('yoga'))]
    const rows = practice(days, TODAY)
    // Räumliche Orientierung has the Spielwelt now; only Eigenständigkeit (Mein Haus, the shops) isn't logged
    expect(rows.map(r => r.zugang)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(rows.find(r => r.zugang === 1)?.visits).toEqual([{ building: 'yoga', times: 1 }])
    // Lernen und Reflexion has no house yet; Zeitliche Orientierung has the Kalender
    expect(rows.find(r => r.zugang === 7)).toMatchObject({ visits: [], hasBuilding: false })
    expect(rows.find(r => r.zugang === 3)).toMatchObject({ visits: [], hasBuilding: true })
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
