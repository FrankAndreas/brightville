import type { Scene } from './scenes'

export const LISTEN_ROUND = 5

/** His record per scene key, as the server keeps it (backend/app/listen.py) */
export type ListenProgress = Record<string, { right: number; last_right: string | null; last_asked: string }>

/** A scene of a round, with its four answers in the order shown (`order[i]`: the index of the answer shown i-th) */
export interface ListenItem {
  key: string
  scene: Scene
  order: number[]
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Five scenes: first those he never answered right (those never asked, mixed, before those asked, the least recently
 * asked first), then those answered right longest ago. Each scene once; fewer scenes make a shorter round.
 */
export function pickScenes(all: { key: string; scene: Scene }[], progress: ListenProgress, rand: () => number): ListenItem[] {
  const unasked = shuffle(all.filter(x => !progress[x.key]), rand)
  const missed = all
    .filter(x => progress[x.key] && progress[x.key].right === 0)
    .sort((a, b) => progress[a.key].last_asked.localeCompare(progress[b.key].last_asked))
  const known = all
    .filter(x => progress[x.key] && progress[x.key].right > 0)
    .sort((a, b) => (progress[a.key].last_right ?? '').localeCompare(progress[b.key].last_right ?? ''))
  return [...unasked, ...missed, ...known]
    .slice(0, LISTEN_ROUND)
    .map(({ key, scene }) => ({ key, scene, order: shuffle(scene.answers.map((_, i) => i), rand) }))
}
