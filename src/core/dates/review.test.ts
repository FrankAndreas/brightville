import { describe, expect, it } from 'vitest'
import { createRoundFlow } from '@/buildings/vokabeln/roundFlow'
import type { RoundItem } from '@/core/vocab/round'
import type { Lang } from '@/core/vocab/types'
import { buildDatesRound, kindOf } from './round'
import { dateWords, timeWords } from './words'

/** Whether typing `text` counts as right for these accepted forms */
function accepts(lang: Lang, forms: string[], text: string): boolean {
  const item: RoundItem = { word: { key: `${lang}:date-words:0`, de: 'x', foreign: forms.join(' / '), source: 'date-words' }, mode: 'type-de' }
  const flow = createRoundFlow([item], lang)
  flow.answer(text)
  return flow.state.phase === 'right'
}

describe('the forms after the review', () => {
  it('takes common English dates without "the", and the spoken American order', () => {
    for (const t of ['1st of May', 'first of May', 'May first']) expect(accepts('en', dateWords('en', 1, 5), t), t).toBe(true)
    for (const t of ['14th of July', 'fourteenth of July', 'July fourteenth']) expect(accepts('en', dateWords('en', 14, 7), t), t).toBe(true)
  })

  it('takes French dates without "le", and the hyphenated 1990 spelling', () => {
    expect(accepts('fr', dateWords('fr', 14, 7), '14 juillet')).toBe(true)
    expect(accepts('fr', dateWords('fr', 1, 5), 'premier mai')).toBe(true)
    expect(accepts('fr', dateWords('fr', 21, 6), 'le vingt-et-un juin')).toBe(true)
    expect(accepts('fr', dateWords('fr', 31, 12), 'le trente-et-un décembre')).toBe(true)
    expect(accepts('fr', timeWords('fr', 9, 0), 'vingt-et-une heures')).toBe(true)
  })

  it('takes "midi quinze" like "huit heures quinze"', () => {
    expect(accepts('fr', timeWords('fr', 12, 15), 'midi quinze')).toBe(true)
    expect(accepts('fr', timeWords('fr', 12, 30), 'minuit trente')).toBe(true)
  })

  it('takes noon and midnight, "o five", and a space for a hyphen', () => {
    for (const t of ['noon', 'midday', 'midnight', 'twelve noon']) expect(accepts('en', timeWords('en', 12, 0), t), t).toBe(true)
    expect(accepts('en', timeWords('en', 8, 5), 'eight o five')).toBe(true)
    expect(accepts('en', timeWords('en', 8, 25), 'twenty five past eight')).toBe(true)
    expect(accepts('fr', timeWords('fr', 5, 0), 'dix sept heures')).toBe(true)
    expect(accepts('en', dateWords('en', 22, 2), 'the twenty second of February')).toBe(true)
  })

  it('takes "the third" for "der dritte", and offers spelling choices of the same kind', () => {
    for (let n = 0; n < 40; n++) {
      for (const r of buildDatesRound('en', {}, Math.random).filter(x => kindOf(x.word.key) === 'spelling')) {
        const right = r.word.foreign.split(' / ')[0]
        if (r.word.de.startsWith('der ')) expect(accepts('en', r.word.foreign.split(' / '), `the ${right}`)).toBe(true)
        const group = (w: string) => (/^(Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day$/.test(w) ? 'day' : /^[A-Z]/.test(w) ? 'month' : 'ordinal')
        for (const c of r.choices!) expect(group(c), `${right} / ${c}`).toBe(group(right))
      }
    }
  })

  it('never asks the same time or date twice in a round, in any kind', () => {
    for (let n = 0; n < 60; n++) {
      const round = buildDatesRound(n % 2 ? 'fr' : 'en', {}, Math.random)
      const values = round
        .filter(r => kindOf(r.word.key) !== 'spelling')
        .map(r => (/^\d/.test(r.word.de) ? r.word.de : r.word.foreign.split(' / ')[0]))
      expect(new Set(values).size, values.join(' | ')).toBe(values.length)
    }
  })
})
