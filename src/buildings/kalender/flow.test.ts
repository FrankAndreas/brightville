import { describe, expect, it } from 'vitest'
import { exampleFor, type Activity, type Choice, type ZeitTask } from '@/core/kalender'
import { createZeitFlow, type ZeitEffect } from './flow'

const act = (id: string, say: string): Activity => ({ id, say, emoji: id })
const ITEMS = [act('aufstehen', 'aufstehen'), act('fruehstuecken', 'frühstücken'), act('mittagessen', 'zu Mittag essen'), act('schlafen', 'schlafen')]
const ORDER: ZeitTask = { type: 'order', items: ITEMS, shown: [ITEMS[2], ITEMS[0], ITEMS[3], ITEMS[1]] }
const day = (d: number, say: string): Choice => ({ id: `day-${d}`, say, kind: 'day', day: d })
const DAY: ZeitTask = { type: 'pick', topic: 'day', question: 'Was kommt nach Montag?', choices: [day(4, 'Freitag'), day(1, 'Dienstag'), day(6, 'Sonntag')], answer: 'day-1', focus: 0, aboutToday: false }
const clock = (hour: number, half: boolean, say: string): Choice => ({ id: `clock-${hour}-${half ? 30 : 0}`, say, kind: 'clock', clock: { hour, half } })
const CLOCK: ZeitTask = { type: 'pick', topic: 'clock', question: 'Welche Uhr zeigt drei Uhr?', choices: [clock(3, true, 'halb vier'), clock(3, false, 'drei Uhr'), clock(4, false, 'vier Uhr')], answer: 'clock-3-0' }
const said = (e: ZeitEffect[]) => e.flatMap(x => (x.type === 'speak' ? [x.text] : []))
const THURSDAY = new Date(2026, 10, 19)

describe('the Kalender flow', () => {
  it('asks a day and names each card as it lights up, keeping it all for 🔊', () => {
    const effects = createZeitFlow([DAY], null).start()
    expect(said(effects)).toEqual(['Was kommt nach Montag?', 'Freitag', 'Dienstag', 'Sonntag'])
    // The day the question names lights up in the week; each card lights its day in the week too
    expect(effects[0]).toEqual({ type: 'speak', text: 'Was kommt nach Montag?', light: 'strip-0', ask: true, again: 'Was kommt nach Montag? Freitag, Dienstag, Sonntag.' })
    expect(effects[1]).toEqual({ type: 'speak', text: 'Freitag', light: 'choice-day-4 strip-4' })
  })

  it('names no clock: that would give the answer away', () => {
    expect(said(createZeitFlow([CLOCK], null).start())).toEqual(['Welche Uhr zeigt drei Uhr?'])
  })

  it('cheers a right pick; a wrong one fades and asks again with what is left', () => {
    const flow = createZeitFlow([DAY, DAY], null)
    flow.start()
    const wrong = flow.choose('day-4')
    expect(flow.state.wrong).toEqual(['day-4'])
    expect(said(wrong)).toEqual(['Hör nochmal gut zu.', 'Was kommt nach Montag?', 'Dienstag', 'Sonntag'])
    expect(flow.choose('day-4')).toEqual([])
    const right = flow.choose('day-1')
    expect(right[0]).toEqual({ type: 'chime' })
    expect(said(right)).toEqual(['Dienstag! Super!'])
    expect(flow.state).toMatchObject({ phase: 'cheering', results: [{ ladder: 'zeit', firstTry: false }] })
    expect(flow.choose('day-6')).toEqual([])
  })

  it('cheers a clock without naming it', () => {
    const flow = createZeitFlow([CLOCK], null)
    flow.start()
    expect(said(flow.choose('clock-3-0'))).toEqual(['drei Uhr! Super!'])
  })

  it('asks for the order of a day and takes the pictures in order', () => {
    const flow = createZeitFlow([ORDER, ORDER], null)
    const asked = flow.start()
    // Each picture is named as it lights up, so she knows what it shows
    expect(said(asked)).toEqual(['Was machst du zuerst? Tippe die Bilder der Reihe nach an.', 'zu Mittag essen', 'aufstehen', 'schlafen', 'frühstücken'])
    expect(asked[1]).toEqual({ type: 'speak', text: 'zu Mittag essen', light: 'item-mittagessen' })
    expect(asked[0]).toMatchObject({ again: 'Was machst du zuerst? Tippe die Bilder der Reihe nach an. zu Mittag essen, aufstehen, schlafen, frühstücken.' })
    expect(flow.tap('aufstehen')).toEqual([{ type: 'place', id: 'aufstehen' }, { type: 'speak', text: 'aufstehen', light: 'item-aufstehen' }])
    expect(flow.tap('aufstehen')).toEqual([])
    expect(flow.tap('schlafen')).toEqual([{ type: 'wiggle', id: 'schlafen' }, { type: 'speak', text: 'Hmm, was machst du davor?' }])
    flow.tap('fruehstuecken')
    flow.tap('mittagessen')
    const last = flow.tap('schlafen')
    expect(said(last)).toEqual(['schlafen', 'Zuerst aufstehen, dann frühstücken, dann zu Mittag essen, dann schlafen.', 'Super!'])
    expect(flow.state).toMatchObject({ phase: 'cheering', placed: ['aufstehen', 'fruehstuecken', 'mittagessen', 'schlafen'], results: [{ ladder: 'zeit', firstTry: false }] })
  })

  it('takes no tap in a pick task, no pick in an order task, nothing unknown', () => {
    const flow = createZeitFlow([ORDER], null)
    flow.start()
    expect([flow.choose('day-1'), flow.tap('baden')]).toEqual([[], []])
  })

  it('shows the example line by line, then asks', () => {
    const flow = createZeitFlow([ORDER], exampleFor(1, 0, THURSDAY))
    const effects = flow.start()
    expect(flow.state.phase).toBe('example')
    // The picture moves as its line starts
    expect(effects.slice(0, 2)).toMatchObject([{ type: 'place', id: 'aufstehen' }, { type: 'speak', text: 'Schau: zuerst stehst du auf,', ask: true }])
    expect(effects.filter(e => e.type === 'place').map(e => (e as { id: string }).id)).toEqual(['aufstehen', 'fruehstuecken', 'mittagessen', 'schlafen'])
    expect([flow.tap('aufstehen'), flow.choose('x')]).toEqual([[], []])
    expect(said(flow.exampleDone())[0]).toBe('Was machst du zuerst? Tippe die Bilder der Reihe nach an.')
  })

  it('sets the example\'s clock as it is said', () => {
    const effects = createZeitFlow([CLOCK], exampleFor(5, 0, THURSDAY)).start()
    expect(effects.filter(e => e.type === 'clock')).toEqual([{ type: 'clock', clock: { hour: 3, half: false } }, { type: 'clock', clock: { hour: 3, half: true } }])
  })

  it('gives 10 Stars for five tasks and cheers at the end', () => {
    const flow = createZeitFlow(Array(5).fill(DAY), null)
    flow.start()
    let last: ZeitEffect[] = []
    for (let i = 0; i < 5; i++) {
      flow.choose('day-1')
      last = flow.next()
    }
    expect(flow.state).toMatchObject({ phase: 'done', stars: 10 })
    expect(last).toEqual([{ type: 'confetti' }, { type: 'speak', text: 'Super gemacht!' }])
  })
})
