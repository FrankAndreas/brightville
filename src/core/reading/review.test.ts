import { describe, expect, it } from 'vitest'
import { layReading } from './rules'
import { allTexts } from './texts'

const find = (key: string) => allTexts(key.slice(0, 2) as 'en' | 'fr').find(x => x.key === key)!.text
const q = (key: string, i: number) => find(key).questions[i]
const rightOf = (key: string, i: number) => q(key, i).answers[q(key, i).right]

describe('the reading content after the review', () => {
  it('the flat\'s questions have one true answer each', () => {
    const asked = find('en:home:flat').questions.map(x => x.question)
    expect(asked).not.toContain('Was ist in der Küche neu?')
  })

  it('Gruyère goes into a fondue', () => {
    expect(find('fr:food:marche').sentences.join(' ')).toContain('du gruyère pour une fondue')
    expect(rightOf('fr:food:marche', 2)).toBe('für ein Fondue')
  })

  it('weather questions offer only places the text speaks about', () => {
    expect(q('en:nature:weather', 2).answers).not.toContain('in den Bergen')
    expect(q('fr:nature:meteo', 2).answers).not.toContain('in Genf')
  })

  it('the ibex was gone from Switzerland, not almost', () => {
    expect(find('fr:nature:bouquetin').sentences.join(' ')).not.toContain('presque plus de bouquetins')
  })

  it('questions match their texts and are good German', () => {
    expect(q('en:town:news', 1).question).not.toContain('Café')
    expect(q('fr:jobs:futur', 3).answers).toContain('im Cockpit sitzen')
  })

  it('a narrator whose gender the text leaves open is "die Person" in German', () => {
    for (const key of ['en:freetime:climbing', 'en:health:dentist', 'en:town:lost', 'en:shopping:trainers', 'en:feelings:proud']) {
      for (const x of find(key).questions) {
        expect(`${x.question} ${x.answers.join(' ')}`, key).not.toMatch(/\b(sie|Sie|ihr|ihre|ihren|ihrer)\b/)
      }
      for (const g of find(key).glossary) expect(g.de, key).not.toMatch(/\bwurde Dritter\b/)
    }
  })

  it('the page skips a text key with an empty part, as the server does', () => {
    expect(layReading({}, { lang: 'en', answers: [{ text: 'en::x', right: 2 }] }, '2026-11-12')).toEqual({})
  })
})
