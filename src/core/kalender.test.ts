import { describe, expect, it } from 'vitest'
import { seededRandom } from './numbers'
import {
  buildZeitSession, clockName, DAYS, exampleFor, seasonOf, TASKS_PER_VISIT, weekdayOf, type ZeitTask,
} from './kalender'

type Pick = Extract<ZeitTask, { type: 'pick' }>
const THURSDAY = new Date(2026, 10, 19)
const MONDAY = new Date(2026, 10, 16)
const SUNDAY = new Date(2026, 10, 22)
const sessions = function* (): Generator<[number, ZeitTask[], Date]> {
  for (let seed = 0; seed < 300; seed++) {
    const step = 1 + (seed % 6)
    const today = new Date(2026, seed % 12, 1 + (seed % 28))
    yield [step, buildZeitSession(step, today, seededRandom(seed)), today]
  }
}
const picks = (tasks: ZeitTask[]) => tasks.filter((t): t is Pick => t.type === 'pick')
const topics = (tasks: ZeitTask[]) => tasks.map(t => (t.type === 'order' ? 'order' : t.topic))
const count = (tasks: ZeitTask[], topic: string) => topics(tasks).filter(t => t === topic).length

describe('the real day', () => {
  it('knows the weekday, Monday first, and the season by month', () => {
    expect(weekdayOf(MONDAY)).toBe(0)
    expect(weekdayOf(THURSDAY)).toBe(3)
    expect(weekdayOf(SUNDAY)).toBe(6)
    expect(DAYS[weekdayOf(THURSDAY)]).toBe('Donnerstag')
    // As in the Kindergarten's calendar: the seasons change around the 21st
    expect(seasonOf(new Date(2026, 10, 20))).toBe('herbst')
    expect(seasonOf(new Date(2026, 11, 1))).toBe('herbst')
    expect(seasonOf(new Date(2026, 11, 21))).toBe('winter')
    expect(seasonOf(new Date(2026, 0, 10))).toBe('winter')
    expect(seasonOf(new Date(2026, 2, 1))).toBe('winter')
    expect(seasonOf(new Date(2026, 2, 21))).toBe('fruehling')
    expect(seasonOf(new Date(2026, 5, 21))).toBe('sommer')
    expect(seasonOf(new Date(2026, 8, 22))).toBe('sommer')
    expect(seasonOf(new Date(2026, 8, 23))).toBe('herbst')
  })

  it('names full and half hours the German way', () => {
    expect(clockName({ hour: 3, half: false })).toBe('drei Uhr')
    expect(clockName({ hour: 1, half: false })).toBe('ein Uhr')
    expect(clockName({ hour: 12, half: false })).toBe('zwölf Uhr')
    expect(clockName({ hour: 3, half: true })).toBe('halb vier')
    expect(clockName({ hour: 12, half: true })).toBe('halb eins')
  })
})

