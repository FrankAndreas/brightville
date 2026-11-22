import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { fakeApi, type FakeApi } from '@/services/fakeApi'
import { useDatesStore } from './dates'

describe('dates store', () => {
  let api: FakeApi
  beforeEach(() => {
    setActivePinia(createPinia())
    api = fakeApi()
    window.localStorage.clear()
  })

  it('takes the server\'s record, and a round sent offline waits and goes once', async () => {
    api.dates_ = { 'en:spelling': { recent: [true] } }
    const dates = useDatesStore()
    dates.init(api, 1, window.localStorage, () => '2026-11-12')
    await dates.load()
    expect(dates.progress['en:spelling'].recent).toEqual([true])
    api.offline = true
    dates.record('en', [{ kind: 'en:spelling', right: false }])
    await flushPromises()
    expect(dates.progress['en:spelling'].recent).toEqual([true, false])
    api.offline = false
    api.calls = []
    await dates.load()
    await dates.load()
    expect(api.calls.filter(c => c.startsWith('datesResults'))).toHaveLength(1)
    expect(api.dates_['en:spelling'].recent).toEqual([true, false])
  })
})
