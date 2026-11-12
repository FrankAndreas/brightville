import { MIN_VISIBILITY, allSeen, type Body, type Joint } from './body'
import { angleDeg, distance, mid, shoulderWidth, tiltDeg } from './geometry'

// Side-on to the camera the shoulders nearly overlap and every length measured
// in shoulder widths would look huge. The body counts as facing the camera when
// the shoulders are at least this wide compared with shoulder-to-hip.
const MIN_FACING = 0.4

export type PoseId = 'stern' | 'riese' | 'baum' | 'frosch' | 'flieger'

export interface PoseDef {
  id: PoseId
  /** What the teacher says, German */
  voice: string
  matches(b: Body): boolean
}

// All lengths below are in shoulder widths. y grows downwards, so "above" is a smaller y.

const STRAIGHT_ARM_DEG = 150
const armsStraight = (b: Body) =>
  angleDeg(b.lShoulder, b.lElbow, b.lWrist) > STRAIGHT_ARM_DEG &&
  angleDeg(b.rShoulder, b.rElbow, b.rWrist) > STRAIGHT_ARM_DEG

/**
 * Where the feet are. The spec only asks for head to knees in the picture, so
 * when the ankles aren't seen the knees stand in, with their own thresholds.
 */
function legs(b: Body, sw: number) {
  const ankles = b.lAnkle.visibility >= MIN_VISIBILITY && b.rAnkle.visibility >= MIN_VISIBILITY
  if (ankles) {
    const apart = Math.abs(b.lAnkle.x - b.rAnkle.x) / sw
    const uneven = Math.abs(b.lAnkle.y - b.rAnkle.y) / sw
    return { wide: apart > 1.2, together: apart < 0.8 && uneven < 0.3, oneLifted: uneven > 0.5 }
  }
  const apart = Math.abs(b.lKnee.x - b.rKnee.x) / sw
  const uneven = Math.abs(b.lKnee.y - b.rKnee.y) / sw
  return {
    wide: apart > 0.9 && uneven < 0.15,
    together: apart < 0.75,
    // A foot on the other leg pushes that knee out sideways and a little up
    oneLifted: apart > 0.9 && uneven > 0.15,
  }
}

const SHOULDERS: Joint[] = ['lShoulder', 'rShoulder']
const ARMS: Joint[] = [...SHOULDERS, 'lElbow', 'rElbow', 'lWrist', 'rWrist']
const KNEES: Joint[] = ['lKnee', 'rKnee']
const HIPS: Joint[] = ['lHip', 'rHip']

interface Rule {
  id: PoseId
  voice: string
  needs: Joint[]
  test(b: Body, sw: number): boolean
}

const RULES: Rule[] = [
  {
    id: 'stern',
    voice: 'Mach einen Stern!',
    needs: [...ARMS, ...KNEES],
    test(b, sw) {
      const level = (wrist: Joint, shoulder: Joint) => Math.abs(b[wrist].y - b[shoulder].y) < 0.5 * sw
      const out = (wrist: Joint, shoulder: Joint) => b[wrist].x - b[shoulder].x
      return (
        armsStraight(b) &&
        level('lWrist', 'lShoulder') && level('rWrist', 'rShoulder') &&
        Math.abs(out('lWrist', 'lShoulder')) > 0.9 * sw && Math.abs(out('rWrist', 'rShoulder')) > 0.9 * sw &&
        out('lWrist', 'lShoulder') * out('rWrist', 'rShoulder') < 0 &&
        tiltDeg(b.lWrist, b.rWrist) < 12 &&
        legs(b, sw).wide
      )
    },
  },
  {
    id: 'riese',
    voice: 'Mach dich gross wie ein Riese!',
    needs: ['nose', 'lWrist', 'rWrist', ...KNEES],
    test(b, sw) {
      return b.lWrist.y < b.nose.y && b.rWrist.y < b.nose.y && legs(b, sw).together
    },
  },
  {
    id: 'baum',
    voice: 'Steh wie ein Baum!',
    needs: ['lShoulder', 'rShoulder', 'lWrist', 'rWrist', ...HIPS, ...KNEES],
    test(b, sw) {
      const handsUp = b.lWrist.y < b.lShoulder.y && b.rWrist.y < b.rShoulder.y
      const handsTogether = distance(b.lWrist, b.rWrist) < 0.4 * sw
      const standingKneeY = Math.max(b.lKnee.y, b.rKnee.y)
      const upright = standingKneeY - mid(b.lHip, b.rHip).y > 0.8 * sw
      return legs(b, sw).oneLifted && (handsUp || handsTogether) && upright
    },
  },
  {
    id: 'frosch',
    voice: 'Hock dich hin wie ein Frosch!',
    needs: ['lWrist', 'rWrist', ...HIPS, ...KNEES],
    test(b, sw) {
      const hips = mid(b.lHip, b.rHip)
      const knees = mid(b.lKnee, b.rKnee)
      const left = Math.min(b.lKnee.x, b.rKnee.x)
      const right = Math.max(b.lKnee.x, b.rKnee.x)
      const between = (wrist: Joint) => b[wrist].x > left && b[wrist].x < right
      // Hands down between the knees: not hanging beside a chair, not resting in the lap
      const down = (wrist: Joint) => b[wrist].y > knees.y
      return knees.y - hips.y < 0.5 * sw && between('lWrist') && between('rWrist') && down('lWrist') && down('rWrist')
    },
  },
  {
    id: 'flieger',
    voice: 'Flieg wie ein Flugzeug!',
    needs: ARMS,
    test(b, sw) {
      const tilt = tiltDeg(b.lWrist, b.rWrist)
      // The whole upper body leans, not just one arm up and one down
      const leaning = tiltDeg(b.lShoulder, b.rShoulder) >= 8
      return armsStraight(b) && distance(b.lWrist, b.rWrist) > 2.5 * sw && tilt >= 20 && tilt <= 65 && leaning
    },
  },
]

function check(rule: Rule, b: Body): boolean {
  if (!allSeen(b, [...rule.needs, ...SHOULDERS, ...HIPS])) return false
  const sw = shoulderWidth(b)
  const torso = distance(mid(b.lShoulder, b.rShoulder), mid(b.lHip, b.rHip))
  if (sw <= 0 || sw < MIN_FACING * torso) return false
  return rule.test(b, sw)
}

export const POSES: PoseDef[] = RULES.map(rule => ({
  id: rule.id,
  voice: rule.voice,
  matches: b => check(rule, b),
}))

export function poseDef(id: PoseId): PoseDef {
  return POSES.find(p => p.id === id)!
}

/** Is the body in this pose? False when a joint the rule needs isn't seen. */
export function matchPose(id: PoseId, b: Body): boolean {
  return poseDef(id).matches(b)
}
