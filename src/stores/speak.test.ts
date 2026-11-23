import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { fakeApi, type FakeApi } from '@/services/fakeApi'
import { useSpeakStore } from './speak'

describe('speak store', () => {
  let api: FakeApi
  beforeEach(() => {
    setActivePinia(createPinia())
    api = fakeApi()
    window.localStorage.clear()
  })

  it('takes the server\'s record, and a round sent offline waits and goes once', async () => {
    api.speak_ = { 'en:speak:travel:window': { right: 1, last_right: '2026-11-01', last_asked: '2026-11-01' } }
    const speak = useSpeakStore()
    speak.init(api, 1, window.localStorage, () => '2026-11-12')
    await speak.load()
    expect(speak.progress['en:speak:travel:window'].right).toBe(1)
    api.offline = true
    speak.record('en', [{ item: 'en:speak:travel:window', right: true }])
    await flushPromises()
    expect(speak.progress['en:speak:travel:window'].right).toBe(2)
    api.offline = false
    api.calls = []
    await speak.load()
    await speak.load()
    expect(api.calls.filter(c => c.startsWith('speakResults'))).toHaveLength(1)
    expect(api.speak_['en:speak:travel:window'].right).toBe(2)
    expect((await api.playerSpeak(1)).progress['en:speak:travel:window'].right).toBe(2)
  })
})
