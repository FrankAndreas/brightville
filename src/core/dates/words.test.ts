import { describe, expect, it } from 'vitest'
import { dateWords, DAYS, MONTHS, ordinalWord, shownDate, shownTime, timeWords } from './words'

describe('times in words', () => {
  it('English: past, half, to, o\'clock and the digital reading', () => {
    const quarter = timeWords('en', 8, 15)
    expect(quarter[0]).toBe('quarter past eight')
    expect(quarter).toContain('eight fifteen')
    expect(quarter).toContain("it's quarter past eight")
    expect(quarter).toContain('it is quarter past eight')
    expect(timeWords('en', 8, 40)[0]).toBe('twenty to nine')
    expect(timeWords('en', 12, 45)[0]).toBe('quarter to one')
    expect(timeWords('en', 8, 5)).toContain('eight oh five')
    expect(timeWords('en', 8, 0)[0]).toBe("eight o'clock")
    expect(timeWords('en', 8, 30)[0]).toBe('half past eight')
    expect(timeWords('en', 11, 50)[0]).toBe('ten to twelve')
    expect(timeWords('en', 8, 25)[0]).toBe('twenty-five past eight')
  })

  it('French: et quart, et demie, moins, une heure, midi and minuit, and the 24-hour form', () => {
    expect(timeWords('fr', 8, 30)[0]).toBe('huit heures et demie')
    expect(timeWords('fr', 8, 15)[0]).toBe('huit heures et quart')
    const twenty = timeWords('fr', 8, 40)
    expect(twenty[0]).toBe('neuf heures moins vingt')
    expect(twenty).toContain('huit heures quarante')
    expect(twenty).toContain('vingt heures quarante')
    expect(twenty).toContain('il est neuf heures moins vingt')
    expect(timeWords('fr', 12, 30)).toContain('midi et demi')
    expect(timeWords('fr', 12, 30)).toContain('midi et demie')
    expect(timeWords('fr', 1, 0)[0]).toBe('une heure')
    expect(timeWords('fr', 11, 45)[0]).toBe('midi moins le quart')
    expect(timeWords('fr', 11, 45)).toContain('minuit moins le quart')
    expect(timeWords('fr', 12, 0)).toContain('minuit')
    expect(timeWords('fr', 8, 5)[0]).toBe('huit heures cinq')
    expect(timeWords('fr', 1, 50)[0]).toBe('deux heures moins dix')
    expect(timeWords('fr', 9, 0)).toContain('vingt et une heures')
  })

  it('never lists a form twice', () => {
    for (const lang of ['en', 'fr'] as const) {
      for (let h = 1; h <= 12; h++) {
        for (let m = 0; m < 60; m += 5) {
          const all = timeWords(lang, h, m)
          expect(new Set(all).size, `${lang} ${h}:${m}`).toBe(all.length)
        }
      }
    }
  })
})

describe('dates in words', () => {
  it('English ordinals and dates', () => {
    expect(ordinalWord(1)).toBe('first')
    expect(ordinalWord(2)).toBe('second')
    expect(ordinalWord(3)).toBe('third')
    expect(ordinalWord(12)).toBe('twelfth')
    expect(ordinalWord(22)).toBe('twenty-second')
    expect(ordinalWord(31)).toBe('thirty-first')
    const may = dateWords('en', 1, 5)
    expect(may[0]).toBe('the first of May')
    expect(may).toContain('May 1st')
    expect(dateWords('en', 14, 7)).toEqual(expect.arrayContaining(['the fourteenth of July', 'July 14th', '14th July', 'July 14', 'July the fourteenth', 'the 14th of July']))
    expect(dateWords('en', 22, 3)).toContain('March 22nd')
    expect(dateWords('en', 13, 3)).toContain('March 13th')
  })

  it('French dates', () => {
    expect(dateWords('fr', 1, 5)).toEqual(expect.arrayContaining(['le premier mai', 'le 1er mai']))
    expect(dateWords('fr', 14, 7)[0]).toBe('le quatorze juillet')
    expect(dateWords('fr', 14, 7)).toContain('le 14 juillet')
    expect(dateWords('fr', 21, 6)[0]).toBe('le vingt et un juin')
    expect(MONTHS.fr).toEqual(expect.arrayContaining(['août', 'février', 'décembre']))
    expect(DAYS.fr[0]).toBe('lundi')
    expect(DAYS.de[6]).toBe('Sonntag')
  })

  it('shows a time and a date as numbers', () => {
    expect(shownTime(8, 5)).toBe('8:05')
    expect(shownDate(14, 7)).toBe('14.7.')
  })
})
