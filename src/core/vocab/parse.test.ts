import { describe, expect, it } from 'vitest'
import { parseList } from './parse'

describe('parseList', () => {
  it.each([
    ['der Bahnhof\trailway station'],
    ['der Bahnhof - railway station'],
    ['der Bahnhof – railway station'],
    ['der Bahnhof = railway station'],
    ['der Bahnhof; railway station'],
    ['der Bahnhof;railway station'],
  ])('splits %j', line => {
    expect(parseList(line)).toEqual({ pairs: [{ de: 'der Bahnhof', foreign: 'railway station' }], bad: [] })
  })

  it('a tab wins over the other separators', () => {
    expect(parseList('a\tb - c').pairs).toEqual([{ de: 'a', foreign: 'b - c' }])
  })

  it('takes a list pasted from Word or a PDF', () => {
    const text = '﻿Unit 3\r\n\r\nder Bahnhof - railway station / train station\r\ndas Haus - \r\n  reisen = to travel  \r\n'
    expect(parseList(text)).toEqual({
      pairs: [
        { de: 'der Bahnhof', foreign: 'railway station / train station' },
        { de: 'reisen', foreign: 'to travel' },
      ],
      bad: [1, 4],
    })
  })

  it('keeps a hyphen inside a word', () => {
    expect(parseList('die Grossmutter - grand-mother').pairs).toEqual([{ de: 'die Grossmutter', foreign: 'grand-mother' }])
  })
})
