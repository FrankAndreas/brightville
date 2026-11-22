import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { hasVoice, speak } from '@/services/tts'
import { fakeApi, type FakeApi } from '@/services/fakeApi'
import { usePlayerStore } from '@/stores/player'
import { useDatesStore } from '@/stores/dates'
import { dateWords, DAYS, MONTHS, ordinalWord, shownDate, shownTime, timeWords } from '@/core/dates/words'
import type { Lang } from '@/core/vocab/types'
import Datum from './Datum.vue'

vi.mock('@/services/tts', async () => {
  const { ref } = await import('vue')
  return {
    speak: vi.fn(() => Promise.resolve()), instruct: vi.fn(() => Promise.resolve()), stopSpeaking: vi.fn(),
    hasVoice: vi.fn(() => true), voiceCount: ref(1), instruction: ref(null), forgetInstruction: vi.fn(),
  }
})

const tap = (w: VueWrapper, sel: string) => w.find(sel).trigger('click')
const kindNow = (w: VueWrapper) => w.find('[data-test="round"]').attributes('data-kind')
const lastSaid = () => (vi.mocked(speak).mock.calls.at(-1) as unknown as [string, string])[0]

/** The right answer to the task on screen, worked out from what it shows or says */
function rightFor(w: VueWrapper, lang: Lang): string {
  const kind = kindNow(w)
  if (kind === 'clock-words') {
    const [h, m] = w.find('[data-test="prompt-clock"] [data-test="clock-face"]').attributes('data-time')!.split(':').map(Number)
    return timeWords(lang, h, m)[0]
  }
  const prompt = w.find('[data-test="prompt"]').exists() ? w.find('[data-test="prompt"]').text() : lastSaid()
  if (kind === 'words-clock') {
    for (let h = 1; h <= 12; h++) for (let m = 0; m < 60; m += 5) if (timeWords(lang, h, m)[0] === prompt) return shownTime(h, m)
  }
  if (kind === 'words-date') {
    for (let mo = 1; mo <= 12; mo++) for (let d = 1; d <= 31; d++) if (dateWords(lang, d, mo)[0] === prompt) return shownDate(d, mo)
  }
  if (kind === 'date-words') {
    const [d, mo] = prompt.split('.').map(Number)
    return dateWords(lang, d, mo)[0]
  }
  const i = DAYS.de.indexOf(prompt)
  if (i >= 0) return DAYS[lang][i]
  const j = MONTHS.de.indexOf(prompt)
  if (j >= 0) return MONTHS[lang][j]
  return ordinalWord(Number(/\((\d+)\.\)/.exec(prompt)![1]))
}

async function answer(w: VueWrapper, lang: Lang, right: boolean) {
  const want = rightFor(w, lang)
  const choices = w.findAll('[data-test="choice"]')
  if (choices.length) {
    await choices.find(c => (c.attributes('data-value') === want) === right)!.trigger('click')
  } else {
    await w.find('[data-test="answer"]').setValue(right ? want : 'xyz')
    await w.find('[data-test="answer"]').trigger('keydown', { key: 'Enter' })
  }
}

describe('Datum', () => {
  let api: FakeApi
  beforeEach(async () => {
    setActivePinia(createPinia())
    api = fakeApi({ level: 'oberstufe' })
    window.localStorage.clear()
    const player = usePlayerStore()
    player.init(api, 1, window.localStorage)
    await player.refresh()
    const dates = useDatesStore()
    dates.init(api, 1, window.localStorage, () => '2026-11-12')
    await dates.load()
    vi.mocked(speak).mockClear()
    vi.mocked(hasVoice).mockImplementation(() => true)
  })
  afterEach(() => { document.body.innerHTML = '' })

  /** Goes on until the task on screen is of this kind (a round has two of each) */
  async function until(w: VueWrapper, lang: Lang, kind: string) {
    for (let i = 0; i < 12 && kindNow(w) !== kind; i++) {
      await answer(w, lang, true)
      await tap(w, '[data-test="next"]')
    }
    expect(kindNow(w)).toBe(kind)
  }

  it('goes from the language straight into a round; a clock shows the time with its minutes', async () => {
    const w = mount(Datum, { attachTo: document.body })
    await tap(w, '[data-test="lang-en"]')
    expect(w.find('[data-test="round"]').exists()).toBe(true)
    await until(w, 'en', 'clock-words')
    expect(w.find('[data-test="prompt-clock"] [data-test="clock-face"]').attributes('data-time')).toMatch(/^\d{1,2}:\d\d$/)
    w.unmount()
  })

  it('with a voice the words are spoken and not shown before the answer; without one they are shown', async () => {
    const w = mount(Datum, { attachTo: document.body })
    await tap(w, '[data-test="lang-fr"]')
    await until(w, 'fr', 'words-clock')
    expect(w.find('[data-test="prompt"]').exists()).toBe(false)
    expect(vi.mocked(speak).mock.calls.at(-1)![1]).toBe('fr-FR')
    await answer(w, 'fr', true)
    expect(w.find('[data-test="prompt"]').text()).toBe(lastSaid())
    w.unmount()
    vi.mocked(hasVoice).mockImplementation(() => false)
    const v = mount(Datum, { attachTo: document.body })
    await tap(v, '[data-test="lang-en"]')
    await until(v, 'en', 'words-date')
    expect(v.find('[data-test="prompt"]').exists()).toBe(true)
    v.unmount()
  })

  it('a whole round right gives 15 Stars and records ten answers over five kinds', async () => {
    const w = mount(Datum, { attachTo: document.body })
    await tap(w, '[data-test="lang-en"]')
    for (let i = 0; i < 10; i++) {
      await answer(w, 'en', true)
      await tap(w, '[data-test="next"]')
    }
    expect(w.find('[data-test="end"]').text()).toContain('10 von 10')
    await tap(w, '[data-test="finish"]')
    await flushPromises()
    expect(w.emitted('finished')).toEqual([[{ stars: 15 }]])
    expect(api.calls.filter(c => c.startsWith('datesResults'))).toHaveLength(1)
    expect(Object.keys(api.dates_).sort()).toEqual(['en:clock-words', 'en:date-words', 'en:spelling', 'en:words-clock', 'en:words-date'])
    expect(Object.values(api.dates_).every(p => p.recent.length === 2)).toBe(true)
    w.unmount()
  })

  it('a wrong pick marks the right one and goes on; it comes back at the end', async () => {
    const w = mount(Datum, { attachTo: document.body })
    await tap(w, '[data-test="lang-en"]')
    await answer(w, 'en', false)
    expect(w.find('[data-test="choice"].right').exists()).toBe(true)
    expect(w.find('[data-test="next"]').exists()).toBe(true)
    await tap(w, '[data-test="next"]')
    let asked = 1
    while (w.find('[data-test="round"]').exists() && asked < 20) {
      asked++
      await answer(w, 'en', true)
      await tap(w, '[data-test="next"]')
    }
    expect(asked).toBe(11)
    w.unmount()
  })

  it('leaving after three keeps their Stars and answers', async () => {
    const { requestLeave } = await import('../leave')
    const w = mount(Datum, { attachTo: document.body })
    await tap(w, '[data-test="lang-en"]')
    for (let i = 0; i < 3; i++) {
      await answer(w, 'en', true)
      await tap(w, '[data-test="next"]')
    }
    requestLeave()
    await flushPromises()
    expect(w.emitted('finished')).toEqual([[{ stars: 3 }]])
    expect(Object.values(api.dates_).reduce((n, p) => n + p.recent.length, 0)).toBe(3)
    w.unmount()
  })
})
