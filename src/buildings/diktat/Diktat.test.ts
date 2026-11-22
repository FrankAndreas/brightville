import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { hasVoice, speak, stopSpeaking, voiceCount } from '@/services/tts'
import { fakeApi, type FakeApi } from '@/services/fakeApi'
import { usePlayerStore } from '@/stores/player'
import { useVocabStore } from '@/stores/vocab'
import { BUILTIN } from '@/core/vocab/builtin'
import { answersOf } from '@/core/vocab/answer'
import Diktat from './Diktat.vue'

vi.mock('@/services/tts', async () => {
  const { ref } = await import('vue')
  return {
    speak: vi.fn(() => Promise.resolve()),
    instruct: vi.fn(() => Promise.resolve()),
    stopSpeaking: vi.fn(),
    hasVoice: vi.fn(() => true),
    voiceCount: ref(2),
    instruction: ref(null),
    forgetInstruction: vi.fn(),
  }
})

const tap = (w: VueWrapper, sel: string) => w.find(sel).trigger('click')
const lastSpoken = () => vi.mocked(speak).mock.calls.at(-1) as unknown as [string, string, { rate?: number }?]
/** The word just dictated, by what was said */
const dictated = () => BUILTIN.en[0].words.find(x => answersOf(x.foreign)[0] === lastSpoken()[0])!

describe('Diktat', () => {
  let api: FakeApi
  beforeEach(async () => {
    setActivePinia(createPinia())
    api = fakeApi({ level: 'oberstufe' })
    window.localStorage.clear()
    api.vocab_.lists = [{ id: 1, lang: 'en', name: 'Unit 3', words: [{ de: 'der Kompass', foreign: 'compass' }] }]
    const player = usePlayerStore()
    player.init(api, 1, window.localStorage)
    await player.refresh()
    const vocab = useVocabStore()
    vocab.init(api, 1, window.localStorage, () => '2026-11-12')
    await vocab.load()
    vi.mocked(speak).mockClear()
    vi.mocked(stopSpeaking).mockClear()
    vi.mocked(hasVoice).mockImplementation(() => true)
  })
  afterEach(() => { document.body.innerHTML = '' })

  it('a language without a voice says so and can\'t be picked', async () => {
    vi.mocked(hasVoice).mockImplementation(lang => lang.startsWith('en'))
    const w = mount(Diktat, { attachTo: document.body })
    const fr = w.find('[data-test="lang-fr"]')
    expect(fr.attributes('disabled')).toBeDefined()
    expect(fr.text()).toContain('Keine Stimme')
    await fr.trigger('click')
    expect(w.find('[data-test="shelf"]').exists()).toBe(false)
    w.unmount()
  })

  it('a voice that arrives late makes its language pickable', async () => {
    vi.mocked(hasVoice).mockImplementation(lang => lang.startsWith('en'))
    const w = mount(Diktat, { attachTo: document.body })
    expect(w.find('[data-test="lang-fr"]').attributes('disabled')).toBeDefined()
    vi.mocked(hasVoice).mockImplementation(() => true)
    voiceCount.value++
    await w.vm.$nextTick()
    expect(w.find('[data-test="lang-fr"]').attributes('disabled')).toBeUndefined()
    w.unmount()
  })

  it('the shelf has no new list and no ✏️: lists are made in the School', async () => {
    const w = mount(Diktat, { attachTo: document.body })
    await tap(w, '[data-test="lang-en"]')
    expect(w.find('[data-test="list-1"]').exists()).toBe(true)
    expect(w.find('[data-test="new-list"]').exists()).toBe(false)
    expect(w.find('[data-test="edit-1"]').exists()).toBe(false)
    w.unmount()
  })

  it('dictates in English without writing the word, slowly with 🐢, and shows word and German after the answer', async () => {
    const w = mount(Diktat, { attachTo: document.body })
    await tap(w, '[data-test="lang-en"]')
    await tap(w, '[data-test="topic-travel"]')
    const [said, voice] = lastSpoken()
    expect(voice).toBe('en-GB')
    expect(w.find('[data-test="round"]').text()).not.toContain(said)
    await tap(w, '[data-test="slow"]')
    expect(lastSpoken()).toEqual([said, 'en-GB', { rate: 0.6 }])
    const word = dictated()
    await w.find('[data-test="answer"]').setValue(said)
    await w.find('[data-test="answer"]').trigger('keydown', { key: 'Enter' })
    expect(w.find('[data-test="verdict"]').text()).toContain('Richtig')
    expect(w.find('[data-test="round"]').text()).toContain(said)
    expect(w.find('[data-test="round"]').text()).toContain(word.de)
    w.unmount()
  })

  it('a whole round records spelling keys only, with a Star per word', async () => {
    const w = mount(Diktat, { attachTo: document.body })
    await tap(w, '[data-test="lang-en"]')
    await tap(w, '[data-test="topic-travel"]')
    let asked = 0
    while (w.find('[data-test="round"]').exists() && asked < 30) {
      asked++
      await w.find('[data-test="answer"]').setValue(lastSpoken()[0])
      await w.find('[data-test="answer"]').trigger('keydown', { key: 'Enter' })
      await tap(w, '[data-test="next"]')
    }
    expect(w.find('[data-test="end"]').text()).toContain('4 von 4')
    await tap(w, '[data-test="finish"]')
    await flushPromises()
    expect(w.emitted('finished')).toEqual([[{ stars: 4 }]])
    const keys = Object.keys(api.vocab_.progress)
    expect(keys).toHaveLength(4)
    expect(keys.every(k => k.startsWith('en:spell:travel:'))).toBe(true)
    w.unmount()
  })

  it('a wrong word is typed out and comes back at the end', async () => {
    const w = mount(Diktat, { attachTo: document.body })
    await tap(w, '[data-test="lang-en"]')
    await tap(w, '[data-test="list-1"]')
    await w.find('[data-test="answer"]').setValue('kompas')
    await w.find('[data-test="answer"]').trigger('keydown', { key: 'Enter' })
    expect(w.find('[data-test="shown"]').text()).toContain('compass')
    await w.find('[data-test="answer"]').setValue('compass')
    await w.find('[data-test="answer"]').trigger('keydown', { key: 'Enter' })
    await tap(w, '[data-test="next"]')
    expect(w.find('[data-test="round"]').exists()).toBe(true)
    expect(lastSpoken()[0]).toBe('compass')
    w.unmount()
  })

  it('leaving in the middle stops the voice and keeps the answers so far', async () => {
    const { requestLeave } = await import('../leave')
    const w = mount(Diktat, { attachTo: document.body })
    await tap(w, '[data-test="lang-en"]')
    await tap(w, '[data-test="topic-travel"]')
    await w.find('[data-test="answer"]').setValue(lastSpoken()[0])
    await w.find('[data-test="answer"]').trigger('keydown', { key: 'Enter' })
    requestLeave()
    await flushPromises()
    expect(stopSpeaking).toHaveBeenCalled()
    expect(w.emitted('finished')).toEqual([[{ stars: 1 }]])
    expect(Object.keys(api.vocab_.progress)).toEqual([expect.stringMatching(/^en:spell:travel:/)])
    w.unmount()
  })
})
