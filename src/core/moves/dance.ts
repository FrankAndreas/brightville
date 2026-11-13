import { MIN_VISIBILITY, type Body, type Point } from '@/core/pose/body'
import { distance, mid } from '@/core/pose/geometry'
import { armUp, bothUp } from './arms'
import { ARMS_T, ARMS_UP, CLAP, HANDS_ON_HEAD, HANDS_ON_HIPS, WAVE } from './fixtures'

export type DanceMove = 'armeHoch' | 'armeSeite' | 'huefte' | 'kopf' | 'winken' | 'klatschen'

interface DanceDef {
  id: DanceMove
  /** Said when the move first comes up in a song */
  voice: string
  /** What the dancer shows; the rules are tested against it */
  body: Body
}

export const DANCE_MOVES: DanceDef[] = [
  { id: 'armeHoch', voice: 'Arme hoch!', body: ARMS_UP },
  { id: 'armeSeite', voice: 'Arme zur Seite!', body: ARMS_T },
  { id: 'huefte', voice: 'Hände auf die Hüften!', body: HANDS_ON_HIPS },
  { id: 'kopf', voice: 'Hände auf den Kopf!', body: HANDS_ON_HEAD },
  { id: 'winken', voice: 'Winken!', body: WAVE },
  { id: 'klatschen', voice: 'Klatschen!', body: CLAP },
]

export const danceDef = (id: DanceMove): DanceDef => DANCE_MOVES.find(m => m.id === id)!

const seen = (p: Point) => p.visibility >= MIN_VISIBILITY

/** How far a point is out from the middle of the body, sideways */
function out(b: Body, p: Point): number {
  return Math.abs(p.x - mid(b.lShoulder, b.rShoulder).x)
}

/**
 * Whether the body is in the dance move right now. All moves are arm moves, measured in shoulder widths,
 * so only head, shoulders and arms need to be in the picture.
 */
export function matchDance(move: DanceMove, b: Body, unit: number): boolean {
  const arms = [
    { shoulder: b.lShoulder, elbow: b.lElbow, wrist: b.lWrist },
    { shoulder: b.rShoulder, elbow: b.rElbow, wrist: b.rWrist },
  ]
  const wristsSeen = seen(b.lWrist) && seen(b.rWrist)
  switch (move) {
    case 'armeHoch':
      return bothUp(b, unit)
    case 'armeSeite':
      return wristsSeen && arms.every(a =>
        Math.abs(a.wrist.y - a.shoulder.y) < 0.7 * unit && out(b, a.wrist) > out(b, a.shoulder) + unit)
    case 'huefte':
      return wristsSeen && arms.every(a =>
        seen(a.elbow) && a.wrist.y > a.shoulder.y + unit && a.wrist.y < a.shoulder.y + 2.2 * unit &&
        out(b, a.elbow) > out(b, a.shoulder) + 0.45 * unit)
    case 'kopf':
      return wristsSeen && seen(b.nose) && arms.every(a =>
        a.wrist.y > b.nose.y - 0.6 * unit && a.wrist.y < a.shoulder.y && Math.abs(a.wrist.x - b.nose.x) < 0.8 * unit)
    case 'winken':
      return armUp(b, 'l', unit) !== armUp(b, 'r', unit)
    case 'klatschen':
      return wristsSeen && seen(b.nose) && distance(b.lWrist, b.rWrist) < 0.5 * unit &&
        arms.every(a => a.wrist.y > b.nose.y && a.wrist.y < a.shoulder.y + 1.5 * unit)
  }
}
