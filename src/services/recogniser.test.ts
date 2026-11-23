import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hasSpeech, recognise, stopRecognising } from './recogniser'

/** A stand-in for the browser's recogniser: the test makes it hear, fail or end */
class FakeRecognition {
  static last: FakeRecognition | null = null
  lang = ''
  maxAlternatives = 1
  interimResults = true
  continuous = true
  onresult: ((e: unknown) => void) | null = null
  onerror: ((e: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  start = vi.fn()
  abort = vi.fn(() => this.onend?.())
  stop = vi.fn(() => this.onend?.())
  constructor() { FakeRecognition.last = this }
  hear(...texts: string[]) {
    const result = Object.assign(texts.map(transcript => ({ transcript, confidence: 0.9 })), { isFinal: true })
    this.onresult?.({ results: [result], resultIndex: 0 })
    this.onend?.()
  }
  fail(error: string) { this.onerror?.({ error }); this.onend?.() }
}

const rec = () => FakeRecognition.last!

describe('the recogniser', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    ;(window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = FakeRecognition
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn() }, configurable: true })
  })
  afterEach(() => {
    stopRecognising()
    vi.useRealTimers()
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
  })

  it('hands back every alternative, in order, in the language asked for', async () => {
    const heard = recognise('fr')
    expect(rec()).toMatchObject({ lang: 'fr-FR', maxAlternatives: 5, interimResults: false, continuous: false })
    expect(rec().start).toHaveBeenCalled()
    rec().hear(' bonjour ', 'bon jour', '')
    expect(await heard).toEqual(['bonjour', 'bon jour'])
    const en = recognise('en')
    expect(rec().lang).toBe('en-GB')
    rec().hear('hello')
    expect(await en).toEqual(['hello'])
  })

  it('nothing heard, an error, an end without a result or the time running out: nothing', async () => {
    const silent = recognise('en')
    rec().fail('no-speech')
    expect(await silent).toEqual([])
    const ended = recognise('en')
    rec().onend?.()
    expect(await ended).toEqual([])
    const slow = recognise('en', 7000)
    const r = rec()
    await vi.advanceTimersByTimeAsync(7000)
    expect(await slow).toEqual([])
    expect(r.abort).toHaveBeenCalled()
  })

  it('a refused microphone is told apart', async () => {
    const refused = recognise('en')
    rec().fail('not-allowed')
    await expect(refused).rejects.toThrow('not-allowed')
  })

  it('stopping hands back nothing, and a new listen stops the old one', async () => {
    const first = recognise('en')
    const r = rec()
    const second = recognise('en')
    expect(r.abort).toHaveBeenCalled()
    expect(await first).toEqual([])
    stopRecognising()
    expect(await second).toEqual([])
  })

  it('knows whether the device can do it: a recogniser and a microphone', () => {
    expect(hasSpeech()).toBe(true)
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true })
    expect(hasSpeech()).toBe(false)
    Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: vi.fn() }, configurable: true })
    delete (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition
    expect(hasSpeech()).toBe(false)
  })
})
