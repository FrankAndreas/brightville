import { beforeEach, describe, expect, it } from 'vitest'
import { lastLangKey, lastPickedLang } from './lastLang'

describe('the language he picked last', () => {
  beforeEach(() => window.localStorage.clear())

  it('reads what the language screen kept, per child; English when nothing usable is kept', () => {
    expect(lastPickedLang(3)).toBe('en')
    window.localStorage.setItem(lastLangKey(3), 'fr')
    expect(lastPickedLang(3)).toBe('fr')
    expect(lastPickedLang(4)).toBe('en')
    window.localStorage.setItem(lastLangKey(3), 'de')
    expect(lastPickedLang(3)).toBe('en')
    expect(lastLangKey(null)).toBe('brightville.vocab.lang.0')
  })

  it('a storage that throws: English', () => {
    const broken = { getItem: () => { throw new Error('blocked') } } as unknown as Storage
    expect(lastPickedLang(3, broken)).toBe('en')
  })
})
