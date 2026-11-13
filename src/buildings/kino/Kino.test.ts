import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import type { Film } from '@/services/api'
import { speak } from '@/services/tts'
import { requestLeave } from '../leave'
import Kino from './Kino.vue'
import { PLAYER_ORIGIN } from './youtube'

vi.mock('@/services/tts', async () => {
  const { ref } = await import('vue')
  const speak = vi.fn<(text?: string) => Promise<void>>(() => Promise.resolve())
  // An instruction is spoken like anything else, and kept for the 🔊 button
  const instruction = ref<string | null>(null)
  const instruct = vi.fn((text: string) => { instruction.value = text; return speak(text) })
  return { speak, stopSpeaking: vi.fn(), instruct, instruction, forgetInstruction: vi.fn(() => { instruction.value = null }) }
})

const FILMS: Film[] = [
  { id: 1, youtube_id: 'dQw4w9WgXcQ', title: 'Lieder' },
  { id: 2, youtube_id: 'aaaaaaaaaaa', title: '' },
]
const run = (ms: number) => vi.advanceTimersByTimeAsync(ms)
const tiles = (w: VueWrapper) => w.findAll('[data-test="film"]')
const player = (w: VueWrapper) => w.find('iframe')
const fromPlayer = (data: unknown, origin = PLAYER_ORIGIN) =>
  window.dispatchEvent(new MessageEvent('message', { origin, data: JSON.stringify(data) }))

function open(films = FILMS): VueWrapper {
  return mount(Kino, { props: { films }, attachTo: document.body })
}

describe('Kino', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(speak).mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('shows a picture of every film and asks the child to pick one', async () => {
    const w = open()
    await run(10)
    expect(tiles(w)).toHaveLength(2)
    expect(tiles(w)[0].find('img').attributes('src')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg')
    expect(player(w).exists()).toBe(false)
    expect(speak).toHaveBeenCalledWith('Such dir einen Film aus.')
    w.unmount()
  })

  it('plays the picked film in the privacy-enhanced player, without the others to pick', async () => {
    const w = open()
    await tiles(w)[1].trigger('click')
    const src = new URL(player(w).attributes('src')!)
    expect(src.origin).toBe('https://www.youtube-nocookie.com')
    expect(src.pathname).toBe('/embed/aaaaaaaaaaa')
    expect(src.searchParams.get('autoplay')).toBe('1')
    expect(src.searchParams.get('rel')).toBe('0')
    expect(src.searchParams.get('enablejsapi')).toBe('1')
    // YouTube's player refuses to start without knowing the page it is on
    expect(player(w).attributes('referrerpolicy')).toBe('strict-origin-when-cross-origin')
    expect(player(w).attributes('allow')).toContain('autoplay')
    expect(tiles(w)).toHaveLength(0)
    w.unmount()
  })

  it('keeps the player in a sandbox it cannot leave: no new windows, no leaving the page', async () => {
    const w = open()
    await tiles(w)[0].trigger('click')
    const allowed = player(w).attributes('sandbox')!.split(/\s+/)
    expect(allowed).toEqual(expect.arrayContaining(['allow-scripts', 'allow-same-origin']))
    for (const escape of ['allow-popups', 'allow-top-navigation', 'allow-top-navigation-by-user-activation', 'allow-popups-to-escape-sandbox']) {
      expect(allowed).not.toContain(escape)
    }
    w.unmount()
  })

  it('goes back to the town when the film has ended', async () => {
    const w = open()
    await tiles(w)[0].trigger('click')
    fromPlayer({ event: 'infoDelivery', info: { playerState: 1 } })
    await run(5000)
    expect(w.emitted('finished')).toBeUndefined()
    fromPlayer({ event: 'infoDelivery', info: { playerState: 0 } })
    await run(2000)
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
    w.unmount()
  })

  it('understands the player\'s other way of saying it ended', async () => {
    const w = open()
    await tiles(w)[0].trigger('click')
    fromPlayer({ event: 'onStateChange', info: 0 })
    await run(2000)
    expect(w.emitted('finished')).toHaveLength(1)
    w.unmount()
  })

  it('listens to the player only, and to nothing that is not its message', async () => {
    const w = open()
    await tiles(w)[0].trigger('click')
    fromPlayer({ event: 'infoDelivery', info: { playerState: 0 } }, 'https://evil.example')
    window.dispatchEvent(new MessageEvent('message', { origin: PLAYER_ORIGIN, data: 'not json' }))
    window.dispatchEvent(new MessageEvent('message', { origin: PLAYER_ORIGIN, data: { event: 'infoDelivery' } }))
    await run(2000)
    expect(w.emitted('finished')).toBeUndefined()
    w.unmount()
  })

  it('goes back to the town at once with Esc or the leave button, once, during the film too', async () => {
    const w = open()
    await tiles(w)[0].trigger('click')
    requestLeave()
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }))
    fromPlayer({ event: 'onStateChange', info: 0 })
    await run(3000)
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
    expect(player(w).exists()).toBe(false)
    w.unmount()
  })

  it('shows a closed curtain when there are no films', async () => {
    const w = open([])
    await run(10)
    expect(w.find('[data-test="no-films"]').exists()).toBe(true)
    requestLeave()
    expect(w.emitted('finished')).toHaveLength(1)
    w.unmount()
  })
})
