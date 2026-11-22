import { ref } from 'vue'

// Upper bound for how long speech can take, in case the browser never reports
// the end (iOS Safari sometimes doesn't): a base plus time per character
const MAX_BASE_MS = 2000
const MAX_PER_CHAR_MS = 100

/**
 * Speaks the text, cancelling anything still being spoken.
 * Resolves when the speech has ended, failed or been interrupted.
 */
export interface SpeakOptions { rate?: number; pitch?: number; voice?: SpeechSynthesisVoice }

export function speak(text: string, lang = 'de-DE', opts: SpeakOptions = {}): Promise<void> {
  if (!window.speechSynthesis) return Promise.resolve()
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  if (opts.rate !== undefined) u.rate = opts.rate
  if (opts.pitch !== undefined) u.pitch = opts.pitch
  if (opts.voice) u.voice = opts.voice
  const done = new Promise<void>(resolve => {
    const timer = setTimeout(resolve, MAX_BASE_MS + text.length * MAX_PER_CHAR_MS)
    u.onend = u.onerror = () => { clearTimeout(timer); resolve() }
  })
  window.speechSynthesis.speak(u)
  return done
}

const norm = (lang: string) => lang.replace('_', '-').toLowerCase()

/** The device's voices for this language ("en-GB" finds any English voice), those of the exact region first */
export function voicesFor(lang: string): SpeechSynthesisVoice[] {
  const voices = window.speechSynthesis?.getVoices?.() ?? []
  const want = norm(lang)
  const same = voices.filter(v => norm(v.lang).slice(0, 2) === want.slice(0, 2))
  return [...same.filter(v => norm(v.lang) === want), ...same.filter(v => norm(v.lang) !== want)]
}

/** Whether the device has a voice for this language ("en-GB" finds any English voice) */
export function hasVoice(lang: string): boolean {
  return voicesFor(lang).length > 0
}

/** Whether the device has an English or a French voice (the Oberstufe's speaking buildings need one) */
export function hasAnyForeignVoice(): boolean {
  return hasVoice('en-GB') || hasVoice('fr-FR')
}

/**
 * How many voices the device has, counted again when they arrive: some browsers (Safari) load them late, so what
 * depends on a voice (the doors) recomputes when this changes.
 */
export const voiceCount = ref(0)

/** Counts the voices now and whenever they change; returns the way to stop listening */
export function watchVoices(): () => void {
  const synth = window.speechSynthesis
  const count = () => { voiceCount.value = synth?.getVoices?.().length ?? 0 }
  count()
  if (!synth?.addEventListener) return () => {}
  synth.addEventListener('voiceschanged', count)
  return () => synth.removeEventListener('voiceschanged', count)
}

const LINE_PAUSE_MS = 400
const SECOND_SPEAKER_PITCH = 0.8

/**
 * Speaks a scene line by line (a line may name its speaker, "A: " / "B: ", which isn't spoken), with a short pause
 * between lines. The second speaker gets the language's second voice if the device has one, else a lower pitch.
 * Stops as soon as isCurrent() is false (the child left or went on).
 */
export async function speakLines(
  lines: string[], lang: string, opts: { rate?: number } = {}, isCurrent: () => boolean = () => true,
): Promise<void> {
  const voices = voicesFor(lang)
  for (const [i, line] of lines.entries()) {
    if (!isCurrent()) return
    if (i > 0) {
      await new Promise(resolve => setTimeout(resolve, LINE_PAUSE_MS))
      if (!isCurrent()) return
    }
    const second = line.startsWith('B: ')
    const text = line.replace(/^[AB]: /, '')
    const extra: SpeakOptions = voices.length >= 2
      ? { voice: voices[second ? 1 : 0] }
      : second ? { pitch: SECOND_SPEAKER_PITCH } : {}
    await speak(text, lang, { ...opts, ...extra })
  }
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
