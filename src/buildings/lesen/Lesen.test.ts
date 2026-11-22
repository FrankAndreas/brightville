import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { hasVoice, speak } from '@/services/tts'
import { fakeApi, type FakeApi } from '@/services/fakeApi'
import { usePlayerStore } from '@/stores/player'
import { useReadingStore } from '@/stores/reading'
import { allTexts, READING } from '@/core/reading/texts'
import Lesen from './Lesen.vue'

vi.mock('@/services/tts', async () => {
  const { ref } = await import('vue')
  return {
    speak: vi.fn(() => Promise.resolve()), instruct: vi.fn(() => Promise.resolve()), stopSpeaking: vi.fn(),
    hasVoice: vi.fn(() => true), voiceCount: ref(1), instruction: ref(null), forgetInstruction: vi.fn(),
  }
})

const tap = (w: VueWrapper, sel: string) => w.find(sel).trigger('click')
const shown = (w: VueWrapper) => allTexts('en').concat(allTexts('fr')).find(x => x.key === w.find('[data-test="reading"]').attributes('data-text'))!

/** Answers the current question, right or wrong */
async function answer(w: VueWrapper, right: boolean) {
  const { text } = shown(w)
  const asked = w.find('[data-test="question"]').text()
  const q = text.questions.find(x => x.question === asked)!
  const want = q.answers[q.right]
  await w.findAll('[data-test="answer"]').find(b => (b.text() === want) === right)!.trigger('click')
}

describe('Lesen', () => {
  let api: FakeApi
  beforeEach(async () => {
    setActivePinia(createPinia())
    api = fakeApi({ level: 'oberstufe' })
    window.localStorage.clear()
    const player = usePlayerStore()
    player.init(api, 1, window.localStorage)
    await player.refresh()
    const reading = useReadingStore()
    reading.init(api, 1, window.localStorage, () => '2026-11-12')
    await reading.load()
    vi.mocked(speak).mockClear()
    vi.mocked(hasVoice).mockImplementation(() => true)
  })
  afterEach(() => { document.body.innerHTML = '' })

  it('shows the topics of the picked language and "Gemischt"', async () => {
    const w = mount(Lesen, { attachTo: document.body })
    await tap(w, '[data-test="lang-fr"]')
    expect(w.findAll('[data-test^="topic-"]')).toHaveLength(13)
    expect(w.find('[data-test="topic-food"]').text()).toContain(READING.fr[4].name)
    w.unmount()
  })

  it('a glossary word shows its German when tapped, and hides it again', async () => {
    const w = mount(Lesen, { attachTo: document.body })
    await tap(w, '[data-test="lang-en"]')
    await tap(w, '[data-test="topic-travel"]')
    const gloss = w.find('[data-test="gloss"]')
    expect(w.find('[data-test="gloss-de"]').exists()).toBe(false)
    await gloss.trigger('click')
    const entry = shown(w).text.glossary.find(g => g.word.toLowerCase() === gloss.text().toLowerCase())!
    expect(w.find('[data-test="gloss-de"]').text()).toBe(entry.de)
    await gloss.trigger('click')
    expect(w.find('[data-test="gloss-de"]').exists()).toBe(false)
    w.unmount()
  })

  it('🔊 reads a sentence in the text\'s voice, and is not there without one', async () => {
    const w = mount(Lesen, { attachTo: document.body })
    await tap(w, '[data-test="lang-fr"]')
    await tap(w, '[data-test="topic-food"]')
    expect(w.findAll('[data-test="say"]')).toHaveLength(shown(w).text.sentences.length)
    await w.findAll('[data-test="say"]')[1].trigger('click')
    expect(speak).toHaveBeenCalledWith(shown(w).text.sentences[1], 'fr-FR')
    w.unmount()
    vi.mocked(hasVoice).mockImplementation(() => false)
    const v = mount(Lesen, { attachTo: document.body })
    await tap(v, '[data-test="lang-en"]')
    await tap(v, '[data-test="topic-food"]')
    expect(v.find('[data-test="reading"]').exists()).toBe(true)
    expect(v.findAll('[data-test="say"]')).toHaveLength(0)
    v.unmount()
  })

  it('four questions one after another; a wrong answer marks the right one and does not come back', async () => {
    const w = mount(Lesen, { attachTo: document.body })
    await tap(w, '[data-test="lang-en"]')
    await tap(w, '[data-test="topic-school"]')
    const asked: string[] = []
    for (let i = 0; i < 4; i++) {
      asked.push(w.find('[data-test="question"]').text())
      await answer(w, i !== 1)
      if (i === 1) {
        expect(w.find('[data-test="verdict"]').text()).toContain('Richtig wäre')
        expect(w.find('.answers button.right').exists()).toBe(true)
      }
      await tap(w, '[data-test="next"]')
    }
    expect(new Set(asked).size).toBe(4)
    expect(w.find('[data-test="end"]').text()).toContain('3 von 4')
    await tap(w, '[data-test="finish"]')
    await flushPromises()
    expect(w.emitted('finished')).toEqual([[{ stars: 6 }]])
    w.unmount()
  })

  it('four of four give 10 Stars, recorded once', async () => {
    const w = mount(Lesen, { attachTo: document.body })
    await tap(w, '[data-test="lang-en"]')
    await tap(w, '[data-test="topic-mixed"]')
    const key = shown(w).key
    for (let i = 0; i < 4; i++) {
      await answer(w, true)
      await tap(w, '[data-test="next"]')
    }
    await tap(w, '[data-test="finish"]')
    await flushPromises()
    expect(w.emitted('finished')).toEqual([[{ stars: 10 }]])
    expect(api.calls.filter(c => c.startsWith('readingResults'))).toHaveLength(1)
    expect(api.reading_[key]).toEqual({ reads: 1, last_read: '2026-11-12', last_right: 4 })
    w.unmount()
  })

  it('leaving after two questions keeps their Stars and counts the text as read', async () => {
    const { requestLeave } = await import('../leave')
    const w = mount(Lesen, { attachTo: document.body })
    await tap(w, '[data-test="lang-en"]')
    await tap(w, '[data-test="topic-home"]')
    const key = shown(w).key
    await answer(w, true)
    await tap(w, '[data-test="next"]')
    await answer(w, false)
    requestLeave()
    await flushPromises()
    expect(w.emitted('finished')).toEqual([[{ stars: 2 }]])
    expect(api.reading_[key].last_right).toBe(1)
    w.unmount()
  })
})
