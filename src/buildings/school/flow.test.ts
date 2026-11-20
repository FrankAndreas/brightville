import { describe, expect, it } from 'vitest'
import { SET_BONUS, STARS_PER_TASK, createSchoolFlow, type SchoolFlow } from './flow'
import type { Task } from '@/core/numbers'
import { TEST_TASKS, TEST_THINGS } from './testTasks'

const start = (): SchoolFlow => {
  const flow = createSchoolFlow(TEST_TASKS, TEST_THINGS)
  flow.start()
  return flow
}
/** Answers the current task correctly and moves on. */
const solve = (flow: SchoolFlow) => {
  flow.answer(flow.state.task!.answer)
  return flow.next()
}

describe('school flow', () => {
  it('asks the first question on start', () => {
    const flow = createSchoolFlow(TEST_TASKS, TEST_THINGS)
    expect(flow.start()).toEqual([{ type: 'speak', text: 'Wie viele Äpfel?', ask: true }])
    expect(flow.state).toMatchObject({ index: 0, phase: 'asking', stars: 0, solved: 0, wrong: [], counted: 0 })
    expect(flow.state.task).toBe(TEST_TASKS[0])
  })

  it('counts along when the child touches objects, up to the amount', () => {
    const flow = start()
    expect(flow.touch()).toEqual([{ type: 'speak', text: 'eins' }])
    expect(flow.touch()).toEqual([{ type: 'speak', text: 'zwei' }])
    expect(flow.touch()).toEqual([{ type: 'speak', text: 'drei' }])
    expect(flow.touch()).toEqual([])
    expect(flow.state.counted).toBe(3)
  })

  it('cheers, gives one star and moves on after a right answer', () => {
    const flow = start()
    expect(flow.answer(3)).toEqual([{ type: 'chime' }, { type: 'speak', text: 'Super! Drei!' }])
    expect(flow.state).toMatchObject({ phase: 'cheering', stars: STARS_PER_TASK, solved: 1 })
    expect(flow.next()).toEqual([{ type: 'speak', text: 'Wie viele Punkte?', ask: true }])
    expect(flow.state).toMatchObject({ index: 1, phase: 'asking', counted: 0, wrong: [] })
  })

  it('fades a wrong answer, recounts and lets the child try again', () => {
    const flow = start()
    flow.touch()
    expect(flow.answer(4)).toEqual([
      { type: 'speak', text: 'Hmm, zähl nochmal mit mir' }, { type: 'recount', amount: 3 },
    ])
    expect(flow.state).toMatchObject({ phase: 'recounting', stars: 0, solved: 0, wrong: [4], counted: 0 })
    expect(flow.recountDone()).toEqual([])
    expect(flow.state).toMatchObject({ phase: 'asking', counted: 3 })
  })

  it('gives the star for a corrected answer', () => {
    const flow = start()
    flow.answer(2)
    flow.recountDone()
    flow.answer(3)
    expect(flow.state).toMatchObject({ stars: 1, solved: 1 })
  })

  it('ignores answers while cheering or recounting', () => {
    const flow = start()
    flow.answer(3)
    expect(flow.answer(3)).toEqual([])
    expect(flow.state.stars).toBe(1)
    flow.next()
    flow.answer(5)
    expect(flow.answer(4)).toEqual([])
    expect(flow.state).toMatchObject({ phase: 'recounting', stars: 1 })
  })

  it('ignores a choice that already faded, and one that is not offered', () => {
    const flow = start()
    flow.answer(4)
    flow.recountDone()
    expect(flow.answer(4)).toEqual([])
    expect(flow.answer(9)).toEqual([])
    expect(flow.state).toMatchObject({ phase: 'asking', wrong: [4] })
  })

  it('does nothing on next or recountDone at the wrong moment', () => {
    const flow = start()
    expect(flow.next()).toEqual([])
    expect(flow.recountDone()).toEqual([])
    expect(flow.state).toMatchObject({ index: 0, phase: 'asking' })
  })

  it('recounts both groups of a sum, and nothing for zero', () => {
    const flow = start()
    solve(flow)
    solve(flow)
    expect(flow.answer(5)).toContainEqual({ type: 'recount', amount: 3 })
    flow.recountDone()
    solve(flow)
    expect(flow.answer(1)).toContainEqual({ type: 'recount', amount: 0 })
  })

  it('ends with 10 stars, confetti and Super gemacht after five tasks', () => {
    const flow = start()
    for (let i = 0; i < 4; i++) solve(flow)
    flow.answer(4)
    // the bonus belongs to the fifth right answer, not to what comes after
    expect(flow.state.stars).toBe(10)
    expect(flow.next()).toEqual([{ type: 'confetti' }, { type: 'speak', text: 'Super gemacht!' }])
    expect(flow.state).toMatchObject({ phase: 'done', task: null, solved: 5, stars: 5 * STARS_PER_TASK + SET_BONUS })
    expect(flow.state.stars).toBe(10)
    expect(flow.answer(4)).toEqual([])
    expect(flow.next()).toEqual([])
  })
})

describe('school flow: ladder results', () => {
  it('keeps for each solved task its ladder and whether it was right on the first try', () => {
    const flow = start()
    solve(flow)
    flow.answer(5)
    flow.recountDone()
    flow.answer(4)
    flow.next()
    expect(flow.state.results).toEqual([
      { ladder: 'zaehlen', firstTry: true },
      { ladder: 'zaehlen', firstTry: false },
    ])
  })

  it('adds nothing for a task left unsolved', () => {
    const flow = start()
    flow.answer(2)
    expect(flow.state.results).toEqual([])
  })

  it('counts big amounts along by tens, then ones', () => {
    const tasks: Task[] = [{ type: 'bars', ladder: 'zaehlen', kind: 0, amount: 34, answer: 34, choices: [33, 34, 35] }]
    const flow = createSchoolFlow(tasks, TEST_THINGS)
    flow.start()
    expect(flow.touch(10)).toEqual([{ type: 'speak', text: 'zehn' }])
    expect(flow.touch(10)).toEqual([{ type: 'speak', text: 'zwanzig' }])
    expect(flow.touch()).toEqual([{ type: 'speak', text: 'einundzwanzig' }])
    expect(flow.answer(33)).toEqual([
      { type: 'speak', text: 'Hmm, zähl nochmal mit mir' }, { type: 'recount', amount: 34, tens: true },
    ])
  })

  it('says the numbers again when counting on goes wrong', () => {
    const tasks: Task[] = [{ type: 'next', ladder: 'zaehlen', kind: 0, from: 2, by: 1, shown: [2, 3, 4], answer: 5, choices: [4, 5, 6] }]
    const flow = createSchoolFlow(tasks, TEST_THINGS)
    flow.start()
    expect(flow.answer(6)).toEqual([
      { type: 'speak', text: 'Hör nochmal gut zu' },
      { type: 'speak', text: 'Zähl weiter: zwei, drei, vier … und dann?', ask: true },
    ])
    expect(flow.state.phase).toBe('asking')
    expect(flow.state.wrong).toEqual([6])
  })
})
