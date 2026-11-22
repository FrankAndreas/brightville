import { layReading, type ReadingProgress } from '@/core/reading/rules'
import type { ReadingResultsIn } from '@/services/api'
import { defineRoundStore } from './rounds'

type Answer = ReadingResultsIn['answers'][number]

/**
 * The Oberstufe's reading record for the child playing: per text how often he read it and how he did last time.
 * Kept by the server (backend/app/reading.py); a visit counts here at once and waits on the device (under
 * brightville.reading.<id>) until the server has it (stores/rounds.ts).
 */
export const useReadingStore = defineRoundStore<ReadingProgress, Answer>('reading', {
  prefix: 'brightville.reading',
  fetch: api => api.reading(),
  send: (api, item) => api.readingResults(item),
  lay: layReading,
  isAnswer: (a): a is Answer => typeof a === 'object' && a !== null
    && typeof (a as Answer).text === 'string' && typeof (a as Answer).right === 'number',
  empty: () => ({}),
  isProgress: (x): x is ReadingProgress => typeof x === 'object' && x !== null && !Array.isArray(x),
})
