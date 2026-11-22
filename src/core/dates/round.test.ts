import { describe, expect, it } from 'vitest'
import { createRoundFlow } from '@/buildings/vokabeln/roundFlow'
import { answersOf } from '@/core/vocab/answer'
import { buildDatesRound, kindOf, KINDS, layDates, weakestKinds, type DatesProgress } from './round'
import { dateWords, timeWords } from './words'

const times = (n: number, v: boolean) => Array.from({ length: n }, () => v)
const tidy = (s: string) => s.replace(/[’‘]/g, "'").trim().toLowerCase()

describe('dates rounds', () => {
  it('has 10 tasks, two of each kind, with different prompts, in one language', () => {
    for (const lang of ['en', 'fr'] as const) {
      const round = buildDatesRound(lang, {}, Math.random)
      expect(round).toHaveLength(10)
      for (const k of KINDS) expect(round.filter(r => kindOf(r.word.key) === k.id), k.id).toHaveLength(2)
      expect(new Set(round.map(r => r.word.de)).size).toBe(10)
      expect(new Set(round.map(r => r.word.key)).size).toBe(10)
      expect(round.every(r => r.word.key.startsWith(`${lang}:`))).toBe(true)
    }
  })

  it('offers four different choices with exactly one right, never another form of the right one', () => {
    for (let n = 0; n < 30; n++) {
      for (const r of buildDatesRound(n % 2 ? 'fr' : 'en', {}, Math.random)) {
        if (r.mode !== 'choice') continue
        expect(new Set(r.choices!.map(tidy)).size, r.word.de).toBe(4)
        const right = new Set(answersOf(r.word.foreign).map(tidy))
        expect(r.choices!.filter(c => right.has(tidy(c))), r.word.de).toHaveLength(1)
      }
    }
  })

  it('clocks and dates are offered as numbers', () => {
    const round = buildDatesRound('en', {}, Math.random)
    for (const r of round.filter(x => kindOf(x.word.key) === 'words-clock')) for (const c of r.choices!) expect(c).toMatch(/^\d{1,2}:\d\d$/)
    for (const r of round.filter(x => kindOf(x.word.key) === 'words-date')) for (const c of r.choices!) expect(c).toMatch(/^\d{1,2}\.\d{1,2}\.$/)
  })

  it('types a kind once he has 5 of his last 10, but always picks clocks and dates', () => {
    const known: DatesProgress = Object.fromEntries(KINDS.map(k => [`en:${k.id}`, { recent: times(10, true) }]))
    const round = buildDatesRound('en', known, Math.random)
    for (const r of round) {
      const kind = kindOf(r.word.key)
      expect(r.mode, kind).toBe(kind === 'words-clock' || kind === 'words-date' ? 'choice' : 'type-de')
    }
    const fresh = buildDatesRound('en', {}, Math.random)
    expect(fresh.every(r => r.mode === 'choice')).toBe(true)
  })

  it('a typed date takes every way of writing it', () => {
    const known: DatesProgress = { 'en:date-words': { recent: times(10, true) } }
    const item = buildDatesRound('en', known, Math.random).find(r => kindOf(r.word.key) === 'date-words')!
    const [d, m] = item.word.de.split('.').map(Number)
    for (const typed of [dateWords('en', d, m)[0], dateWords('en', d, m)[1]]) {
      const flow = createRoundFlow([item], 'en')
      flow.answer(typed)
      expect(flow.state.phase, typed).toBe('right')
    }
  })

  it('a typed time takes "it\'s" in front and the digital reading', () => {
    const known: DatesProgress = { 'en:clock-words': { recent: times(10, true) } }
    const item = buildDatesRound('en', known, Math.random).find(r => kindOf(r.word.key) === 'clock-words')!
    const [h, m] = item.word.de.split(':').map(Number)
    for (const typed of [`It's ${timeWords('en', h, m)[0]}.`, timeWords('en', h, m).find(f => !f.includes(' past ') && !f.includes(' to ') && !f.startsWith('it'))!]) {
      const flow = createRoundFlow([item], 'en')
      flow.answer(typed)
      expect(flow.state.phase, typed).toBe('right')
    }
  })

  it('keeps the last 10 per kind and names the weakest', () => {
    const many = layDates({}, { lang: 'en', answers: Array.from({ length: 14 }, (_, i) => ({ kind: 'en:spelling', right: i % 2 === 0 })) })
    expect(many['en:spelling'].recent).toHaveLength(10)
    expect(layDates({}, { lang: 'en', answers: [{ kind: 'fr:spelling', right: true }, { kind: 'en', right: true }] })).toEqual({})
    const progress: DatesProgress = {
      'en:spelling': { recent: [...times(4, false), ...times(6, true)] },
      'en:date-words': { recent: times(6, false) },
      'en:clock-words': { recent: times(10, true) },
    }
    expect(weakestKinds('en', progress)).toEqual(['date-words', 'spelling'])
  })
})