describe('a Kalender visit', () => {
  it('asks five tasks of the step\'s kinds', () => {
    expect(TASKS_PER_VISIT).toBe(5)
    for (const [step, tasks] of sessions()) {
      expect(tasks, `step ${step}`).toHaveLength(5)
      if (step === 1) expect(count(tasks, 'order')).toBe(5)
      if (step === 2) expect(count(tasks, 'time')).toBe(5)
      if (step === 3) expect(count(tasks, 'day')).toBe(5)
      if (step === 4) expect([count(tasks, 'day'), count(tasks, 'season')]).toEqual([2, 3])
      if (step === 5) expect([count(tasks, 'clock'), count(tasks, 'day'), count(tasks, 'season')]).toEqual([3, 1, 1])
      if (step === 6) expect(new Set(topics(tasks))).toEqual(new Set(['time', 'day', 'clock', ...topics(tasks).filter(t => t === 'season')]))
    }
  })

  it('has exactly one right choice, all different, the right one in varying places', () => {
    const places = new Set<number>()
    for (const [, tasks] of sessions()) {
      for (const p of picks(tasks)) {
        expect(p.choices.filter(c => c.id === p.answer)).toHaveLength(1)
        expect(new Set(p.choices.map(c => c.id)).size).toBe(p.choices.length)
        expect(p.choices).toHaveLength(p.topic === 'time' || p.topic === 'season' ? 4 : 3)
        if (p.topic === 'day' || p.topic === 'clock') places.add(p.choices.findIndex(c => c.id === p.answer))
      }
    }
    expect(places).toEqual(new Set([0, 1, 2]))
  })

  it('asks no question twice in a visit', () => {
    for (const [, tasks] of sessions()) {
      const keys = tasks.map(t => (t.type === 'order' ? t.items.map(i => i.id).join() : t.question))
      expect(new Set(keys).size).toBe(5)
    }
  })

  it('puts the order of a day in its real order and shows it shuffled', () => {
    // No anziehen: many children have breakfast before they dress
    const order = ['aufstehen', 'fruehstuecken', 'mittagessen', 'abendessen', 'schlafen']
    for (const [, tasks] of sessions()) {
      for (const t of tasks) {
        if (t.type !== 'order') continue
        expect(t.items).toHaveLength(4)
        const at = t.items.map(i => order.indexOf(i.id))
        expect(at).toEqual([...at].sort((a, b) => a - b))
        expect(t.shown.map(i => i.id)).not.toEqual(t.items.map(i => i.id))
        expect(new Set(t.shown.map(i => i.id))).toEqual(new Set(t.items.map(i => i.id)))
      }
    }
  })

  it('wraps the week: after Sunday comes Monday, before Monday Sunday', () => {
    for (const [, tasks] of sessions()) {
      for (const p of picks(tasks).filter(x => x.topic === 'day')) {
        const after = /nach (\w+)\?/.exec(p.question)
        const before = /vor (\w+)\?/.exec(p.question)
        const answer = DAYS.indexOf(p.choices.find(c => c.id === p.answer)?.say ?? '')
        if (after) expect(answer).toBe((DAYS.indexOf(after[1]) + 1) % 7)
        if (before) expect(answer).toBe((DAYS.indexOf(before[1]) + 6) % 7)
      }
    }
  })

  it('points at the day a question names, and shows today\'s sun only when it asks about today', () => {
    for (const [, tasks, today] of sessions()) {
      for (const p of picks(tasks).filter(x => x.topic === 'day')) {
        const named = /(?:nach|vor|ist) (\w+)[?.]/.exec(p.question)?.[1] ?? ''
        expect(p.focus, p.question).toBe(DAYS.indexOf(named))
        expect(p.aboutToday).toBe(p.question.startsWith('Heute') && p.focus === weekdayOf(today))
      }
    }
  })

  it('asks yesterday and tomorrow from the real day', () => {
    for (const today of [MONDAY, THURSDAY, SUNDAY]) {
      for (let seed = 0; seed < 20; seed++) {
        for (const p of picks(buildZeitSession(4, today, seededRandom(seed))).filter(x => x.topic === 'day')) {
          const d = weekdayOf(today)
          expect(p.question.startsWith(`Heute ist ${DAYS[d]}.`)).toBe(true)
          const said = p.choices.find(c => c.id === p.answer)?.say
          expect(said).toBe(p.question.endsWith('gestern?') ? DAYS[(d + 6) % 7] : DAYS[(d + 1) % 7])
        }
      }
    }
  })

  it('takes the real season for "jetzt"', () => {
    for (let seed = 0; seed < 40; seed++) {
      const now = picks(buildZeitSession(4, THURSDAY, seededRandom(seed))).find(p => p.question === 'Welche Jahreszeit haben wir jetzt?')
      if (now) expect(now.answer).toBe('herbst')
    }
  })

  it('offers clocks that are never the right time twice', () => {
    for (const [, tasks] of sessions()) {
      for (const p of picks(tasks).filter(x => x.topic === 'clock')) {
        const right = p.choices.find(c => c.id === p.answer)
        expect(p.question).toBe(`Welche Uhr zeigt ${right?.say}?`)
        for (const c of p.choices) if (c.kind === 'clock') expect(c.clock.hour).toBeGreaterThanOrEqual(1)
      }
    }
  })
})

describe('the example', () => {
  it('comes until two visits are done at the step, never at fertig', () => {
    expect(exampleFor(1, 0, THURSDAY)?.task.type).toBe('order')
    expect(exampleFor(6, 0, THURSDAY)).toBeNull()
    expect(exampleFor(3, 10, THURSDAY)).toBeNull()
  })

  it('says the real day at step 4 and lights it in the week', () => {
    const lines = exampleFor(4, 0, THURSDAY)?.lines ?? []
    expect(lines.map(l => l.text)).toEqual(['Heute ist Donnerstag.', 'Gestern war Mittwoch.', 'Morgen ist Freitag.'])
    expect(lines.map(l => l.light)).toEqual(['strip-3', 'strip-2', 'strip-4'])
  })

  it('shows the clock at three and at half past three', () => {
    const lines = exampleFor(5, 0, THURSDAY)?.lines ?? []
    expect(lines.flatMap(l => (l.clock ? [clockName(l.clock)] : []))).toEqual(['drei Uhr', 'halb vier'])
  })

  it('opens the week with a sentence', () => {
    expect(exampleFor(3, 0, THURSDAY)?.lines[0].text).toBe('Die Woche hat sieben Tage:')
  })

  it('places the pictures of the day one after the other', () => {
    const lines = exampleFor(1, 0, THURSDAY)?.lines ?? []
    expect(lines.flatMap(l => (l.place ? [l.place] : []))).toEqual(['aufstehen', 'fruehstuecken', 'mittagessen', 'schlafen'])
  })
})
