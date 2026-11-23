import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { speak, stopSpeaking } from '@/services/tts'
import { coachQuiet, coachSay } from './voice'

vi.mock('@/services/tts', () => ({ speak: vi.fn(), stopSpeaking: vi.fn(), hasVoice: vi.fn(() => true) }))

describe("the coach's voice", () => {
  let finish: (() => void)[]
  beforeEach(() => {
    finish = []
    vi.mocked(speak).mockReset().mockImplementation(() => new Promise<void>(r => finish.push(r)))
    coachQuiet()
  })
  afterEach(() => coachQuiet())

  it('says its lines one after another, never cutting one off', async () => {
    void coachSay('en', 'four')
    void coachSay('en', 'Great!')
    await Promise.resolve()
    expect(vi.mocked(speak).mock.calls).toEqual([['four', 'en-GB']])
    finish[0]()
    await new Promise(r => setTimeout(r, 0))
    expect(vi.mocked(speak).mock.calls).toEqual([['four', 'en-GB'], ['Great!', 'en-GB']])
  })

  it('goes quiet: what waited is dropped', async () => {
    void coachSay('en', 'one')
    void coachSay('en', 'two')
    await Promise.resolve()
    coachQuiet()
    expect(stopSpeaking).toHaveBeenCalled()
    finish[0]?.()
    await new Promise(r => setTimeout(r, 0))
    expect(vi.mocked(speak).mock.calls.map(c => c[0])).toEqual(['one'])
  })
})
