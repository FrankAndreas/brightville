import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { fakeApi } from '@/services/fakeApi'
import VocabOverview from './VocabOverview.vue'

describe('VocabOverview', () => {
  it('per language: words learned (box 3 and up, words that exist now), due today, and his lists', async () => {
    const api = fakeApi()
    api.vocab_.lists = [{ id: 1, lang: 'en', name: 'Unit 3', words: [{ de: 'der Zug', foreign: 'train' }, { de: 'das Haus', foreign: 'house' }] }]
    api.vocab_.progress = {
      'en:own:train': { box: 3, due: '2026-11-20' },
      'en:own:house': { box: 1, due: '2026-11-12' },
      'en:travel:station': { box: 5, due: '2026-12-01' },
      'en:travel:train': { box: 2, due: '2026-11-10' },
      // A word no list has any more: not counted
      'en:own:gone': { box: 4, due: '2026-11-01' },
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
    expect(w.find('[data-test="vocab-list-1"]').text()).toContain('der Zug → train')
  })
})
