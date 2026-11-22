import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { fakeApi, type FakeApi } from '@/services/fakeApi'
import { layGrammar, useGrammarStore } from './grammar'

const ans = (item: string, right: boolean) => ({ item, right })

describe('grammar store', () => {
  let api: FakeApi
  beforeEach(() => {
    setActivePinia(createPinia())
    api = fakeApi()
    window.localStorage.clear()
  })

  it('lays a round over the record as the server does', () => {
    const one = layGrammar({}, { lang: 'en', answers: [ans('en:modals:3', true), ans('en:modals:5', false), ans('fr:articles:1', true), ans('en:x', true)] })
    expect(one).toEqual({ 'en:modals': { recent: [true, false], missed: ['en:modals:5'] } })
    const two = layGrammar(one, { lang: 'en', answers: [ans('en:modals:5', true)] })
    expect(two['en:modals']).toEqual({ recent: [true, false, true], missed: [] })
    const many = layGrammar({}, { lang: 'en', answers: Array.from({ length: 25 }, (_, i) => ans(`en:modals:${i}`, i % 2 === 0)) })
    expect(many['en:modals'].recent).toHaveLength(20)
  })

  it('takes the server\'s record, and a round sent offline waits and goes once', async () => {
    api.grammar_ = { 'en:modals': { recent: [true], missed: [] } }
    const grammar = useGrammarStore()
    grammar.init(api, 1, window.localStorage, () => '2026-11-12')
    await grammar.load()
    expect(grammar.progress['en:modals'].recent).toEqual([true])
    api.offline = true
    grammar.record('en', [ans('en:modals:2', false)])
    await flushPromises()
    expect(grammar.progress['en:modals'].recent).toEqual([true, false])
    api.offline = false
    api.calls = []
    await grammar.load()
    await grammar.load()
    expect(api.calls.filter(c => c.startsWith('grammarResults'))).toHaveLength(1)
    expect(api.grammar_['en:modals']).toEqual({ recent: [true, false], missed: ['en:modals:2'] })
  })
})
