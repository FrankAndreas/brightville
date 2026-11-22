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

  it('composes decomposed accents and drops invisible characters from a PDF', () => {
    const decomposed = 'die Schule - l\'e\u0301cole'
    const hidden = 'das Haus - hou\u00adse\u200b'
    expect(parseList(`${decomposed}\n${hidden}`).pairs).toEqual([
      { de: 'die Schule', foreign: "l'école" }, { de: 'das Haus', foreign: 'house' },
    ])
  })

  it('takes an em dash as a separator, and a line too long to keep is named', () => {
    expect(parseList('das Haus — house').pairs).toEqual([{ de: 'das Haus', foreign: 'house' }])
    const long = `das Haus - ${'x'.repeat(61)}`
    expect(parseList(`der Zug - train\n${long}`)).toEqual({ pairs: [{ de: 'der Zug', foreign: 'train' }], bad: [2] })
  })
})
