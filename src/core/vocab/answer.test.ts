import { describe, expect, it } from 'vitest'
import { checkAnswer, ownKey } from './answer'

describe('checkAnswer', () => {
  it('ignores case, spaces and a final full stop; any alternative counts; the first is shown', () => {
    expect(checkAnswer('Railway  Station ', 'railway station / train station', { lang: 'en' })).toEqual({ verdict: 'right', shown: 'railway station', marks: [] })
    expect(checkAnswer('train station.', 'railway station / train station', { lang: 'en' }).verdict).toBe('right')
    expect(checkAnswer('what?', 'what', { lang: 'en' }).verdict).toBe('right')
  })

  it('an English verb may leave out its "to", either way', () => {
    expect(checkAnswer('travel', 'to travel', { lang: 'en' }).verdict).toBe('right')
    expect(checkAnswer('to travel', 'travel', { lang: 'en' }).verdict).toBe('right')
    expect(checkAnswer('voyager', 'to voyager', { lang: 'fr' }).verdict).toBe('wrong')
  })

  it('accents count: only an accent off is "accent", marked, and not right', () => {
    expect(checkAnswer("l'ecole", "l'école", { lang: 'fr' })).toEqual({ verdict: 'accent', shown: "l'école", marks: [2] })
    expect(checkAnswer('la fenètre', 'la fenêtre', { lang: 'fr' })).toEqual({ verdict: 'accent', shown: 'la fenêtre', marks: [6] })
    expect(checkAnswer('l oeuf', "l'œuf", { lang: 'fr' }).verdict).toBe('wrong')
    expect(checkAnswer("l'oeuf", "l'œuf", { lang: 'fr' }).verdict).toBe('accent')
    expect(checkAnswer('die Muhle', 'die Mühle', { lang: 'de' })).toEqual({ verdict: 'accent', shown: 'die Mühle', marks: [5] })
  })

  it('anything else is wrong, an empty answer too', () => {
    expect(checkAnswer('la gar', 'la gare', { lang: 'fr' }).verdict).toBe('wrong')
    expect(checkAnswer('', 'la gare', { lang: 'fr' }).verdict).toBe('wrong')
    expect(checkAnswer('   ', 'la gare', { lang: 'fr' }).verdict).toBe('wrong')
  })
})

describe('ownKey', () => {
  it('is the language, the first answer and the German, small and with single spaces', () => {
    expect(ownKey('en', ' Railway  Station / train station', 'Der  Bahnhof')).toBe('en:own:railway station|der bahnhof')
  })

describe('checkAnswer with what a pasted list may hide', () => {
  it('a decomposed accent in the list is the same letter as a typed one', () => {
    expect(checkAnswer('école', 'e\u0301cole', { lang: 'fr' }).verdict).toBe('right')
    expect(checkAnswer('house', 'house\u00ad', { lang: 'en' }).verdict).toBe('right')
  })
})
})
