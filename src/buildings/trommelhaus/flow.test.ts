import { describe, expect, it } from 'vitest'
import type { Hit, RhythmTask } from '@/core/rhythm'
import { createRhythmFlow, type RhythmEffect } from './flow'

const COPY: RhythmTask = { type: 'copy', gaps: [500, 500] }
const RIGHT: Hit[] = [{ t: 0 }, { t: 500 }, { t: 1000 }]
const WRONG: Hit[] = [{ t: 0 }, { t: 900 }]
const said = (e: RhythmEffect[]) => e.flatMap(x => (x.type === 'speak' ? [x.text] : []))

describe('the Trommelhaus flow', () => {
  it('asks tapping or clapping first, then the task in the chosen way', () => {
    const flow = createRhythmFlow([COPY], false)
    expect(said(flow.start())).toEqual(['Willst du tippen oder klatschen?'])
    expect(flow.state.phase).toBe('choosing')
    const effects = flow.choose('clap')
    expect(flow.state.mode).toBe('clap')
    expect(effects).toEqual([{ type: 'speak', text: 'Hör zu und mach es nach!', ask: true }, { type: 'turn', task: COPY, mode: 'clap' }])
  })

  it('goes on by tapping when the microphone says no', () => {
    const flow = createRhythmFlow([COPY], false)
    flow.start()
    const effects = flow.micFailed()
    expect(flow.state.mode).toBe('tap')
    expect(said(effects)[0]).toBe('Das Mikrofon hört gerade nicht zu. Dann tippen wir!')
    expect(effects.at(-1)).toEqual({ type: 'turn', task: COPY, mode: 'tap' })
  })

  it('shows a task once first while she is new to the step', () => {
    const flow = createRhythmFlow([COPY], true)
    flow.start()
    const shown = flow.choose('tap')
    expect(flow.state.phase).toBe('example')
    expect(shown).toEqual([{ type: 'speak', text: 'Schau und hör zu, so geht das.', ask: true }, { type: 'show', task: COPY, mode: 'tap' }])
    expect(flow.answered(RIGHT)).toEqual([])
    expect(flow.exampleDone().at(-1)).toEqual({ type: 'turn', task: COPY, mode: 'tap' })
  })

  it('cheers a right answer', () => {
    const flow = createRhythmFlow([COPY, COPY], false)
    flow.start(); flow.choose('tap')
    expect(flow.answered(RIGHT)).toEqual([{ type: 'chime' }, { type: 'speak', text: 'Super!' }])
    expect(flow.state).toMatchObject({ phase: 'cheering', stars: 1, results: [{ ladder: 'rhythmus', firstTry: true }] })
  })

  it('plays it again after a miss, and shows it and goes on after three', () => {
    const flow = createRhythmFlow([COPY, COPY], false)
    flow.start(); flow.choose('tap')
    expect(flow.answered(WRONG)).toEqual([{ type: 'speak', text: 'Hör nochmal gut zu.' }, { type: 'turn', task: COPY, mode: 'tap' }])
    flow.answered(WRONG)
    const last = flow.answered(WRONG)
    expect(said(last)).toEqual(['Hör zu, so geht’s.', 'Das üben wir noch. Weiter geht’s!'])
    expect(last).toContainEqual({ type: 'show', task: COPY, mode: 'tap' })
    expect(flow.state).toMatchObject({ phase: 'cheering', stars: 1, results: [{ ladder: 'rhythmus', firstTry: false }] })
  })

  it('asks again when she doesn\'t start; two silences are one try', () => {
    const flow = createRhythmFlow([COPY], false)
    flow.start(); flow.choose('tap')
    expect(flow.silent()).toEqual([{ type: 'speak', text: 'Hör zu und mach es nach!', ask: true }, { type: 'turn', task: COPY, mode: 'tap' }])
    flow.silent()
    expect(flow.state.tries).toBe(1)
  })

  it('switches to tapping when the microphone hears nothing in two tasks running', () => {
    const flow = createRhythmFlow([COPY, COPY, COPY], false)
    flow.start(); flow.choose('clap')
    // Six silences: three tries in the first task (it is shown and ends), then two in the next
    for (let i = 0; i < 6; i++) flow.silent()
    flow.next()
    flow.silent()
    const switched = flow.silent()
    expect(flow.state.mode).toBe('tap')
    expect(said(switched)).toEqual(['Ich höre dich nicht. Tipp einfach auf die Trommel!', 'Hör zu und mach es nach!'])
    expect(switched.at(-1)).toEqual({ type: 'turn', task: COPY, mode: 'tap' })
  })

  it('switches to tapping at once when the microphone is dead, without counting a try', () => {
    const flow = createRhythmFlow([COPY], false)
    flow.start(); flow.choose('clap')
    const effects = flow.micDead()
    expect(flow.state).toMatchObject({ mode: 'tap', tries: 0 })
    expect(said(effects)).toEqual(['Ich höre dich nicht. Tipp einfach auf die Trommel!', 'Hör zu und mach es nach!'])
    expect(effects.at(-1)).toEqual({ type: 'turn', task: COPY, mode: 'tap' })
  })

  it('takes nothing while choosing, during the example or the cheer', () => {
    const flow = createRhythmFlow([COPY, COPY], false)
    flow.start()
    expect([flow.answered(RIGHT), flow.silent()]).toEqual([[], []])
    flow.choose('tap')
    flow.answered(RIGHT)
    expect([flow.answered(RIGHT), flow.silent()]).toEqual([[], []])
  })

  it('gives 10 Stars for five tasks and cheers at the end', () => {
    const flow = createRhythmFlow(Array(5).fill(COPY), false)
    flow.start(); flow.choose('tap')
    let last: RhythmEffect[] = []
    for (let i = 0; i < 5; i++) {
      flow.answered(RIGHT)
      last = flow.next()
    }
    expect(flow.state).toMatchObject({ phase: 'done', stars: 10 })
    expect(last).toEqual([{ type: 'confetti' }, { type: 'speak', text: 'Super gemacht!' }])
  })
})
