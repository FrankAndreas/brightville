import { MIN_VISIBILITY, type Body, type Point } from '@/core/pose/body'

export type Side = 'l' | 'r'

const seen = (p: Point) => p.visibility >= MIN_VISIBILITY

function arm(b: Body, side: Side) {
  return side === 'l'
    ? { shoulder: b.lShoulder, elbow: b.lElbow, wrist: b.lWrist }
    : { shoulder: b.rShoulder, elbow: b.rElbow, wrist: b.rWrist }
}

/**
 * The hand high over the head. When she stands close, a raised hand leaves the top of the picture:
 * then an elbow above the shoulder is enough.
 */
export function armUp(b: Body, side: Side, unit: number): boolean {
  const { shoulder, elbow, wrist } = arm(b, side)
  if (seen(wrist)) {
    const head = seen(b.nose) ? b.nose.y : shoulder.y - 1.2 * unit
    return wrist.y < head - 0.6 * unit
  }
  return seen(elbow) && elbow.y < shoulder.y - 0.3 * unit
}

/** The hand hanging well below the shoulder; a hand out of the bottom of the picture counts by its elbow. */
export function armDown(b: Body, side: Side, unit: number): boolean {
  const { shoulder, elbow, wrist } = arm(b, side)
  if (seen(wrist)) return wrist.y > shoulder.y + 0.6 * unit
  return seen(elbow) && elbow.y > shoulder.y + 0.3 * unit
}

export const bothUp = (b: Body, unit: number) => armUp(b, 'l', unit) && armUp(b, 'r', unit)
export const bothDown = (b: Body, unit: number) => armDown(b, 'l', unit) && armDown(b, 'r', unit)
