import type { Lang } from '@/core/vocab/types'
import { hasVoice, speak } from '@/services/tts'

/** The coach's voice per language */
export const COACH_VOICE: Record<Lang, string> = { en: 'en-GB', fr: 'fr-FR' }

/** Says a coach line in the language's voice, when the device has one (else it is only written) */
export function coachSay(lang: Lang, text: string): Promise<void> {
  return hasVoice(COACH_VOICE[lang]) ? speak(text, COACH_VOICE[lang]) : Promise.resolve()
}
