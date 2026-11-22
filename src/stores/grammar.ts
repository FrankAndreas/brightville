import { layGrammar, type GrammarProgress } from '@/core/grammar/round'
import type { GrammarResultsIn } from '@/services/api'
import { defineRoundStore } from './rounds'

export { layGrammar }

type Answer = GrammarResultsIn['answers'][number]

/**
 * The Oberstufe's grammar record for the child playing: per topic his last first answers and the items he missed.
 * Kept by the server (backend/app/grammar.py); a round counts here at once and waits on the device (under
 * brightville.grammar.<id>) until the server has it (stores/rounds.ts).
 */
export const useGrammarStore = defineRoundStore<GrammarProgress, Answer>('grammar', {
  prefix: 'brightville.grammar',
  fetch: api => api.grammar(),
  send: (api, item) => api.grammarResults(item),
  lay: (progress, item) => layGrammar(progress, item),
  isAnswer: (a): a is Answer => typeof a === 'object' && a !== null
    && typeof (a as Answer).item === 'string' && typeof (a as Answer).right === 'boolean',
  empty: () => ({}),
  isProgress: (x): x is GrammarProgress => typeof x === 'object' && x !== null && !Array.isArray(x),
})
