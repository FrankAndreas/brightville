import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { REST_MS } from '@/core/differences'
import { playBeat } from '@/services/sound'
import { speak } from '@/services/tts'
import { requestLeave } from '../leave'
import Unterschiede from './Unterschiede.vue'
import { SCENES, loadScene, pickScene } from './scenes'

vi.mock('@/services/sound', () => ({ playBeat: vi.fn(), unlockAudio: vi.fn() }))
vi.mock('@/services/tts', () => ({ speak: vi.fn(() => Promise.resolve()), stopSpeaking: vi.fn() }))

const run = (ms: number) => vi.advanceTimersByTimeAsync(ms)
const said = () => vi.mocked(speak).mock.calls.map(c => c[0])
const dots = (w: VueWrapper) => w.findAll('[data-test="dot"]')
const found = (w: VueWrapper) => dots(w).filter(d => d.attributes('data-found') === 'true').length
const starred = (w: VueWrapper) => dots(w).filter(d => d.attributes('data-star') === 'true').length

// jsdom lays nothing out: every picture is 800 × 600 at the top left
const RECT = { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }

async function open(): Promise<VueWrapper> {
  const w = mount(Unterschiede, { props: { scene: 'meer' }, attachTo: document.body })
  await vi.waitFor(() => expect(dots(w)).toHaveLength(10))
  for (const p of w.findAll('[data-test="picture"]')) p.element.getBoundingClientRect = () => RECT as DOMRect
  return w
}

function tapAt(w: VueWrapper, x: number, y: number, picture = 1) {
  w.findAll('[data-test="picture"]')[picture].element.dispatchEvent(
    new PointerEvent('pointerdown', { bubbles: true, clientX: x * 800, clientY: y * 600 }),
  )
}
const tapDot = (w: VueWrapper, i: number, picture = 1) =>
  tapAt(w, Number(dots(w)[i].attributes('data-x')), Number(dots(w)[i].attributes('data-y')), picture)
/** A spot no difference of the scene is near */
async function emptySpot(w: VueWrapper): Promise<[number, number]> {
  const spots = dots(w).map(d => [Number(d.attributes('data-x')), Number(d.attributes('data-y'))])
  for (let y = 0.05; y < 1; y += 0.05) {
    for (let x = 0.05; x < 1; x += 0.05) {
      if (spots.every(([sx, sy]) => Math.hypot((sx - x) * 800, (sy - y) * 600) > 200)) return [x, y]
    }
  }
  throw new Error('no empty spot')
}

describe('the scenes', () => {
  it('has four scenes with enough differences, and nothing in them that runs', async () => {
    expect(SCENES).toHaveLength(4)
    for (const s of SCENES) {
      const svg = await loadScene(s)
      expect(svg.match(/data-diff=/g)?.length, s).toBeGreaterThanOrEqual(10)
      expect(svg, s).not.toMatch(/<script|\son\w+=|href=/i)
    }
  })

  it('never picks the same scene twice in a row', () => {
    let last: string | null = null
    for (let i = 0; i < 50; i++) {
      const next = pickScene(last)
      expect(next).not.toBe(last)
      expect(SCENES).toContain(next)
      last = next
    }
  })
})

describe('Unterschiede', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(speak).mockClear()
    vi.mocked(playBeat).mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('shows two pictures and ten differences to find, and says what to do', async () => {
    const w = await open()
    expect(w.findAll('[data-test="picture"]')).toHaveLength(2)
    expect(found(w)).toBe(0)
    expect(said()[0]).toContain('Unterschiede')
    w.unmount()
  })

  it('marks a found difference with a Star, says what it is, in either picture', async () => {
    const w = await open()
    tapDot(w, 0, 1)
    await run(10)
    expect(found(w)).toBe(1)
    expect(starred(w)).toBe(1)
    expect(playBeat).toHaveBeenCalled()
    expect(said().at(-1)).toBe(dots(w)[0].attributes('data-label'))
    tapDot(w, 1, 0)
    await run(10)
    expect(found(w)).toBe(2)
    // The same one again counts nothing
    tapDot(w, 0, 0)
    await run(10)
    expect(found(w)).toBe(2)
    w.unmount()
  })

  it('lets the pictures rest after five quick misses', async () => {
    const w = await open()
    const [x, y] = await emptySpot(w)
    for (let i = 0; i < 5; i++) {
      tapAt(w, x, y)
      await run(100)
    }
    expect(w.find('[data-test="unterschiede"]').attributes('data-resting')).toBe('true')
    expect(said().at(-1)).toBe('Schau genau hin!')
    // A difference tapped while resting is not taken
    tapDot(w, 0)
    await run(10)
    expect(found(w)).toBe(0)
    await run(REST_MS)
    expect(w.find('[data-test="unterschiede"]').attributes('data-resting')).toBe('false')
    tapDot(w, 0)
    await run(10)
    expect(found(w)).toBe(1)
    w.unmount()
  })

  it('shows one difference with the lamp; that one gives no Star', async () => {
    const w = await open()
    await w.find('[data-test="hint"]').trigger('click')
    const shown = dots(w).findIndex(d => d.attributes('data-hinted') === 'true')
    expect(shown).toBeGreaterThanOrEqual(0)
    expect(w.find('[data-test="hint-marker"]').exists()).toBe(true)
    tapDot(w, shown)
    await run(10)
    expect(found(w)).toBe(1)
    expect(starred(w)).toBe(0)
    w.unmount()
  })

  it('cheers after the tenth and goes back to the town with a Star per difference found alone', async () => {
    const w = await open()
    await w.find('[data-test="hint"]').trigger('click')
    for (let i = 0; i < 10; i++) {
      tapDot(w, i)
      await run(10)
    }
    expect(found(w)).toBe(10)
    expect(w.emitted('finished')).toBeUndefined()
    await run(1000)
    expect(said()).toContain('Super! Alle Unterschiede gefunden!')
    expect(w.find('[data-test="confetti"]').exists()).toBe(true)
    await run(4000)
    expect(w.emitted('finished')).toEqual([[{ stars: 9 }]])
    w.unmount()
  })

  it('keeps the Stars found so far when leaving early, once', async () => {
    const w = await open()
    tapDot(w, 0)
    tapDot(w, 1)
    await run(10)
    requestLeave()
    requestLeave()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }))
    expect(w.emitted('finished')).toEqual([[{ stars: 2 }]])
    w.unmount()
  })

  it('leaves no timers behind when left during the cheer', async () => {
    const w = await open()
    for (let i = 0; i < 10; i++) tapDot(w, i)
    await run(10)
    requestLeave()
    await run(10_000)
    expect(w.emitted('finished')).toEqual([[{ stars: 10 }]])
    w.unmount()
  })
})
