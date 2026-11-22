import { beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { fakeApi, type FakeApi } from '@/services/fakeApi'
import { useVocabStore } from '@/stores/vocab'
import ListEditor from './ListEditor.vue'

describe('ListEditor', () => {
  let api: FakeApi
  beforeEach(() => {
    setActivePinia(createPinia())
    api = fakeApi()
    window.localStorage.clear()
    useVocabStore().init(api, 1)
  })

  const editor = (props: Record<string, unknown> = {}) => mount(ListEditor, { props: { lang: 'en', ...props } })

  it('shows the pairs as they will be kept, and marks lines it can\'t read', async () => {
    const w = editor()
    await w.find('[data-test="list-text"]').setValue('der Zug - train\nUnit 3\ndas Haus - house')
    expect(w.findAll('[data-test="pair"]').map(p => p.text())).toEqual(['der Zug → train', 'das Haus → house'])
    expect(w.find('[data-test="bad-lines"]').text()).toContain('2')
  })

  it('saves the pairs with the name, in the language chosen', async () => {
    const w = editor()
    await w.find('[data-test="list-name"]').setValue('Unit 3')
    await w.find('[data-test="list-text"]').setValue('der Zug - train\ndas Haus - house')
    await w.find('[data-test="save"]').trigger('click')
    await flushPromises()
    expect(api.vocab_.lists).toEqual([{ id: 1, lang: 'en', name: 'Unit 3', words: [{ de: 'der Zug', foreign: 'train' }, { de: 'das Haus', foreign: 'house' }] }])
    expect(w.emitted('done')).toHaveLength(1)
  })

  it('says in words why a list was refused, and when the server is away', async () => {
    for (let i = 0; i < 30; i++) api.vocab_.lists.push({ id: 100 + i, lang: 'en', name: `L${i}`, words: [{ de: 'a', foreign: 'b' }] })
    const w = editor()
    await w.find('[data-test="list-name"]').setValue('Unit 3')
    await w.find('[data-test="list-text"]').setValue('der Zug - train')
    await w.find('[data-test="save"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="refusal"]').text()).toBe('Du hast schon 30 Listen in dieser Sprache.')
    api.offline = true
    await w.find('[data-test="save"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-test="refusal"]').text()).toBe('Keine Verbindung – versuch es später nochmal.')
    expect(w.emitted('done')).toBeUndefined()
  })

  it('opens a list to change it, and deletes it after asking once', async () => {
    api.vocab_.lists = [{ id: 7, lang: 'en', name: 'Unit 3', words: [{ de: 'der Zug', foreign: 'train' }] }]
    await useVocabStore().load()
    const w = editor({ list: api.vocab_.lists[0] })
    expect((w.find('[data-test="list-name"]').element as HTMLInputElement).value).toBe('Unit 3')
    expect((w.find('[data-test="list-text"]').element as HTMLTextAreaElement).value).toBe('der Zug\ttrain')
    await w.find('[data-test="delete"]').trigger('click')
    expect(api.vocab_.lists).toHaveLength(1)
    await w.find('[data-test="delete-sure"]').trigger('click')
    await flushPromises()
    expect(api.vocab_.lists).toEqual([])
    expect(w.emitted('done')).toHaveLength(1)
  })

  it('opens a list with a tab between the two sides, so a side with ";" or " - " in it stays whole', async () => {
    const list = { id: 7, lang: 'en' as const, name: 'U', words: [{ de: 'a; b - c', foreign: 'x' }] }
    const w = editor({ list })
    expect((w.find('[data-test="list-text"]').element as HTMLTextAreaElement).value).toBe('a; b - c\tx')
    expect(w.findAll('[data-test="pair"]').map(p => p.text())).toEqual(['a; b - c → x'])
  })

  it('the text box doesn\'t correct his words', () => {
    const box = editor().find('[data-test="list-text"]')
    expect(box.attributes('autocorrect')).toBe('off')
    expect(box.attributes('autocapitalize')).toBe('off')
  })
})
