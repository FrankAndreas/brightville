import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { beatTimes, LEAD_IN, type RhythmTask } from '@/core/rhythm'
import type { Level, Microphone } from '@/services/microphone'
import { playBeat } from '@/services/sound'
import { speak } from '@/services/tts'
import { useSchoolStore } from '@/stores/school'
import { requestLeave } from '../leave'
import Trommelhaus from './Trommelhaus.vue'

vi.mock('@/services/sound', () => ({ playBeat: vi.fn(), unlockAudio: vi.fn() }))
vi.mock('@/services/tts', async () => {
  const { ref } = await import('vue')
  const speak = vi.fn<(text?: string) => Promise<void>>(() => Promise.resolve())
  const instruction = ref<string | null>(null)
  const instruct = vi.fn((text: string) => { instruction.value = text; return speak(text) })
  return { speak, stopSpeaking: vi.fn(), instruct, instruction, forgetInstruction: vi.fn(() => { instruction.value = null }) }
})

const COPY: RhythmTask = { type: 'copy', gaps: [500, 500] }
const KEEP: RhythmTask = { type: 'keep', bpm: 90 }
const run = (ms: number) => vi.advanceTimersByTimeAsync(ms)
const said = () => vi.mocked(speak).mock.calls.map(x => x[0])

/** A microphone the test claps into */
function fakeMic() {
  let each: ((l: Level) => void) | null = null
  const listenedAt: number[] = []
  const mic: Microphone & { listenedAt: number[]; closed: boolean } = {
    listenedAt, closed: false,
    listen(cb) { each = cb; listenedAt.push(Date.now()); return () => { each = null } },
    close() { mic.closed = true },
  }
  /** Room noise for `ms`, with claps at the given times (ms from now) */
  const room = async (ms: number, claps: number[] = []) => {
    const start = Date.now()
    for (let t = 0; t < ms; t += 10) {
      each?.({ t: start + t, level: claps.some(c => t >= c && t < c + 30) ? 0.5 : 0.01 })
      await run(10)
    }
  }
  return { mic, room }
}

async function open(tasks: RhythmTask[], props: Record<string, unknown> = {}): Promise<VueWrapper> {
  const w = mount(Trommelhaus, { props: { tasks, example: false, micAvailable: true, ...props }, attachTo: document.body })
  await run(10)
  return w
}

describe('Trommelhaus', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.mocked(speak).mockClear()
    vi.mocked(playBeat).mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('asks tapping or clapping at the door, and starts straight away with tapping where there is no microphone', async () => {
    const w = await open([COPY])
    expect(said()).toEqual(['Willst du tippen oder klatschen?'])
    expect(w.find('[data-test="choose-clap"]').exists()).toBe(true)
    w.unmount()
    vi.mocked(speak).mockClear()
    const noMic = await open([COPY], { micAvailable: false })
    expect(said()).toEqual(['Hör zu und mach es nach!'])
    expect(noMic.find('[data-test="drum-big"]').exists()).toBe(true)
    noMic.unmount()
  })

  it('takes a rhythm copied on the drum', async () => {
    const w = await open([COPY, COPY])
    await w.find('[data-test="choose-tap"]').trigger('pointerdown')
    await run(2000)
    expect(playBeat).toHaveBeenCalledWith('drum')
    const drum = w.find('[data-test="drum-big"]')
    await drum.trigger('pointerdown'); await run(500)
    await drum.trigger('pointerdown'); await run(500)
    await drum.trigger('pointerdown'); await run(2000)
    expect(playBeat).toHaveBeenCalledWith('chime')
    expect(said()).toContain('Super!')
    w.unmount()
  })

  it('takes taps that keep the beat', async () => {
    const w = await open([KEEP, COPY])
    await w.find('[data-test="choose-tap"]').trigger('pointerdown')
    const times = beatTimes(KEEP)
    // Wait for the first beat to join, then tap on every beat
    await run(times[LEAD_IN])
    for (let k = LEAD_IN; k < times.length; k++) {
      await w.find('[data-test="drum-big"]').trigger('pointerdown')
      await run(times[1] - times[0])
    }
    await run(1000)
    expect(said()).toContain('Super!')
    w.unmount()
  })

  it('hears claps, and only listens after the house has stopped playing', async () => {
    const { mic, room } = fakeMic()
    const w = await open([COPY, COPY], { openMic: () => Promise.resolve(mic) })
    const chose = Date.now()
    await w.find('[data-test="choose-clap"]').trigger('pointerdown')
    await run(1500)
    const lastBeat = chose + beatTimes(COPY).at(-1)!
    expect(mic.listenedAt[0]).toBeGreaterThan(lastBeat)
    await room(3500, [200, 700, 1200])
    expect(said()).toContain('Super!')
    w.unmount()
    expect(mic.closed).toBe(true)
  })

  it('claps without the house drumming along once the beat has started', async () => {
    const { mic } = fakeMic()
    const w = await open([KEEP], { openMic: () => Promise.resolve(mic) })
    await w.find('[data-test="choose-clap"]').trigger('pointerdown')
    await run(beatTimes(KEEP).at(-1)! + 100)
    expect(vi.mocked(playBeat).mock.calls.filter(c => c[0] === 'drum')).toHaveLength(LEAD_IN)
    w.unmount()
  })

  it('goes on by tapping when the microphone says no', async () => {
    const w = await open([COPY], { openMic: () => Promise.resolve(null) })
    await w.find('[data-test="choose-clap"]').trigger('pointerdown')
    await run(10)
    expect(said()).toContain('Das Mikrofon hört gerade nicht zu. Dann tippen wir!')
    expect(w.find('[data-test="drum-big"]').exists()).toBe(true)
    w.unmount()
  })

  it('asks again when she doesn\'t start', async () => {
    const w = await open([COPY])
    await w.find('[data-test="choose-tap"]').trigger('pointerdown')
    await run(2000 + 6500)
    expect(said().filter(t => t === 'Hör zu und mach es nach!')).toHaveLength(2)
    w.unmount()
  })

  it('records the tasks for the child who started, at the visit\'s step, and closes the microphone on leaving', async () => {
    const school = useSchoolStore()
    school.ladders = { ...school.ladders, rhythmus: { step: 4, window: [] } }
    school.who = 2
    const record = vi.spyOn(school, 'record').mockImplementation(() => {})
    const { mic } = fakeMic()
    const w = await open([COPY], { openMic: () => Promise.resolve(mic) })
    await w.find('[data-test="choose-clap"]').trigger('pointerdown')
    await run(1500)
    school.who = 3
    requestLeave()
    await run(10)
    expect(mic.closed).toBe(true)
    expect(record).toHaveBeenCalledWith([], { rhythmus: 4 }, 2)
    expect(w.emitted('finished')?.[0]).toEqual([{ stars: 0 }])
  })

  it('shows two drums for loud and quiet when tapping', async () => {
    const w = await open([{ type: 'dynamics', order: ['leise', 'leise', 'laut', 'laut'] }], { micAvailable: false })
    expect(w.find('[data-test="drum-small"]').exists()).toBe(true)
    w.unmount()
  })
})
