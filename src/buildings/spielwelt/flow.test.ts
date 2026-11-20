import { describe, expect, it } from 'vitest'
import { exampleFor, type RaumTask } from '@/core/raum'
import { holds, OBJECTS, placeFor, startArrangement, type Arrangement } from '@/core/world'
import { createRaumFlow, type RaumEffect } from './flow'

const PLACE: RaumTask = { type: 'place', thing: 'ball', clues: [{ word: 'auf', object: 'tisch' }] }
const FIND: RaumTask = { type: 'find', thing: 'katze', clues: [{ word: 'unter', object: 'bank' }] }
const said = (e: RaumEffect[]) => e.flatMap(x => (x.type === 'speak' ? [x.text] : []))
const open = (tasks: RaumTask[], example = null as ReturnType<typeof exampleFor>) => {
  let arrangement: Arrangement = startArrangement()
  const flow = createRaumFlow(tasks, example, () => arrangement, () => 76, 1)
  const apply = (effects: RaumEffect[]) => {
    for (const e of effects) if (e.type === 'setup') arrangement = e.arrangement
    return effects
  }
  return { flow, apply, get arrangement() { return arrangement } }
}
const tisch = OBJECTS.find(o => o.id === 'tisch')!

describe('the Spielwelt flow', () => {
  it('gets the task ready, then says it', () => {
    const { flow, apply } = open([PLACE])
    const effects = apply(flow.start())
    expect(effects[0].type).toBe('setup')
    // The object lights up as the task is said
    expect(effects[1]).toEqual({ type: 'speak', text: 'Leg den Ball auf den Tisch.', light: 'object-tisch', ask: true })
  })

  it('cheers the thing let go where the clue is true', () => {
    const { flow, apply } = open([PLACE, FIND])
    apply(flow.start())
    const effects = flow.released('ball', placeFor({ word: 'auf', object: 'tisch' }))
    expect(effects).toEqual([{ type: 'chime' }, { type: 'speak', text: 'Super!' }])
    expect(flow.state).toMatchObject({ phase: 'cheering', stars: 1, results: [{ ladder: 'raum', firstTry: true }] })
  })

  it('says where the thing is when it is let go near but wrong, and asks again', () => {
    const { flow, apply } = open([PLACE, FIND])
    apply(flow.start())
    const effects = flow.released('ball', { x: tisch.x, y: 80, lane: 'mid', under: 'tisch' })
    expect(said(effects)).toEqual(['Der Ball ist jetzt unter dem Tisch. Leg ihn auf den Tisch.'])
    expect(flow.state.missed).toBe(true)
    flow.released('ball', placeFor({ word: 'auf', object: 'tisch' }))
    expect(flow.state.results).toEqual([{ ladder: 'raum', firstTry: false }])
  })

  it('names the clue still missing in a task with two', () => {
    const TWO: RaumTask = { type: 'place', thing: 'hut', clues: [{ word: 'hinter', object: 'busch' }, { word: 'rechts neben', object: 'stein' }] }
    const { flow, apply } = open([TWO])
    apply(flow.start())
    const busch = OBJECTS.find(o => o.id === 'busch')!
    expect(said(flow.released('hut', { x: busch.x + 10, y: 74, lane: 'back' }))).toEqual(['Der Hut ist jetzt hinter dem Busch. Leg ihn rechts neben den Stein.'])
  })

  it('lets a thing be set down far away, or another thing anywhere, without a word', () => {
    const { flow, apply } = open([PLACE])
    apply(flow.start())
    expect(flow.released('ball', { x: 500, y: 80, lane: 'mid' })).toEqual([])
    expect(flow.released('teddy', { x: tisch.x, y: 80, lane: 'mid', under: 'tisch' })).toEqual([])
    expect(flow.state.missed).toBe(false)
  })

  it('hides the thing to find, and cheers a tap on it', () => {
    const t = open([FIND, PLACE])
    t.apply(t.flow.start())
    expect(holds(t.arrangement.katze, FIND.clues[0])).toBe(true)
    expect(t.flow.tapThing('katze')).toEqual([{ type: 'chime' }, { type: 'speak', text: 'Super! Da ist die Katze!' }])
  })

  it('names a wrong thing and says the task again', () => {
    const { flow, apply } = open([FIND, PLACE])
    apply(flow.start())
    expect(said(flow.tapThing('ball'))).toEqual(['Das ist der Ball. Die Katze ist unter der Bank. Findest du sie?'])
    flow.tapThing('katze')
    expect(flow.state.results).toEqual([{ ladder: 'raum', firstTry: false }])
  })

  it('takes taps only in a finding task, and nothing during the cheer', () => {
    const { flow, apply } = open([PLACE, FIND])
    apply(flow.start())
    expect(flow.tapThing('ball')).toEqual([])
    flow.released('ball', placeFor({ word: 'auf', object: 'tisch' }))
    expect(flow.released('ball', placeFor({ word: 'auf', object: 'tisch' }))).toEqual([])
    expect(flow.tapThing('katze')).toEqual([])
  })

  it('shows the example by moving the ball, then gets the first task ready', () => {
    const { flow, apply } = open([PLACE], exampleFor(1, 0))
    const effects = flow.start()
    expect(flow.state.phase).toBe('example')
    expect(effects.filter(e => e.type === 'show')).toHaveLength(2)
    expect(effects[1]).toMatchObject({ type: 'speak', text: 'Schau: Der Ball ist auf dem Tisch.', ask: true })
    expect([flow.tapThing('ball'), flow.released('ball', placeFor({ word: 'auf', object: 'tisch' }))]).toEqual([[], []])
    expect(apply(flow.exampleDone())[0].type).toBe('setup')
  })

  it('opens free play after the fifth task, and takes nothing more', () => {
    const { flow, apply } = open(Array(5).fill(PLACE))
    apply(flow.start())
    let last: RaumEffect[] = []
    for (let i = 0; i < 5; i++) {
      flow.released('ball', placeFor({ word: 'auf', object: 'tisch' }))
      last = apply(flow.next())
    }
    expect(flow.state).toMatchObject({ phase: 'free', stars: 10 })
    expect(last).toEqual([{ type: 'free' }, { type: 'speak', text: 'Super gemacht! Jetzt darfst du frei spielen.' }])
    expect(flow.released('ball', placeFor({ word: 'auf', object: 'tisch' }))).toEqual([])
  })
})
