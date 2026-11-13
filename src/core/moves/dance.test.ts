import { describe, expect, it } from 'vitest'
import { mirrored, standing } from '@/core/pose/fixtures'
import { DANCE_MOVES, matchDance, type DanceMove } from './dance'
import { ARMS_UP, unseen } from './fixtures'

const UNIT = 0.16

describe('dance moves', () => {
  it('has six arm moves, each with a name to say and a body to show', () => {
    expect(DANCE_MOVES.map(m => m.id)).toEqual(['armeHoch', 'armeSeite', 'huefte', 'kopf', 'winken', 'klatschen'])
    for (const m of DANCE_MOVES) expect(m.voice).toMatch(/\S/)
  })

  it('recognises each move in its own body and in no other', () => {
    for (const shown of DANCE_MOVES) {
      for (const asked of DANCE_MOVES) {
        expect(matchDance(asked.id, shown.body, UNIT), `${asked.id} in ${shown.id}`).toBe(asked.id === shown.id)
        expect(matchDance(asked.id, mirrored(shown.body), UNIT), `${asked.id} in mirrored ${shown.id}`).toBe(asked.id === shown.id)
      }
    }
  })

  it('recognises nothing in someone just standing', () => {
    for (const m of DANCE_MOVES) expect(matchDance(m.id, standing(), UNIT)).toBe(false)
  })

  it('takes arms up whose hands left the top of the picture', () => {
    expect(matchDance('armeHoch', unseen(['lWrist', 'rWrist'], ARMS_UP), UNIT)).toBe(true)
  })

  it('does not guess a move from hands it cannot see', () => {
    const moves: DanceMove[] = ['armeSeite', 'huefte', 'kopf', 'klatschen']
    for (const id of moves) {
      const body = DANCE_MOVES.find(m => m.id === id)!.body
      expect(matchDance(id, unseen(['lWrist'], body), UNIT), id).toBe(false)
    }
  })
})
