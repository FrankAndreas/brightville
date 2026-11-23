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
  /** A result while still listening (no end yet) */
  partly(text: string) {
    this.onresult?.({ results: [Object.assign([{ transcript: text, confidence: 0.9 }], { isFinal: true })], resultIndex: 0 })
  }
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
  })

  it('when the time runs out it stops (not aborts) and keeps what it heard', async () => {
    const slow = recognise('en', 10000)
    const r = rec()
    r.stop = vi.fn()
    r.partly('it is raining again')
    await vi.advanceTimersByTimeAsync(10000)
    expect(r.stop).toHaveBeenCalled()
    expect(r.abort).not.toHaveBeenCalled()
    r.onend?.()
    expect(await slow).toEqual(['it is raining again'])
  })

  it('if the recogniser never ends after stopping, what it heard still comes back', async () => {
    const stuck = recognise('en', 10000)
    const r = rec()
    r.stop = vi.fn()
    r.partly('hello')
    await vi.advanceTimersByTimeAsync(10000 + 2000)
    expect(await stuck).toEqual(['hello'])
  })

  it('listens ten seconds by default', async () => {
    const quiet = recognise('en')
    const r = rec()
    r.stop = vi.fn(() => r.onend?.())
    await vi.advanceTimersByTimeAsync(9000)
    expect(r.stop).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)
    expect(await quiet).toEqual([])
  })

  it('a microphone that fails, no connection or a start that throws: told apart from silence', async () => {
    const busy = recognise('en')
    rec().fail('audio-capture')
    await expect(busy).rejects.toThrow('failed')
    const offline = recognise('en')
    rec().fail('network')
    await expect(offline).rejects.toThrow('failed')
    const Throwing = class extends FakeRecognition { start = vi.fn(() => { throw new Error('InvalidStateError') }) }
    ;(window as unknown as { webkitSpeechRecognition: unknown }).webkitSpeechRecognition = Throwing
    await expect(recognise('en')).rejects.toThrow('failed')
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
