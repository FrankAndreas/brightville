import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import type { Card } from '@/core/memory'
import { playBeat } from '@/services/sound'
import { speak } from '@/services/tts'
import { requestLeave } from '../leave'
import Arcade from './Arcade.vue'
import { ANIMALS, COLUMNS, PAIRS_PER_ROUND } from './cards'

vi.mock('@/services/sound', () => ({ playBeat: vi.fn(), unlockAudio: vi.fn() }))
vi.mock('@/services/tts', () => ({ speak: vi.fn(() => Promise.resolve()), stopSpeaking: vi.fn() }))

// A deck in a known order: the two cards of a pair lie next to each other
const deck: Card[] = ANIMALS.slice(0, PAIRS_PER_ROUND).flatMap(p => [{ ...p, key: `${p.id}-a` }, { ...p, key: `${p.id}-b` }])

const press = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code }))
const run = (ms: number) => vi.advanceTimersByTimeAsync(ms)
const cards = (w: VueWrapper) => w.findAll('[data-test="card"]')
const face = (w: VueWrapper, i: number) => cards(w)[i].attributes('data-face')
const click = (w: VueWrapper, i: number) => cards(w)[i].trigger('pointerdown')

async function open(): Promise<VueWrapper> {
  const w = mount(Arcade, { props: { deck }, attachTo: document.body })
  await run(10)
  return w
}

describe('Arcade', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(speak).mockClear()
    vi.mocked(playBeat).mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('has enough animals and a full grid', () => {
    expect(ANIMALS.length).toBeGreaterThanOrEqual(12)
    expect(new Set(ANIMALS.map(a => a.id)).size).toBe(ANIMALS.length)
    expect((PAIRS_PER_ROUND * 2) % COLUMNS).toBe(0)
  })

  it('starts with 12 cards face down', async () => {
    const w = await open()
    expect(cards(w)).toHaveLength(12)
    expect(cards(w).every(c => c.attributes('data-face') === 'down')).toBe(true)
    w.unmount()
  })

  it('deals a shuffled round of its own when no deck is given', async () => {
    const w = mount(Arcade)
    await run(10)
    expect(cards(w)).toHaveLength(12)
    w.unmount()
  })

  it('turns a card on a click and says the animal', async () => {
    const w = await open()
    await click(w, 0)
    expect(face(w, 0)).toBe('up')
    expect(speak).toHaveBeenLastCalledWith(deck[0].say)
    w.unmount()
  })

  it('keeps a pair open and chimes', async () => {
    const w = await open()
    await click(w, 0)
    await click(w, 1)
    await run(2000)
    expect(face(w, 0)).toBe('up')
    expect(cards(w)[1].attributes('data-matched')).toBe('true')
    expect(playBeat).toHaveBeenCalledWith('chime')
    w.unmount()
  })

  it('turns two different cards back after 1200 ms', async () => {
    const w = await open()
    await click(w, 0)
    await click(w, 2)
    await run(1100)
    expect([face(w, 0), face(w, 2)]).toEqual(['up', 'up'])
    await run(200)
    expect([face(w, 0), face(w, 2)]).toEqual(['down', 'down'])
    expect(playBeat).not.toHaveBeenCalled()
    w.unmount()
  })

  it('ignores a third card while two different ones are showing', async () => {
    const w = await open()
    await click(w, 0)
    await click(w, 2)
    await click(w, 4)
    expect(face(w, 4)).toBe('down')
    w.unmount()
  })

  it('plays with the arrow keys and Enter', async () => {
    const w = await open()
    expect(cards(w)[0].attributes('data-focus')).toBe('true')
    press('Enter')
    press('ArrowRight')
    await run(10)
    expect(cards(w)[1].attributes('data-focus')).toBe('true')
    press('Enter')
    await run(10)
    expect(cards(w)[1].attributes('data-matched')).toBe('true')
    press('ArrowDown')
    await run(10)
    expect(cards(w)[1 + COLUMNS].attributes('data-focus')).toBe('true')
    w.unmount()
  })

  it('stops the highlight at the edges', async () => {
    const w = await open()
    press('ArrowLeft')
    press('ArrowUp')
    await run(10)
    expect(cards(w)[0].attributes('data-focus')).toBe('true')
    for (let i = 0; i < 10; i++) press('ArrowRight')
    for (let i = 0; i < 10; i++) press('ArrowDown')
    await run(10)
    expect(cards(w)[11].attributes('data-focus')).toBe('true')
    w.unmount()
  })

  it('finishes with confetti and no stars when all pairs are found', async () => {
    const w = await open()
    for (let i = 0; i < 12; i++) await click(w, i)
    await run(1000)
    expect(w.find('[data-test="confetti"]').exists()).toBe(true)
    expect(speak).toHaveBeenLastCalledWith('Super gemacht!')
    expect(w.emitted('finished')).toBeUndefined()
    await run(3100)
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
    w.unmount()
  })

  it('leaves on Escape and clears its timers', async () => {
    const w = await open()
    await click(w, 0)
    await click(w, 2)
    press('Escape')
    await run(10)
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
    expect(vi.getTimerCount()).toBe(0)
    await run(5000)
    expect(w.emitted('finished')).toHaveLength(1)
    w.unmount()
  })

  it('leaves by the button like by Escape, and only once', async () => {
    const w = await open()
    await click(w, 0)
    await click(w, 2)
    // the two cards differ: their turn-back timer is waiting
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    requestLeave()
    requestLeave()
    await run(10)
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
    expect(vi.getTimerCount()).toBe(0)
    w.unmount()
  })

  it('no longer answers the button after it has gone', async () => {
    const w = await open()
    w.unmount()
    requestLeave()
    expect(w.emitted('finished')).toBeUndefined()
  })

  it('clears its timers when the screen goes away', async () => {
    const w = await open()
    await click(w, 0)
    await click(w, 2)
    w.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('shows no text besides the pictures', async () => {
    const w = await open()
    expect(w.text()).toBe('')
    w.unmount()
  })
})
