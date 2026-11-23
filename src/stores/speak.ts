import { laySpeak, type SpeakProgress } from '@/core/speak/round'
import type { SpeakResultsIn } from '@/services/api'
import { defineRoundStore } from './rounds'

type Answer = SpeakResultsIn['answers'][number]

/**
 * The Oberstufe's speaking record for the child playing: what he said right in the Trommelhaus. Kept by the server
 * (backend/app/speak.py); a round counts here at once and waits on the device (under brightville.speak.<id>) until the
 * server has it (stores/rounds.ts).
 */
export const useSpeakStore = defineRoundStore<SpeakProgress, Answer>('speak', {
  prefix: 'brightville.speak',
  fetch: api => api.speak(),
  send: (api, item) => api.speakResults(item),
  lay: laySpeak,
  isAnswer: (a): a is Answer => typeof a === 'object' && a !== null
    && typeof (a as Answer).item === 'string' && typeof (a as Answer).right === 'boolean',
  empty: () => ({}),
  isProgress: (x): x is SpeakProgress => typeof x === 'object' && x !== null && !Array.isArray(x),
})
