import { describe, expect, it } from 'vitest'
import { answerOrder, layReading, pickText, readingStars, segments, type ReadingProgress } from './rules'
import type { ReadingText } from './texts'

const text = (id: string): ReadingText => ({ id, title: id, sentences: [], glossary: [], questions: [] })
const all = (ids: string[]) => ids.map(id => ({ key: `en:t:${id}`, topic: 't', text: text(id) }))
const read = (day: string, right = 2) => ({ reads: 1, last_read: day, last_right: right })
const joined = (parts: { text: string }[]) => parts.map(p => p.text).join('')
const marked = (parts: ({ text: string } | { text: string; de: string })[]) => parts.filter(p => 'de' in p).map(p => p.text)

describe('reading rules', () => {
  it('picks a text never read first, then the one read longest ago', () => {
    const progress: ReadingProgress = { 'en:t:a': read('2026-11-01'), 'en:t:b': read('2026-11-10') }
    expect(pickText(all(['a', 'b', 'c']), progress, Math.random)?.key).toBe('en:t:c')
    expect(pickText(all(['a', 'b']), progress, Math.random)?.key).toBe('en:t:a')
    expect(pickText([], {}, Math.random)).toBeUndefined()
  })

  it('mixes texts read on the same day', () => {
    const progress: ReadingProgress = { 'en:t:a': read('2026-11-01'), 'en:t:b': read('2026-11-01') }
    const picked = new Set(Array.from({ length: 30 }, () => pickText(all(['a', 'b']), progress, Math.random)?.key))
    expect(picked.size).toBe(2)
  })

  it('marks glossary words as whole words only, any case, longest phrase first', () => {
    const bus = segments('The bus to the business park.', [{ word: 'bus', de: 'Bus' }])
    expect(marked(bus)).toEqual(['bus'])
    expect(joined(bus)).toBe('The bus to the business park.')
    expect(marked(segments('Station Road goes to the station.', [{ word: 'station', de: 'Bahnhof' }]))).toEqual(['Station', 'station'])
    const hostel = segments('We stay at a youth hostel.', [{ word: 'hostel', de: 'Herberge' }, { word: 'youth hostel', de: 'Jugendherberge' }])
    expect(hostel.filter(p => 'de' in p)).toEqual([{ text: 'youth hostel', de: 'Jugendherberge' }])
    const fr = segments("Nous dormons à l'auberge près de l'école.", [{ word: "l'auberge", de: 'die Herberge' }, { word: 'école', de: 'Schule' }])
    expect(marked(fr)).toEqual(["l'auberge", 'école'])
    expect(joined(fr)).toBe("Nous dormons à l'auberge près de l'école.")
  })

  it('mixes the four answers and counts the Stars', () => {
    expect([...answerOrder(Math.random)].sort()).toEqual([0, 1, 2, 3])
    expect(readingStars([true, true, true, true])).toBe(10)
    expect(readingStars([true, false, true, true])).toBe(6)
    expect(readingStars([true, false])).toBe(2)
  })

  it('lays a visit over the record as the server does', () => {
    const once = layReading({}, { lang: 'en', answers: [{ text: 'en:t:a', right: 3 }, { text: 'fr:t:b', right: 4 }] }, '2026-11-12')
    expect(once).toEqual({ 'en:t:a': { reads: 1, last_read: '2026-11-12', last_right: 3 } })
    expect(layReading(once, { lang: 'en', answers: [{ text: 'en:t:a', right: 1 }] }, '2026-11-13')['en:t:a'])
      .toEqual({ reads: 2, last_read: '2026-11-13', last_right: 1 })
  })
})
