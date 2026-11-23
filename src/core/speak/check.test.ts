import { describe, expect, it } from 'vitest'
import { heardRight, spokenForm } from './check'

describe('what the recogniser heard', () => {
  it('forgives case, punctuation, apostrophes and spaces', () => {
    expect(heardRight(['how are you today'], 'How are you today?', 'en')).toBe(true)
    expect(heardRight(['how are you to day'], 'How are you today?', 'en')).toBe(true)
    expect(heardRight(['je voudrais un croissant sil vous plait'], "Je voudrais un croissant, s'il vous plaît.", 'fr')).toBe(true)
  })

  it('counts figures as their words, both ways', () => {
    expect(heardRight(["it's 2 o'clock"], "It's two o'clock.", 'en')).toBe(true)
    expect(heardRight(["it's two o'clock"], "It's 2 o'clock.", 'en')).toBe(true)
    expect(heardRight(['22'], 'vingt-deux', 'fr')).toBe(true)
    expect(heardRight(['j’ai 15 ans'], "J'ai quinze ans.", 'fr')).toBe(true)
    expect(heardRight(['71'], 'soixante et onze', 'fr')).toBe(true)
    expect(heardRight(['80'], 'quatre-vingts', 'fr')).toBe(true)
    expect(heardRight(['99'], 'ninety-nine', 'en')).toBe(true)
    expect(heardRight(['j’ai 1 sœur'], 'J’ai une sœur.', 'fr')).toBe(true)
    expect(heardRight(['j’ai 1 frère'], 'J’ai un frère.', 'fr')).toBe(true)
    expect(heardRight(['21 heures'], 'vingt et une heures', 'fr')).toBe(true)
  })

  it('any answer of a word counts, and a verb may leave out its "to"', () => {
    expect(heardRight(['purchase'], 'buy / purchase', 'en', { word: true })).toBe(true)
    expect(heardRight(['travel'], 'to travel', 'en', { word: true })).toBe(true)
    expect(heardRight(['à la gare'], 'la gare', 'fr', { word: true })).toBe(false)
  })

  it('tries every alternative', () => {
    expect(heardRight(['big', 'bike'], 'bike', 'en')).toBe(true)
    expect(heardRight(['big'], 'bike', 'en')).toBe(false)
    expect(heardRight([], 'bike', 'en')).toBe(false)
  })

  it('a spoken form: small letters, no accents, no punctuation or spaces, figures as words', () => {
    expect(spokenForm("Où est l'hôtel ? 3", 'fr')).toBe('ouestlhoteltrois')
    expect(spokenForm('Twenty-one', 'en')).toBe(spokenForm('21', 'en'))
  })
})
