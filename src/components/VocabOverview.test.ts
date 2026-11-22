import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { fakeApi } from '@/services/fakeApi'
import VocabOverview from './VocabOverview.vue'

describe('VocabOverview', () => {
  it('per language: words learned (box 3 and up, words that exist now), due today, and his lists', async () => {
    const api = fakeApi()
    api.vocab_.lists = [{ id: 1, lang: 'en', name: 'Unit 3', words: [{ de: 'der Kompass', foreign: 'compass' }, { de: 'die Laterne', foreign: 'lantern' }] }]
    api.vocab_.progress = {
      'en:own:compass|der kompass': { box: 3, due: '2026-11-20' },
      'en:own:lantern|die laterne': { box: 1, due: '2026-11-12' },
      'en:travel:station': { box: 5, due: '2026-12-01' },
      'en:travel:train': { box: 2, due: '2026-11-10' },
      // A word no list has any more: not counted
      'en:own:gone|weg': { box: 4, due: '2026-11-01' },
      'fr:travel:station': { box: 3, due: '2026-11-30' },
    }
    const w = mount(VocabOverview, { props: { api, personId: 2, today: '2026-11-12' } })
    await w.find('details').trigger('toggle')
    ;(w.find('details').element as HTMLDetailsElement).open = true
    await w.find('details').trigger('toggle')
    await flushPromises()
    expect(w.find('[data-test="lang-en"]').text()).toContain('2 Wörter gelernt')
    expect(w.find('[data-test="lang-en"]').text()).toContain('2 heute fällig')
    expect(w.find('[data-test="lang-fr"]').text()).toContain('1 Wort gelernt')
    expect(w.find('[data-test="lang-fr"]').text()).toContain('0 heute fällig')
    expect(w.find('[data-test="vocab-list-1"]').text()).toContain('Unit 3')
    expect(w.find('[data-test="vocab-list-1"]').text()).toContain('der Kompass → compass')
  })

  it('per language: words spelled right (spelling box 3 and up, words that exist now) and scenes understood', async () => {
    const api = fakeApi()
    api.vocab_.lists = [{ id: 1, lang: 'en', name: 'Unit 3', words: [{ de: 'der Kompass', foreign: 'compass' }] }]
    api.vocab_.progress = {
      'en:spell:own:compass|der kompass': { box: 3, due: '2026-11-20' },
      'en:spell:travel:station': { box: 4, due: '2026-11-20' },
      'en:spell:travel:train': { box: 2, due: '2026-11-20' },
      // Gone from his lists: not counted
      'en:spell:own:gone|weg': { box: 5, due: '2026-11-20' },
      // Spelling is not knowing the word: not "gelernt"
      'fr:spell:travel:station': { box: 3, due: '2026-11-20' },
    }
    api.listen_ = {
      'en:travel:platform': { right: 2, last_right: '2026-11-10', last_asked: '2026-11-10' },
      'en:food:menu': { right: 0, last_right: null, last_asked: '2026-11-10' },
      'en:travel:gone': { right: 1, last_right: '2026-11-10', last_asked: '2026-11-10' },
      'fr:travel:quai': { right: 1, last_right: '2026-11-10', last_asked: '2026-11-10' },
    }
    const w = mount(VocabOverview, { props: { api, personId: 2, today: '2026-11-12' } })
    ;(w.find('details').element as HTMLDetailsElement).open = true
    await w.find('details').trigger('toggle')
    await flushPromises()
    const en = w.find('[data-test="lang-en"]').text()
    const fr = w.find('[data-test="lang-fr"]').text()
    expect(en).toContain('2 Wörter richtig geschrieben')
    expect(en).toContain('1 von 72 Hörszenen verstanden')
    expect(fr).toContain('0 Wörter gelernt')
    expect(fr).toContain('1 Wort richtig geschrieben')
    expect(fr).toContain('1 von 72 Hörszenen verstanden')
  })

  it('per language: grammar topics sure, and the weak ones named (fewest right first, at most three)', async () => {
    const api = fakeApi()
    const rec = (right: number, tries = 10) => ({ recent: Array.from({ length: tries }, (_, i) => i >= tries - right), missed: [] })
    api.grammar_ = {
      'en:modals': rec(9),
      'en:passive': rec(2),
      'en:adverbs': rec(5),
      'en:relatives': rec(0, 4),
      'en:some-any': rec(6),
      'en:if-will': rec(7),
      'fr:articles': rec(10),
    }
    const w = mount(VocabOverview, { props: { api, personId: 2, today: '2026-11-12' } })
    ;(w.find('details').element as HTMLDetailsElement).open = true
    await w.find('details').trigger('toggle')
    await flushPromises()
    const en = w.find('[data-test="lang-en"]').text()
    const fr = w.find('[data-test="lang-fr"]').text()
    expect(en).toContain('Grammatik: 1 von 12 Themen sicher')
    expect(en).toContain('Schwach: Passiv, Adverbien (-ly), some / any, much / many')
    expect(fr).toContain('Grammatik: 1 von 12 Themen sicher')
    expect(fr).not.toContain('Schwach')
  })

  it('per language: the texts read (texts that exist now only)', async () => {
    const api = fakeApi()
    const r = { reads: 1, last_read: '2026-11-10', last_right: 3 }
    api.reading_ = { 'en:travel:sam': r, 'en:food:menu': r, 'en:travel:gone': r, 'fr:travel:lettre': r }
    const w = mount(VocabOverview, { props: { api, personId: 2, today: '2026-11-12' } })
    ;(w.find('details').element as HTMLDetailsElement).open = true
    await w.find('details').trigger('toggle')
    await flushPromises()
    expect(w.find('[data-test="lang-en"]').text()).toContain('2 von 36 Texten gelesen')
    expect(w.find('[data-test="lang-fr"]').text()).toContain('1 von 36 Texten gelesen')
  })

  it('per language: dates and times kinds sure, and the weak ones named', async () => {
    const api = fakeApi()
    const rec = (right: number, tries = 10) => ({ recent: Array.from({ length: tries }, (_, i) => i >= tries - right) })
    api.dates_ = { 'en:clock-words': rec(9), 'en:date-words': rec(3), 'en:spelling': rec(6), 'en:words-date': rec(1, 4), 'fr:spelling': rec(10) }
    const w = mount(VocabOverview, { props: { api, personId: 2, today: '2026-11-12' } })
    ;(w.find('details').element as HTMLDetailsElement).open = true
    await w.find('details').trigger('toggle')
    await flushPromises()
    const en = w.find('[data-test="lang-en"]').text()
    expect(en).toContain('Uhrzeit und Datum: 1 von 5 Aufgabenarten sicher')
    expect(en).toContain('Schwach (Kalender): Datum schreiben, Tage und Monate')
    const fr = w.find('[data-test="lang-fr"]').text()
    expect(fr).toContain('Uhrzeit und Datum: 1 von 5 Aufgabenarten sicher')
    expect(fr).not.toContain('Schwach (Kalender)')
  })
})
