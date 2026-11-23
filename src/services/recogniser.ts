import type { Lang } from '@/core/vocab/types'

// The Trommelhaus at Oberstufe hears what he says through the browser's speech recogniser (Apple's on the iPad,
// Google's in Chrome: his voice goes there, as the parents accepted for now). Everything goes through `recognise`, so a
// dedicated service can take its place later. The game itself records and keeps nothing.

/** The little of the browser's SpeechRecognition used here */
interface Recognition {
  lang: string
  maxAlternatives: number
  interimResults: boolean
  continuous: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  abort(): void
}
type RecognitionClass = new () => Recognition

const LOCALE: Record<Lang, string> = { en: 'en-GB', fr: 'fr-FR' }
const REFUSED = new Set(['not-allowed', 'service-not-allowed'])

function recognitionClass(): RecognitionClass | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** The browser can recognise speech and there is a microphone (asked for only when he first taps 🎤) */
export function hasSpeech(): boolean {
  return !!recognitionClass() && typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function'
}

/** The one listening now, and how to end it with nothing */
let current: { recognition: Recognition; settle: (heard: string[]) => void } | null = null

/** Stops listening; the one waiting gets nothing */
export function stopRecognising(): void {
  const was = current
  current = null
  if (!was) return
  was.settle([])
  try { was.recognition.abort() } catch { /* already ended */ }
}

/**
 * Listens for one utterance in the language and hands back what the recogniser heard, every alternative it offers
 * (best first). Nothing heard, an error or the time running out: an empty list. Rejects only with Error('not-allowed')
 * when the microphone or the recogniser is refused. Call it on a tap (the iPad wants that).
 */
export function recognise(lang: Lang, timeoutMs = 7000): Promise<string[]> {
  stopRecognising()
  const Class = recognitionClass()
  if (!Class) return Promise.resolve([])
  return new Promise<string[]>((resolve, reject) => {
    const recognition = new Class()
    let done = false
    let heard: string[] = []
    const timer = setTimeout(() => { if (!done) stopRecognising() }, timeoutMs)
    const finish = (fn: () => void) => {
      if (done) return
      done = true
      clearTimeout(timer)
      if (current?.recognition === recognition) current = null
      fn()
    }
    const settle = (out: string[]) => finish(() => resolve(out))
    current = { recognition, settle }
    recognition.lang = LOCALE[lang]
    recognition.maxAlternatives = 5
    recognition.interimResults = false
    recognition.continuous = false
    recognition.onresult = e => {
      const result = e.results[0]
      heard = result ? Array.from(result, a => a.transcript.trim()).filter(Boolean) : []
    }
    recognition.onerror = e => {
      if (REFUSED.has(e.error)) finish(() => reject(new Error('not-allowed')))
      else settle([])
    }
    recognition.onend = () => settle(heard)
    try {
      recognition.start()
    } catch {
      settle([])
    }
  })
}
