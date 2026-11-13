import { ref } from 'vue'

// Upper bound for how long speech can take, in case the browser never reports
// the end (iOS Safari sometimes doesn't): a base plus time per character
const MAX_BASE_MS = 2000
const MAX_PER_CHAR_MS = 100

/**
 * Speaks the text, cancelling anything still being spoken.
 * Resolves when the speech has ended, failed or been interrupted.
 */
export function speak(text: string, lang = 'de-DE'): Promise<void> {
  if (!window.speechSynthesis) return Promise.resolve()
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  const done = new Promise<void>(resolve => {
    const timer = setTimeout(resolve, MAX_BASE_MS + text.length * MAX_PER_CHAR_MS)
    u.onend = u.onerror = () => { clearTimeout(timer); resolve() }
  })
  window.speechSynthesis.speak(u)
  return done
}

/**
 * What the building asks the child to do right now, for the 🔊 button (SayAgain.vue): a child who missed it hears
 * it again with a tap. The town forgets it whenever a building opens or closes.
 */
export const instruction = ref<string | null>(null)

/** Says an instruction and keeps it for the 🔊 button. Praise, counting and the like go through speak(). */
export function instruct(text: string): Promise<void> {
  instruction.value = text
  return speak(text)
}

export function forgetInstruction(): void {
  instruction.value = null
}

export function stopSpeaking(): void {
  if (window.speechSynthesis) window.speechSynthesis.cancel()
}
