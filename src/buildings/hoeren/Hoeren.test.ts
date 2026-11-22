import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { speakLines, stopSpeaking } from '@/services/tts'
import { fakeApi, type FakeApi } from '@/services/fakeApi'
import { usePlayerStore } from '@/stores/player'
import { useListenStore } from '@/stores/listen'
import { allScenes, SCENES } from '@/core/listen/scenes'
import type { Lang } from '@/core/vocab/types'
import Hoeren from './Hoeren.vue'

vi.mock('@/services/tts', async () => {
  const { ref } = await import('vue')
  return {
    speak: vi.fn(() => Promise.resolve()),
    speakLines: vi.fn(() => Promise.resolve()),
    instruct: vi.fn(() => Promise.resolve()),
    stopSpeaking: vi.fn(),
    hasVoice: vi.fn(() => true),
    voiceCount: ref(2),
    instruction: ref(null),
    forgetInstruction: vi.fn(),
  }
})

const tap = (w: VueWrapper, sel: string) => w.find(sel).trigger('click')
const lastPlayed = () => vi.mocked(speakLines).mock.calls.at(-1)!
/** The scene being played, found by its lines */
const playing = (lang: Lang) => allScenes(lang).find(x => x.scene.lines === lastPlayed()[0] || x.scene.lines.join() === lastPlayed()[0].join())!

async function answer(w: VueWrapper, lang: Lang, right: boolean) {
  const { scene } = playing(lang)
  const want = scene.answers[scene.right]
  const button = w.findAll('[data-test="answer"]').find(b => (b.text() === want) === right)!
  await button.trigger('click')
}

describe('Hören', () => {
  let api: FakeApi
  beforeEach(async () => {
    setActivePinia(createPinia())
    api = fakeApi({ level: 'oberstufe' })
    window.localStorage.clear()
    const player = usePlayerStore()
    player.init(api, 1, window.localStorage)
    await player.refresh()
    const listen = useListenStore()
    listen.init(api, 1, window.localStorage, () => '2026-11-12')
    await listen.load()
    vi.mocked(speakLines).mockClear()
    vi.mocked(stopSpeaking).mockClear()
  })
  afterEach(() => { document.body.innerHTML = '' })

  it('offers "Gemischt" and the topics of the language', async () => {
    const w = mount(Hoeren, { attachTo: document.body })
    await tap(w, '[data-test="lang-fr"]')
    expect(w.find('[data-test="topic-mixed"]').text()).toContain('Gemischt')
    expect(w.findAll('[data-test^="topic-"]')).toHaveLength(13)
    expect(w.find('[data-test="topic-travel"]').text()).toContain(SCENES.fr[0].name)
    w.unmount()
  })

  it('plays the scene by itself in its voice and shows the German question with the answers in their new order', async () => {
    const w = mount(Hoeren, { attachTo: document.body })
    await tap(w, '[data-test="lang-fr"]')
    await tap(w, '[data-test="topic-travel"]')
    expect(speakLines).toHaveBeenCalledTimes(1)
    const [lines, voice] = lastPlayed()
    expect(voice).toBe('fr-FR')
    const { scene, topic } = playing('fr')
    expect(topic).toBe('travel')
    expect(lines).toEqual(scene.lines)
    expect(w.find('[data-test="question"]').text()).toBe(scene.question)
    expect(w.findAll('[data-test="answer"]').map(b => b.text()).sort()).toEqual([...scene.answers].sort())
    expect(w.find('[data-test="round"]').text()).not.toContain(scene.lines[0])
    await tap(w, '[data-test="slow"]')
    expect(lastPlayed()[2]).toEqual({ rate: 0.6 })
    await tap(w, '[data-test="again"]')
    expect(lastPlayed()[2]).toEqual({})
    w.unmount()
  })

  it('a right answer gives a Star and shows the text; a wrong one shows it too and the scene doesn\'t come back', async () => {
    const w = mount(Hoeren, { attachTo: document.body })
    await tap(w, '[data-test="lang-en"]')
    await tap(w, '[data-test="topic-food"]')
    const first = playing('en')
    await answer(w, 'en', false)
    expect(w.find('[data-test="text"]').text()).toContain(first.scene.lines[0].replace(/^[AB]: /, ''))
    expect(w.find('[data-test="verdict"]').text()).not.toContain('Richtig')
    await tap(w, '[data-test="next"]')
    const keys = [first.key]
    for (let i = 0; i < 4; i++) {
      const now = playing('en')
      keys.push(now.key)
      await answer(w, 'en', true)
      expect(w.find('[data-test="verdict"]').text()).toContain('Richtig')
      expect(w.find('[data-test="text"]').exists()).toBe(true)
      await tap(w, '[data-test="next"]')
    }
    expect(new Set(keys).size).toBe(5)
    expect(w.find('[data-test="end"]').text()).toContain('4 von 5')
    await tap(w, '[data-test="finish"]')
    await flushPromises()
    expect(w.emitted('finished')).toEqual([[{ stars: 4 }]])
    w.unmount()
  })

  it('five of five give ten Stars, recorded once with all five', async () => {
    const w = mount(Hoeren, { attachTo: document.body })
    await tap(w, '[data-test="lang-en"]')
    await tap(w, '[data-test="topic-mixed"]')
    for (let i = 0; i < 5; i++) {
      await answer(w, 'en', true)
      await tap(w, '[data-test="next"]')
    }
    await tap(w, '[data-test="finish"]')
    await flushPromises()
    expect(w.emitted('finished')).toEqual([[{ stars: 10 }]])
    expect(api.calls.filter(c => c.startsWith('listenResults'))).toHaveLength(1)
    expect(Object.keys(api.listen_)).toHaveLength(5)
    expect(Object.keys(api.listen_).every(k => k.startsWith('en:'))).toBe(true)
    w.unmount()
  })

  it('leaving in the middle stops the voice and keeps what was answered', async () => {
    const { requestLeave } = await import('../leave')
    const w = mount(Hoeren, { attachTo: document.body })
    await tap(w, '[data-test="lang-en"]')
    await tap(w, '[data-test="topic-travel"]')
    const isCurrent = lastPlayed()[3]!
    await answer(w, 'en', true)
    requestLeave()
    await flushPromises()
    expect(stopSpeaking).toHaveBeenCalled()
    expect(isCurrent()).toBe(false)
    expect(w.emitted('finished')).toEqual([[{ stars: 1 }]])
    expect(Object.keys(api.listen_)).toHaveLength(1)
    w.unmount()
  })
})
