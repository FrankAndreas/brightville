import { describe, expect, it } from 'vitest'
import { pickScenes, LISTEN_ROUND, type ListenProgress } from './round'
import type { Scene } from './scenes'

const scene = (id: string): Scene => ({ id, lines: [id], question: '?', answers: ['a', 'b', 'c', 'd'], right: 0 })
const all = (ids: string[]) => ids.map(id => ({ key: `en:t:${id}`, topic: 't', scene: scene(id) }))
const asked = (right: number, lastAsked: string, lastRight: string | null = null) => ({ right, last_asked: lastAsked, last_right: lastRight })

describe('a listening round', () => {
  it('takes five: never right first (never asked before asked, then the oldest asked), then the oldest right', () => {
    const progress: ListenProgress = {
      'en:t:a': asked(2, '2026-11-20', '2026-11-20'),
      'en:t:b': asked(1, '2026-11-21', '2026-11-01'),
      'en:t:c': asked(0, '2026-11-21'),
      'en:t:d': asked(0, '2026-11-10'),
      'en:t:f': asked(3, '2026-11-15', '2026-11-15'),
    }
    const round = pickScenes(all(['a', 'b', 'c', 'd', 'e', 'f']), progress, () => 0.5)
    expect(LISTEN_ROUND).toBe(5)
    expect(round.map(r => r.key)).toEqual(['en:t:e', 'en:t:d', 'en:t:c', 'en:t:b', 'en:t:f'])
  })

  it('never takes a scene twice, and mixes the answers', () => {
    const round = pickScenes(all(['a', 'b', 'c', 'd', 'e', 'f', 'g']), {}, Math.random)
    expect(new Set(round.map(r => r.key)).size).toBe(5)
    for (const r of round) expect([...r.order].sort()).toEqual([0, 1, 2, 3])
    expect(round[0].scene.id).toBeDefined()
  })

  it('a topic with fewer scenes gives a shorter round', () => {
    expect(pickScenes(all(['a', 'b', 'c']), {}, Math.random)).toHaveLength(3)
  })
})
