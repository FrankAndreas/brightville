import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { stopSpeaking } from '@/services/tts'
import { laddersAt } from '@/core/ladders.fixture'
import { useSchoolStore } from '@/stores/school'
import { requestLeave } from './leave'
import { ladderVisit, scoreSolved, useVisit, type Visit } from './visit'

vi.mock('@/services/tts', () => ({ stopSpeaking: vi.fn() }))

/** A building that only holds a visit */
function host(onLeave = vi.fn()) {
  let visit!: Visit
  const w = mount(defineComponent({ setup() { visit = useVisit(onLeave); return () => h('div') } }))
  return { w, visit: () => visit, onLeave }
}

describe('a visit\'s lifecycle', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('runs what comes later, until it is closed; then nothing more', async () => {
    const { w, visit } = host()
    const fn = vi.fn()
    visit().later(fn, 100)
    visit().later(fn, 300)
    await vi.advanceTimersByTimeAsync(150)
    expect(fn).toHaveBeenCalledTimes(1)
    w.unmount()
    await vi.advanceTimersByTimeAsync(500)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(visit().isClosed()).toBe(true)
    expect(stopSpeaking).toHaveBeenCalled()
  })

  it('numbers its runs: an older run is no longer live once a newer starts, or once it is closed', () => {
    const { w, visit } = host()
    const first = visit().newRun()
    expect(first()).toBe(true)
    const second = visit().newRun()
    expect([first(), second()]).toEqual([false, true])
    visit().dropRuns()
    expect(second()).toBe(false)
    const third = visit().newRun()
    w.unmount()
    expect(third()).toBe(false)
  })

  it('answers the leave button, and lets go of it when closed', () => {
    const { w, onLeave } = host()
    requestLeave()
    expect(onLeave).toHaveBeenCalledTimes(1)
    w.unmount()
    requestLeave()
    expect(onLeave).toHaveBeenCalledTimes(1)
  })

  it('cleans up what the building asked it to, once', () => {
    const { w, visit } = host()
    const cleanUp = vi.fn()
    visit().onShutDown(cleanUp)
    visit().shutDown()
    w.unmount()
    expect(cleanUp).toHaveBeenCalledTimes(1)
  })

  it('pauses on its own clock and stops pausing when closed', async () => {
    const { visit } = host()
    const done = vi.fn()
    void visit().pause(200).then(done)
    await vi.advanceTimersByTimeAsync(250)
    expect(done).toHaveBeenCalled()
  })
})

describe('a learning building\'s ladder', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('takes the step, the window and the child once, when the visit starts, and records at that step for that child', () => {
    const school = useSchoolStore()
    school.ladders = laddersAt({ reimen: 3 })
    school.ladders.reimen.window = [true, false]
    school.who = 2
    const record = vi.spyOn(school, 'record').mockImplementation(() => {})
    const visit = ladderVisit('reimen')
    school.ladders = laddersAt({ reimen: 5 })
    school.who = 3
    expect(visit).toMatchObject({ step: 3, windowLength: 2, player: 2 })
    visit.record([{ ladder: 'reimen', firstTry: true }])
    expect(record).toHaveBeenCalledWith([{ ladder: 'reimen', firstTry: true }], { reimen: 3 }, 2)
  })
})

describe('scoring a solved task', () => {
  it('gives a Star per task and the bonus with the last, and notes the first try for the ladder', () => {
    const state = { solved: 0, stars: 0, results: [] as { ladder: 'muster'; firstTry: boolean }[] }
    scoreSolved(state, 'muster', true, 2)
    expect(state).toEqual({ solved: 1, stars: 1, results: [{ ladder: 'muster', firstTry: true }] })
    scoreSolved(state, 'muster', false, 2)
    expect(state).toEqual({ solved: 2, stars: 7, results: [{ ladder: 'muster', firstTry: true }, { ladder: 'muster', firstTry: false }] })
  })
})
