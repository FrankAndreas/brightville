import { layDates, type DatesProgress } from '@/core/dates/round'
import type { DatesResultsIn } from '@/services/api'
import { defineRoundStore } from './rounds'

type Answer = DatesResultsIn['answers'][number]

/**
 * The Oberstufe's dates and times record for the child playing: per task kind his last first answers. Kept by the
 * server (backend/app/dates.py); a round counts here at once and waits on the device (under brightville.dates.<id>)
 * until the server has it (stores/rounds.ts).
 */
export const useDatesStore = defineRoundStore<DatesProgress, Answer>('dates', {
  prefix: 'brightville.dates',
  fetch: api => api.dates(),
  send: (api, item) => api.datesResults(item),
  lay: (progress, item) => layDates(progress, item),
  isAnswer: (a): a is Answer => typeof a === 'object' && a !== null
    && typeof (a as Answer).kind === 'string' && typeof (a as Answer).right === 'boolean',
  empty: () => ({}),
  isProgress: (x): x is DatesProgress => typeof x === 'object' && x !== null && !Array.isArray(x),
})
