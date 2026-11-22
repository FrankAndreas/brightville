import type { ListenProgress } from '@/core/listen/round'
import type { ListenResultsIn } from '@/services/api'
import { defineRoundStore } from './rounds'

type Answer = ListenResultsIn['answers'][number]

/** Lays one round's answers over the record, as the server does (backend/app/listen.py) */
function lay(progress: ListenProgress, item: { lang: string; answers: Answer[] }, today: string): ListenProgress {
  const next = { ...progress }
  for (const a of item.answers) {
    if (!a.scene.startsWith(`${item.lang}:`)) continue
    const old = next[a.scene]
    next[a.scene] = {
      right: (old?.right ?? 0) + (a.right ? 1 : 0),
      last_right: a.right ? today : old?.last_right ?? null,
      last_asked: today,
    }
  }
  return next
}

/**
 * The Oberstufe's listening record for the child playing: which scenes he understood. Kept by the server
 * (backend/app/listen.py); a round counts here at once and waits on the device (under brightville.listen.<id>) until
 * the server has it (stores/rounds.ts).
 */
export const useListenStore = defineRoundStore<ListenProgress, Answer>('listen', {
  prefix: 'brightville.listen',
  fetch: api => api.listen(),
  send: (api, item) => api.listenResults(item),
  lay,
  isAnswer: (a): a is Answer => typeof a === 'object' && a !== null
    && typeof (a as Answer).scene === 'string' && typeof (a as Answer).right === 'boolean',
  empty: () => ({}),
  isProgress: (x): x is ListenProgress => typeof x === 'object' && x !== null && !Array.isArray(x),
})
