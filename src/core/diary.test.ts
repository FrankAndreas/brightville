import { describe, expect, it } from 'vitest'
import { dayLine, entrySaid, shortDate, spokenDate, starsSaid } from './diary'
import { outfitDef } from './outfits'
import { STICKERS, stickerDef } from './stickers'

const NAMES: Record<string, string> = { school: 'Schule', bibliothek: 'Bibliothek', arcade: 'Spielhalle', malen: 'Malen' }
const name = (id: string) => NAMES[id] ?? id

describe('dates', () => {
  it('says a day the way a child hears it', () => {
    expect(spokenDate('2026-11-12')).toBe('Donnerstag, zwölfter November')
    expect(spokenDate('2026-03-01')).toBe('Sonntag, erster März')
    expect(spokenDate('2026-12-31')).toBe('Donnerstag, einunddreißigster Dezember')
    expect(spokenDate('2026-11-23')).toBe('Montag, dreiundzwanzigster November')
  })

  it('writes a day short, for grown-ups', () => {
    expect(shortDate('2026-11-12')).toBe('Do 12.11.')
    expect(shortDate('2026-01-05')).toBe('Mo 5.1.')
  })
})

describe('entries', () => {
  it('says how many Stars, with one Star in the singular', () => {
    expect(starsSaid(7)).toBe('sieben Sterne')
    expect(starsSaid(1)).toBe('ein Stern')
  })

  it('says what was done', () => {
    expect(entrySaid({ building: 'school', kind: 'visit', stars: 7, at: '15:00' }, name)).toBe('Schule, sieben Sterne.')
    expect(entrySaid({ building: 'arcade', kind: 'play', stars: -3, at: '16:00' }, name)).toBe('Spielhalle, drei Sterne ausgegeben.')
    expect(entrySaid({ building: 'malen', kind: 'free', stars: 0, at: '16:30' }, name)).toBe('Malen.')
  })

  it('names a purchase in the Kleiderladen by its add-on', () => {
    const named = (id: string) => outfitDef(id)?.name ?? name(id)
    expect(entrySaid({ building: 'schal', kind: 'buy', stars: -20, at: '17:00' }, named)).toBe('Schal gekauft, zwanzig Sterne.')
    const day = { day: '2026-11-12', goal_reached: false, stickers: [], paintings: [], entries: [{ building: 'schal', kind: 'buy' as const, stars: -20, at: '17:00' }] }
    expect(dayLine(day, named)).toContain('Schal −20')
  })

  it('writes a day as one line for the parents', () => {
    const day = {
      day: '2026-11-12', goal_reached: true, stickers: ['buecherwurm'], paintings: [],
      entries: [
        { building: 'school', kind: 'visit' as const, stars: 7, at: '15:00' },
        { building: 'malen', kind: 'free' as const, stars: 0, at: '15:20' },
        { building: 'arcade', kind: 'play' as const, stars: -3, at: '16:00' },
      ],
    }
    expect(dayLine(day, name)).toBe('Do 12.11.: Schule +7, Malen, Spielhalle −3. Tagesziel erreicht. Neuer Sticker: Bücherwurm.')
    expect(dayLine({ ...day, goal_reached: false, stickers: [], entries: day.entries.slice(0, 1) }, name)).toBe('Do 12.11.: Schule +7.')
  })
})

describe('sticker catalogue', () => {
  it('has the seventeen stickers of the server, each with a picture, a colour and words', () => {
    expect(STICKERS).toHaveLength(17)
    for (const s of STICKERS) {
      expect(s.emoji).toMatch(/\S/)
      expect(s.color).toMatch(/^#[0-9a-f]{6}$/)
      expect(s.name).toMatch(/\S/)
      expect(s.for).toMatch(/^Für /)
    }
    expect(stickerDef('buecherwurm')?.name).toBe('Bücherwurm')
    expect(stickerDef('nonsense')).toBeUndefined()
  })
})
