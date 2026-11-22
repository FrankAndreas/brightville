import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hasAnyForeignVoice, hasVoice, speak, speakLines, stopSpeaking, voiceCount, voicesFor, watchVoices } from './tts'

interface FakeUtterance { text: string; lang: string; rate?: number; pitch?: number; voice?: unknown; onend?: () => void; onerror?: () => void }

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

  it('knows whether the device has a voice for a language', () => {
    vi.stubGlobal('speechSynthesis', { ...mockSynth, getVoices: () => [{ lang: 'de-CH' }, { lang: 'en_GB' }] })
    expect(hasVoice('en-GB')).toBe(true)
    expect(hasVoice('fr-FR')).toBe(false)
    vi.stubGlobal('speechSynthesis', undefined)
    expect(hasVoice('en-GB')).toBe(false)
  })

  it('passes rate, pitch and voice to the utterance', () => {
    const voice = { lang: 'en-GB', name: 'Daniel' } as SpeechSynthesisVoice
    speak('slowly', 'en-GB', { rate: 0.6, pitch: 0.8, voice })
    expect(spoken().rate).toBe(0.6)
    expect(spoken().pitch).toBe(0.8)
    expect(spoken().voice).toBe(voice)
    expect(spoken().lang).toBe('en-GB')
  })

  it('finds the voices of a language, the exact region first', () => {
    const voices = [{ lang: 'de-CH' }, { lang: 'en-US', name: 'us' }, { lang: 'en_GB', name: 'gb' }, { lang: 'fr-FR' }]
    vi.stubGlobal('speechSynthesis', { ...mockSynth, getVoices: () => voices })
    expect(voicesFor('en-GB').map(v => v.name)).toEqual(['gb', 'us'])
    expect(hasAnyForeignVoice()).toBe(true)
    vi.stubGlobal('speechSynthesis', { ...mockSynth, getVoices: () => [{ lang: 'de-CH' }] })
    expect(hasAnyForeignVoice()).toBe(false)
  })

  it('counts the voices again when they arrive late', () => {
    let voices: { lang: string }[] = []
    const listeners: (() => void)[] = []
    vi.stubGlobal('speechSynthesis', {
      ...mockSynth,
      getVoices: () => voices,
      addEventListener: (_: string, f: () => void) => listeners.push(f),
      removeEventListener: vi.fn(),
    })
    const stop = watchVoices()
    expect(voiceCount.value).toBe(0)
    voices = [{ lang: 'en-GB' }, { lang: 'fr-FR' }]
    listeners.forEach(f => f())
    expect(voiceCount.value).toBe(2)
    stop()
  })

  describe('speaking a dialogue', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    const finishLine = async (i: number) => {
      await vi.advanceTimersByTimeAsync(0)
      spoken(i).onend!()
      await vi.advanceTimersByTimeAsync(400)
    }

    it('speaks line after line, the second speaker lower when there is one voice', async () => {
      vi.stubGlobal('speechSynthesis', { ...mockSynth, getVoices: () => [{ lang: 'en-GB' }] })
      const done = speakLines(['A: Hi', 'B: Hello'], 'en-GB')
      await finishLine(0)
      await finishLine(1)
      await done
      expect(spoken(0).text).toBe('Hi')
      expect(spoken(1).text).toBe('Hello')
      expect(spoken(1).pitch).toBe(0.8)
      expect(spoken(0).pitch).toBeUndefined()
    })

    it('gives the second speaker the second voice when there are two', async () => {
      const two = [{ lang: 'en-GB', name: 'a' }, { lang: 'en-GB', name: 'b' }]
      vi.stubGlobal('speechSynthesis', { ...mockSynth, getVoices: () => two })
      const done = speakLines(['A: Hi', 'B: Hello'], 'en-GB', { rate: 0.6 })
      await finishLine(0)
      await finishLine(1)
      await done
      expect(spoken(0).voice).toBe(two[0])
      expect(spoken(1).voice).toBe(two[1])
      expect(spoken(1).pitch).toBeUndefined()
      expect(spoken(1).rate).toBe(0.6)
    })

    it('stops when the scene is no longer the current one', async () => {
      let current = true
      const done = speakLines(['One.', 'Two.'], 'en-GB', {}, () => current)
      current = false
      await finishLine(0)
      await done
      expect(mockSynth.speak).toHaveBeenCalledTimes(1)
    })
  })
})
