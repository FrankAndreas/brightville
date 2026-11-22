import { describe, expect, it } from 'vitest'
import type { Body } from '@/core/pose/body'
import { mirrored, standing } from '@/core/pose/fixtures'
import { ARMS_T, ARMS_UP, CLAP, HANDS_ON_HEAD, HANDS_ON_HIPS, LEFT_ARM_UP } from '@/core/moves/fixtures'
import { SAY_STEP_IN } from '@/buildings/tanzsaal/flow'
import { createSimonFlow, HOLD_MS, LOWER_MS, matchSimon, pickCommands, REACT_MS, simonStars, type SimonEffect, type SimonFlow } from './simon'
import { coachWords, type SimonMove } from './words'

const STEP = 40
const UNIT = 0.2
const en = coachWords('en')

function feed(flow: SimonFlow, body: Body | null, ms: number): SimonEffect[] {
  const effects: SimonEffect[] = []
  for (let t = 0; t < ms; t += STEP) effects.push(...flow.send({ type: 'frame', body, dtMs: STEP }))
  return effects
}
const said = (effects: SimonEffect[]) => effects.flatMap(e => (e.type === 'speak' ? [e.text] : []))
const kinds = (effects: SimonEffect[]) => effects.map(e => e.type)

function ready(commands: { move: SimonMove; said: boolean }[]) {
  const flow = createSimonFlow(commands, en)
  const first = flow.send({ type: 'cameraReady' })
  const effects = [...first, ...feed(flow, standing(), 1100)]
  return { flow, effects }
}

describe('Simon says: what the camera sees', () => {
  it('tells his left arm from his right, also when seen mirrored', () => {
    expect(matchSimon('leftUp', LEFT_ARM_UP, UNIT)).toBe(true)
    expect(matchSimon('rightUp', LEFT_ARM_UP, UNIT)).toBe(false)
    expect(matchSimon('leftUp', mirrored(LEFT_ARM_UP), UNIT)).toBe(false)
    expect(matchSimon('rightUp', mirrored(LEFT_ARM_UP), UNIT)).toBe(true)
    expect(matchSimon('leftUp', ARMS_UP, UNIT)).toBe(false)
    expect(matchSimon('bothUp', ARMS_UP, UNIT)).toBe(true)
    expect(matchSimon('clap', CLAP, UNIT)).toBe(true)
  })

  it('picks 15 commands, 10 said, none twice in a row, the first one said', () => {
    for (let n = 0; n < 50; n++) {
      const c = pickCommands(Math.random)
      expect(c).toHaveLength(15)
      expect(c.filter(x => x.said)).toHaveLength(10)
      expect(c[0].said).toBe(true)
      for (let i = 1; i < c.length; i++) expect(c[i].move).not.toBe(c[i - 1].move)
    }
  })

  it('Stars by points', () => {
    expect(simonStars(15, 15)).toBe(10)
    expect(simonStars(7, 15)).toBe(5)
    expect(simonStars(0, 15)).toBe(0)
  })
})

describe('Simon says: a visit', () => {
  it('the setup line is German, the command in the language', () => {
    const { effects } = ready([{ move: 'bothUp', said: true }])
    expect(said(effects)).toEqual([SAY_STEP_IN, 'Simon says: raise both arms!'])
    const command = effects.find(e => e.type === 'speak' && e.text.startsWith('Simon'))
    expect(command).toMatchObject({ coach: true, ask: true })
  })

  it('a said command done in time is a point', () => {
    const { flow } = ready([{ move: 'bothUp', said: true }, { move: 'clap', said: true }])
    const effects = feed(flow, ARMS_UP, HOLD_MS + 200)
    expect(kinds(effects)).toContain('hit')
    expect(flow.state.points).toBe(1)
  })

  it('a said command not done in time is missed', () => {
    const { flow } = ready([{ move: 'bothUp', said: true }, { move: 'clap', said: true }])
    const effects = feed(flow, standing(), REACT_MS + 100)
    expect(kinds(effects)).toContain('miss')
    expect(flow.state.points).toBe(0)
  })

  it('a trap followed gets the trap line and no point', () => {
    const { flow } = ready([{ move: 'clap', said: false }, { move: 'bothUp', said: true }])
    const effects = feed(flow, CLAP, LOWER_MS + 400)
    expect(said(effects)).toContain("Simon didn't say so!")
    expect(flow.state.points).toBe(0)
  })

  it('a trap of the move he still holds: lowering within the first moments is fine', () => {
    const { flow } = ready([{ move: 'bothUp', said: true }, { move: 'bothUp', said: false }, { move: 'clap', said: true }])
    feed(flow, ARMS_UP, HOLD_MS + 200)
    // The between pause, still holding
    feed(flow, ARMS_UP, 900)
    expect(flow.state.index).toBe(1)
    feed(flow, ARMS_UP, LOWER_MS - 200)
    feed(flow, standing(), REACT_MS)
    expect(flow.state.points).toBe(2)
  })

  it('out of sight the clock waits, and he loses nothing', () => {
    const { flow } = ready([{ move: 'clap', said: false }, { move: 'bothUp', said: true }])
    feed(flow, null, REACT_MS * 2)
    expect(flow.state.index).toBe(0)
    expect(flow.state.points).toBe(0)
    feed(flow, standing(), 1100 + REACT_MS)
    expect(flow.state.points).toBe(1)
  })

  it('fifteen points give ten Stars and end the visit', () => {
    const body: Record<SimonMove, Body> = {
      bothUp: ARMS_UP, armsOut: ARMS_T, hips: HANDS_ON_HIPS, head: HANDS_ON_HEAD, clap: CLAP,
      leftUp: LEFT_ARM_UP, rightUp: mirrored(LEFT_ARM_UP),
    }
    const commands = pickCommands(Math.random)
    const { flow } = ready(commands)
    for (const c of commands) {
      if (c.said) feed(flow, body[c.move], HOLD_MS + 200)
      else feed(flow, standing(), REACT_MS + 100)
      feed(flow, standing(), 1000)
    }
    expect(flow.state.phase).toBe('done')
    expect(flow.state.points).toBe(15)
    expect(flow.earned()).toBe(10)
  })
})
