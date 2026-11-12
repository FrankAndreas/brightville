import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { speak, stopSpeaking } from './tts'

interface FakeUtterance { text: string; lang: string; onend?: () => void; onerror?: () => void }

describe('tts service', () => {
  let mockSynth: { cancel: ReturnType<typeof vi.fn>; speak: ReturnType<typeof vi.fn> }
  const spoken = (i = 0) => mockSynth.speak.mock.calls[i][0] as FakeUtterance

  beforeEach(() => {
    mockSynth = { cancel: vi.fn(), speak: vi.fn() }
    vi.stubGlobal('speechSynthesis', mockSynth)
    vi.stubGlobal('SpeechSynthesisUtterance', class {
      text: string
      lang = ''
      constructor(text: string) { this.text = text }
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('speaks with de-DE language', () => {
    speak('Hallo Welt')
    expect(spoken().text).toBe('Hallo Welt')
    expect(spoken().lang).toBe('de-DE')
  })

  it('cancels previous speech before speaking', () => {
    speak('first')
    speak('second')
    expect(mockSynth.cancel).toHaveBeenCalledTimes(2)
  })

  it('stopSpeaking cancels synthesis', () => {
    stopSpeaking()
    expect(mockSynth.cancel).toHaveBeenCalledTimes(1)
  })

  it('does nothing when speechSynthesis is unavailable', () => {
    vi.stubGlobal('speechSynthesis', undefined)
    expect(() => speak('test')).not.toThrow()
    expect(() => stopSpeaking()).not.toThrow()
  })

  it('resolves right away when speechSynthesis is unavailable', async () => {
    vi.stubGlobal('speechSynthesis', undefined)
    await expect(speak('test')).resolves.toBeUndefined()
  })

  describe('waiting for the end of speech', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    const settled = (p: Promise<void>) => {
      let done = false
      void p.then(() => { done = true })
      return () => done
    }

    it('resolves when the utterance ends', async () => {
      const isDone = settled(speak('Hallo'))
      await vi.advanceTimersByTimeAsync(0)
      expect(isDone()).toBe(false)
      spoken().onend!()
      await vi.advanceTimersByTimeAsync(0)
      expect(isDone()).toBe(true)
    })

    it('resolves when the utterance fails or is interrupted', async () => {
      const isDone = settled(speak('Hallo'))
      spoken().onerror!()
      await vi.advanceTimersByTimeAsync(0)
      expect(isDone()).toBe(true)
    })

    it('resolves after a timeout when no end event arrives', async () => {
      const isDone = settled(speak('Hallo'))
      await vi.advanceTimersByTimeAsync(1000)
      expect(isDone()).toBe(false)
      await vi.advanceTimersByTimeAsync(10000)
      expect(isDone()).toBe(true)
    })
  })
})
