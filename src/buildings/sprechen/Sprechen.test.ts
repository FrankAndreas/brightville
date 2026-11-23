import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { fakeApi, type FakeApi } from '@/services/fakeApi'
import { recognise, stopRecognising } from '@/services/recogniser'
import { speak, stopSpeaking } from '@/services/tts'
import { usePlayerStore } from '@/stores/player'
import { useSpeakStore } from '@/stores/speak'
import { useVocabStore } from '@/stores/vocab'
import { requestLeave } from '../leave'
import Sprechen from './Sprechen.vue'

vi.mock('@/services/sound', () => ({ playBeat: vi.fn(), unlockAudio: vi.fn() }))
vi.mock('@/services/tts', async () => {
  const { ref } = await import('vue')
  return {
    speak: vi.fn(() => Promise.resolve()), instruct: vi.fn(() => Promise.resolve()), stopSpeaking: vi.fn(),
    hasVoice: vi.fn(() => true), voiceCount: ref(1), instruction: ref(null), forgetInstruction: vi.fn(),
  }
})
vi.mock('@/services/recogniser', () => ({ recognise: vi.fn(), stopRecognising: vi.fn(), hasSpeech: () => true }))

const run = (ms: number) => vi.advanceTimersByTimeAsync(ms)
/** What is to be said now: the foreign text on screen for Nachsprechen (all items here are, for a fresh child) */
const toSay = (w: VueWrapper) => w.find('[data-test="say"]').text()
/** The recogniser hears this at the next tap on 🎤 */
const hears = (...h: string[]) => vi.mocked(recognise).mockResolvedValueOnce(h)
async function mic(w: VueWrapper) {
  await w.find('[data-test="mic"]').trigger('click')
  await flushPromises()
}

describe('the Trommelhaus at Oberstufe', () => {
  let api: FakeApi
  beforeEach(async () => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    api = fakeApi({ level: 'oberstufe' })
    window.localStorage.clear()
    vi.mocked(recognise).mockReset()
    vi.mocked(stopRecognising).mockClear()
    const player = usePlayerStore()
    player.init(api, 1, window.localStorage)
    await player.refresh()
    for (const s of [useVocabStore(), useSpeakStore()]) {
      s.init(api, 1, window.localStorage, () => '2026-11-12')
      await s.load()
    }
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  async function opened(lang: 'en' | 'fr' = 'en'): Promise<VueWrapper> {
    const w = mount(Sprechen, { attachTo: document.body })
    await w.find(`[data-test="lang-${lang}"]`).trigger('click')
    await flushPromises()
    return w
  }

  it('language first, then an item to repeat, written and spoken in its voice', async () => {
    const w = await opened('fr')
    expect(w.find('[data-test="mode"]').text()).toContain('Nachsprechen')
    expect(toSay(w)).not.toBe('')
    expect(w.find('[data-test="say"]').attributes('lang')).toBe('fr')
    expect(vi.mocked(speak).mock.calls.at(-1)).toEqual([toSay(w), 'fr-FR'])
    w.unmount()
  })

  it('said right: a Star and the next item', async () => {
    const w = await opened()
    const first = toSay(w)
    hears(first)
    await mic(w)
    expect(w.find('[data-test="stars"]').attributes('data-solved')).toBe('1')
    await run(1500)
    expect(w.find('[data-test="item"]').attributes('data-index')).toBe('1')
    w.unmount()
  })

  it('heard wrong: "Gehört" and another try; after three the right form, spoken, and Weiter', async () => {
    const w = await opened()
    const first = toSay(w)
    hears('zzz')
    await mic(w)
    expect(w.find('[data-test="heard"]').text()).toContain('Gehört: „zzz“')
    expect(w.find('[data-test="tries"]').text()).toContain('Nochmal versuchen (2 von 3)')
    hears('zzz')
    await mic(w)
    hears('zzz')
    await mic(w)
    expect(w.find('[data-test="shown"]').text()).toContain(first)
    expect(vi.mocked(speak).mock.calls.at(-1)?.[0]).toBe(first)
    await w.find('[data-test="next"]').trigger('click')
    expect(w.find('[data-test="item"]').attributes('data-index')).toBe('1')
    w.unmount()
  })

  it('nothing heard and a refused microphone are no tries', async () => {
    const w = await opened()
    hears()
    await mic(w)
    expect(w.find('[data-test="nothing"]').text()).toContain('Nichts gehört')
    vi.mocked(recognise).mockRejectedValueOnce(new Error('not-allowed'))
    await mic(w)
    expect(w.find('[data-test="denied"]').text()).toContain('Das Mikrofon ist nicht erlaubt')
    expect(w.find('[data-test="tries"]').exists()).toBe(false)
    w.unmount()
  })

  it('leaving while listening stops the recogniser; a late answer gives nothing', async () => {
    const w = await opened()
    let answer: (h: string[]) => void = () => {}
    vi.mocked(recognise).mockReturnValueOnce(new Promise(r => { answer = r }))
    const first = toSay(w)
    await w.find('[data-test="mic"]').trigger('click')
    requestLeave()
    expect(stopRecognising).toHaveBeenCalled()
    answer([first])
    await flushPromises()
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
    expect(Object.keys(api.speak_)).toEqual([])
    w.unmount()
  })

  it('a whole round right: 15 Stars, and every item recorded once for the child who started', async () => {
    const w = await opened()
    for (let i = 0; i < 10; i++) {
      hears(toSay(w))
      await mic(w)
      await run(1500)
    }
    expect(w.find('[data-test="end"]').text()).toContain('10 von 10 richtig – 15 ⭐')
    await w.find('[data-test="finish"]').trigger('click')
    await flushPromises()
    expect(w.emitted('finished')).toEqual([[{ stars: 15 }]])
    expect(Object.values(api.speak_).filter(p => p.right === 1)).toHaveLength(10)
    w.unmount()
  })

  it('leaving mid-round records only what was finished', async () => {
    const w = await opened()
    hears(toSay(w))
    await mic(w)
    await run(1500)
    hears('zzz')
    await mic(w)
    requestLeave()
    await flushPromises()
    expect(w.emitted('finished')).toEqual([[{ stars: 1 }]])
    expect(Object.keys(api.speak_)).toHaveLength(1)
    w.unmount()
  })

  it('tapping 🎤 silences the game\'s own voice first, and 🔊 is gone while it listens (it must not answer for him)', async () => {
    const w = await opened()
    vi.mocked(stopSpeaking).mockClear()
    vi.mocked(speak).mockClear()
    vi.mocked(recognise).mockReturnValueOnce(new Promise(() => {}))
    await w.find('[data-test="mic"]').trigger('click')
    expect(stopSpeaking).toHaveBeenCalled()
    expect(vi.mocked(stopSpeaking).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(recognise).mock.invocationCallOrder.at(-1)!)
    expect(w.find('[data-test="hear"]').exists()).toBe(false)
    expect(speak).not.toHaveBeenCalled()
    w.unmount()
  })

  it('a failing recogniser says so', async () => {
    const w = await opened()
    vi.mocked(recognise).mockRejectedValueOnce(new Error('failed'))
    await mic(w)
    expect(w.find('[data-test="failed"]').text()).toContain('Die Spracherkennung geht gerade nicht')
    w.unmount()
  })

  it('Esc leaves from the language screen too', () => {
    const w = mount(Sprechen, { attachTo: document.body })
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }))
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
    w.unmount()
  })
})
