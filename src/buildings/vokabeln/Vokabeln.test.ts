import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { speak, instruct } from '@/services/tts'
import { fakeApi, type FakeApi } from '@/services/fakeApi'
import { usePlayerStore } from '@/stores/player'
import { useVocabStore } from '@/stores/vocab'
import { BUILTIN } from '@/core/vocab/builtin'
import { answersOf } from '@/core/vocab/answer'
import Vokabeln from './Vokabeln.vue'

vi.mock('@/services/tts', async () => {
  const { ref } = await import('vue')
  return {
    speak: vi.fn(() => Promise.resolve()),
    instruct: vi.fn(() => Promise.resolve()),
    stopSpeaking: vi.fn(),
    hasVoice: vi.fn(() => true),
    instruction: ref(null),
    forgetInstruction: vi.fn(),
  }
})

const tap = (w: VueWrapper, sel: string) => w.find(sel).trigger('click')

describe('Vokabeln', () => {
  let api: FakeApi
  beforeEach(async () => {
    setActivePinia(createPinia())
    api = fakeApi({ level: 'oberstufe' })
    window.localStorage.clear()
    api.vocab_.lists = [
      { id: 1, lang: 'en', name: 'Unit 3', words: [{ de: 'der Zug', foreign: 'train' }] },
      { id: 2, lang: 'fr', name: 'Unité 1', words: [{ de: 'der Zug', foreign: 'le train' }] },
    ]
    const player = usePlayerStore()
    player.init(api, 1, window.localStorage)
    await player.refresh()
    const vocab = useVocabStore()
    vocab.init(api, 1, window.localStorage, () => '2026-11-12')
    await vocab.load()
    vi.mocked(speak).mockClear()
    vi.mocked(instruct).mockClear()
  })
  afterEach(() => { document.body.innerHTML = '' })

  it('English shows only English lists and English topics', async () => {
    const w = mount(Vokabeln, { attachTo: document.body })
    await tap(w, '[data-test="lang-en"]')
    const shelf = w.find('[data-test="shelf"]').text()
    expect(shelf).toContain('Unit 3')
    expect(shelf).toContain('Alle meine Wörter')
    expect(shelf).toContain(BUILTIN.en[0].name)
    expect(shelf).not.toContain('Unité 1')
    w.unmount()
  })

  it('a whole round: Stars, only first answers recorded, the English voice only, no German instructions', async () => {
    const w = mount(Vokabeln, { attachTo: document.body })
    await tap(w, '[data-test="lang-en"]')
    await tap(w, '[data-test="topic-travel"]')
    const words = BUILTIN.en[0].words
    let asked = 0
    while (w.find('[data-test="round"]').exists() && asked < 30) {
      asked++
      const prompt = w.find('[data-test="prompt"]').text()
      const word = words.find(x => x.de === prompt)!
      const right = answersOf(word.foreign)[0]
      const choice = w.findAll('[data-test="choice"]').find(c => c.text() === right)!
      await choice.trigger('click')
      await tap(w, '[data-test="next"]')
    }
    expect(w.find('[data-test="end"]').text()).toContain('4 von 4')
    await tap(w, '[data-test="finish"]')
    await flushPromises()
    expect(w.emitted('finished')).toEqual([[{ stars: 4 }]])
    expect(api.calls.filter(c => c.startsWith('vocabResults'))).toHaveLength(1)
    expect(Object.keys(api.vocab_.progress)).toHaveLength(4)
    const voices = vi.mocked(speak).mock.calls.map(c => c[1])
    expect(voices.length).toBeGreaterThan(0)
    expect(voices.every(v => v === 'en-GB')).toBe(true)
    expect(instruct).not.toHaveBeenCalled()
    w.unmount()
  })

  it('a French round speaks French and shows the accent keys when he types', async () => {
    // His word is also built in, so it has the built-in key
    api.vocab_.progress = { 'fr:travel:train': { box: 2, due: '2026-11-01' } }
    await useVocabStore().load()
    const w = mount(Vokabeln, { attachTo: document.body })
    await tap(w, '[data-test="lang-fr"]')
    await tap(w, '[data-test="list-2"]')
    expect(w.find('[data-test="prompt"]').text()).toBe('der Zug')
    expect(w.find('[data-test="accent-keys"]').exists()).toBe(true)
    await w.find('[data-test="answer"]').setValue('le train')
    await w.find('[data-test="answer"]').trigger('keydown', { key: 'Enter' })
    expect(w.find('[data-test="verdict"]').text()).toContain('Richtig')
    expect(vi.mocked(speak).mock.calls.every(c => c[1] === 'fr-FR')).toBe(true)
    w.unmount()
  })

  it('leaving in the middle keeps the Stars and the answers so far', async () => {
    const { requestLeave } = await import('../leave')
    const w = mount(Vokabeln, { attachTo: document.body })
    await tap(w, '[data-test="lang-en"]')
    await tap(w, '[data-test="topic-travel"]')
    const word = BUILTIN.en[0].words.find(x => x.de === w.find('[data-test="prompt"]').text())!
    await w.findAll('[data-test="choice"]').find(c => c.text() === answersOf(word.foreign)[0])!.trigger('click')
    requestLeave()
    await flushPromises()
    expect(w.emitted('finished')).toEqual([[{ stars: 1 }]])
    expect(Object.keys(api.vocab_.progress)).toHaveLength(1)
    w.unmount()
  })

  it('the field stays after a right typed answer (the iPad keyboard stays up), and Enter in it goes on', async () => {
    api.vocab_.progress = { 'fr:travel:train': { box: 2, due: '2026-11-01' } }
    await useVocabStore().load()
    const w = mount(Vokabeln, { attachTo: document.body })
    await tap(w, '[data-test="lang-fr"]')
    await tap(w, '[data-test="list-2"]')
    await w.find('[data-test="answer"]').setValue('le train')
    await w.find('[data-test="answer"]').trigger('keydown', { key: 'Enter' })
    expect(w.find('[data-test="verdict"]').text()).toContain('Richtig')
    expect(w.find('[data-test="answer"]').exists()).toBe(true)
    await w.find('[data-test="answer"]').trigger('keydown', { key: 'Enter' })
    expect(w.find('[data-test="end"]').exists()).toBe(true)
    w.unmount()
  })
})
