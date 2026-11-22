import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { fakeApi, type FakeApi } from '@/services/fakeApi'
import { usePlayerStore } from '@/stores/player'
import { useGrammarStore } from '@/stores/grammar'
import { filled, itemByKey } from '@/core/grammar/items'
import { GRAMMAR } from '@/core/grammar/content'
import { BUILDINGS } from '../registry'
import Grammatik from './Grammatik.vue'

vi.mock('@/services/tts', async () => {
  const { ref } = await import('vue')
  return {
    speak: vi.fn(() => Promise.resolve()), instruct: vi.fn(() => Promise.resolve()), stopSpeaking: vi.fn(),
    hasVoice: vi.fn(() => true), voiceCount: ref(1), instruction: ref(null), forgetInstruction: vi.fn(),
  }
})

const tap = (w: VueWrapper, sel: string) => w.find(sel).trigger('click')
const current = (w: VueWrapper) => itemByKey(w.find('[data-test="round"]').attributes('data-item')!)!

/** Answers the item on the screen, right or wrong, by choosing or typing */
async function answer(w: VueWrapper, right: boolean) {
  const item = current(w)
  const choices = w.findAll('[data-test="choice"]')
  if (choices.length) {
    const pick = choices.find(c => (c.text() === item.answers[0]) === right)!
    await pick.trigger('click')
  } else {
    await w.find('[data-test="answer"]').setValue(right ? item.answers[0] : 'xyz')
    await w.find('[data-test="answer"]').trigger('keydown', { key: 'Enter' })
  }
}

describe('Grammatik', () => {
  let api: FakeApi
  beforeEach(async () => {
    setActivePinia(createPinia())
    api = fakeApi({ level: 'oberstufe' })
    window.localStorage.clear()
    const player = usePlayerStore()
    player.init(api, 1, window.localStorage)
    await player.refresh()
    const grammar = useGrammarStore()
    grammar.init(api, 1, window.localStorage, () => '2026-11-12')
    await grammar.load()
  })
  afterEach(() => { document.body.innerHTML = '' })

  it('shows the topics of the picked language and "Gemischt"', async () => {
    const w = mount(Grammatik, { attachTo: document.body })
    await tap(w, '[data-test="lang-fr"]')
    expect(w.findAll('[data-test^="topic-"]')).toHaveLength(13)
    expect(w.find('[data-test="topic-mixed"]').text()).toContain('Gemischt')
    expect(w.find('[data-test="topic-passe-compose-etre"]').text()).toContain(GRAMMAR.fr[4].name)
    expect(w.text()).not.toContain(GRAMMAR.en[0].name)
    w.unmount()
  })

  it('asks a new topic with choices and a known one typed', async () => {
    const w = mount(Grammatik, { attachTo: document.body })
    await tap(w, '[data-test="lang-en"]')
    await tap(w, '[data-test="topic-modals"]')
    expect(w.findAll('[data-test="choice"]')).toHaveLength(4)
    expect(w.find('[data-test="sentence"]').text()).toContain('___')
    w.unmount()
    useGrammarStore().record('en', Array.from({ length: 10 }, (_, i) => ({ item: `en:modals:${i + 1}`, right: i >= 4 })))
    const v = mount(Grammatik, { attachTo: document.body })
    await tap(v, '[data-test="lang-en"]')
    await tap(v, '[data-test="topic-modals"]')
    expect(v.findAll('[data-test="choice"]')).toHaveLength(0)
    expect(v.find('[data-test="answer"]').exists()).toBe(true)
    v.unmount()
  })

  it('a wrong answer shows the sentence and the rule, is typed out and comes back at the end', async () => {
    const w = mount(Grammatik, { attachTo: document.body })
    await tap(w, '[data-test="lang-fr"]')
    await tap(w, '[data-test="topic-articles"]')
    const first = current(w)
    await answer(w, false)
    expect(w.find('[data-test="filled"]').text()).toBe(filled(first))
    expect(w.find('[data-test="rule"]').text()).toContain(GRAMMAR.fr[0].rule)
    await w.find('[data-test="answer"]').setValue(first.answers[0])
    await w.find('[data-test="answer"]').trigger('keydown', { key: 'Enter' })
    await tap(w, '[data-test="next"]')
    let asked = 1
    let last = ''
    while (w.find('[data-test="round"]').exists() && asked < 30) {
      asked++
      last = current(w).key
      await answer(w, true)
      await tap(w, '[data-test="next"]')
    }
    expect(asked).toBe(11)
    expect(last).toBe(first.key)
    expect(w.find('[data-test="end"]').text()).toContain('9 von 10')
    await tap(w, '[data-test="finish"]')
    await flushPromises()
    expect(w.emitted('finished')).toEqual([[{ stars: 9 }]])
    expect(api.calls.filter(c => c.startsWith('grammarResults'))).toHaveLength(1)
    expect(api.grammar_['fr:articles'].recent).toHaveLength(10)
    expect(Object.keys(api.grammar_)).toEqual(['fr:articles'])
    w.unmount()
  })

  it('a perfect round of "Gemischt" gives 15 Stars', async () => {
    const w = mount(Grammatik, { attachTo: document.body })
    await tap(w, '[data-test="lang-en"]')
    await tap(w, '[data-test="topic-mixed"]')
    for (let i = 0; i < 10; i++) {
      await answer(w, true)
      await tap(w, '[data-test="next"]')
    }
    await tap(w, '[data-test="finish"]')
    await flushPromises()
    expect(w.emitted('finished')).toEqual([[{ stars: 15 }]])
    expect(Object.keys(api.grammar_).every(k => k.startsWith('en:'))).toBe(true)
    w.unmount()
  })

  it('leaving in the middle keeps the Stars and the answers so far', async () => {
    const { requestLeave } = await import('../leave')
    const w = mount(Grammatik, { attachTo: document.body })
    await tap(w, '[data-test="lang-en"]')
    await tap(w, '[data-test="topic-passive"]')
    await answer(w, true)
    requestLeave()
    await flushPromises()
    expect(w.emitted('finished')).toEqual([[{ stars: 1 }]])
    expect(api.grammar_['en:passive'].recent).toEqual([true])
    w.unmount()
  })

  it('the Kindergarten Musterwerkstatt is unchanged', () => {
    const muster = BUILDINGS.find(b => b.id === 'muster')!
    expect(muster.oberstufe?.component).toBeDefined()
    expect(muster.component).not.toBe(muster.oberstufe?.component)
    expect(muster.needs).toEqual([])
  })
})
