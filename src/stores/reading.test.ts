import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { fakeApi, type FakeApi } from '@/services/fakeApi'
import { useReadingStore } from './reading'

describe('reading store', () => {
  let api: FakeApi
  beforeEach(() => {
    setActivePinia(createPinia())
    api = fakeApi()
    window.localStorage.clear()
  })

  it('takes the server\'s record, and a visit sent offline waits and goes once', async () => {
    api.reading_ = { 'en:travel:sam': { reads: 1, last_read: '2026-11-01', last_right: 2 } }
    const reading = useReadingStore()
    reading.init(api, 1, window.localStorage, () => '2026-11-12')
    await reading.load()
    expect(reading.progress['en:travel:sam'].reads).toBe(1)
    api.offline = true
    reading.record('en', [{ text: 'en:travel:sam', right: 4 }])
    await flushPromises()
    expect(reading.progress['en:travel:sam']).toEqual({ reads: 2, last_read: '2026-11-12', last_right: 4 })
    api.offline = false
    api.calls = []
    await reading.load()
    await reading.load()
    expect(api.calls.filter(c => c.startsWith('readingResults'))).toHaveLength(1)
    expect(api.reading_['en:travel:sam'].reads).toBe(2)
  })
})
