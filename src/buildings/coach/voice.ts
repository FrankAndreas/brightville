import type { Lang } from '@/core/vocab/types'
import { hasVoice, speak, stopSpeaking } from '@/services/tts'

/** The coach's voice per language */
export const COACH_VOICE: Record<Lang, string> = { en: 'en-GB', fr: 'fr-FR' }

/** The coach's lines wait for each other (a new one never cuts off the last count or "Great!") */
let queue: Promise<void> = Promise.resolve()
/** Bumped by coachQuiet: lines queued before it are dropped */
let generation = 0

/** Says a coach line in the language's voice after the lines before it, when the device has a voice (else it is only written) */
export function coachSay(lang: Lang, text: string): Promise<void> {
  if (!hasVoice(COACH_VOICE[lang])) return Promise.resolve()
  const mine = generation
  queue = queue.then(() => (mine === generation ? speak(text, COACH_VOICE[lang]) : undefined))
  return queue
}

/** Stops the coach and drops what waited (leaving the building) */
export function coachQuiet(): void {
  generation++
  queue = Promise.resolve()
  stopSpeaking()
}
