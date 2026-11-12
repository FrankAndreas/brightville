import type { Body, Joint, Point } from './body'
import type { PoseId } from './poses'

// Made-up bodies: one clear example per pose. The tests check the rules against
// them, and the yoga teacher is drawn from them, so teacher and rules agree.

const p = (x: number, y: number): Point => ({ x, y, visibility: 1 })

/** Arms hanging, feet together, facing the camera. Shoulders are 0.16 apart. */
export function standing(): Body {
  return {
    nose: p(0.5, 0.2),
    lShoulder: p(0.58, 0.3), rShoulder: p(0.42, 0.3),
    lElbow: p(0.6, 0.42), rElbow: p(0.4, 0.42),
    lWrist: p(0.6, 0.54), rWrist: p(0.4, 0.54),
    lHip: p(0.55, 0.56), rHip: p(0.45, 0.56),
    lKnee: p(0.545, 0.74), rKnee: p(0.455, 0.74),
    lAnkle: p(0.54, 0.92), rAnkle: p(0.46, 0.92),
  }
}

const pose = (changes: Partial<Record<Joint, [number, number]>>): Body => {
  const body = standing()
  for (const [joint, [x, y]] of Object.entries(changes) as [Joint, [number, number]][]) body[joint] = p(x, y)
  return body
}

export const FIXTURES: Record<PoseId, Body> = {
  stern: pose({
    lElbow: [0.7, 0.3], rElbow: [0.3, 0.3], lWrist: [0.82, 0.3], rWrist: [0.18, 0.3],
    lKnee: [0.595, 0.74], rKnee: [0.405, 0.74], lAnkle: [0.64, 0.92], rAnkle: [0.36, 0.92],
  }),
  riese: pose({
    lElbow: [0.59, 0.19], rElbow: [0.41, 0.19], lWrist: [0.57, 0.07], rWrist: [0.43, 0.07],
  }),
  baum: pose({
    lElbow: [0.6, 0.2], rElbow: [0.4, 0.2], lWrist: [0.51, 0.1], rWrist: [0.49, 0.1],
    lKnee: [0.72, 0.68], lAnkle: [0.5, 0.74], rKnee: [0.46, 0.74],
  }),
  frosch: pose({
    nose: [0.5, 0.42],
    lShoulder: [0.58, 0.52], rShoulder: [0.42, 0.52],
    lElbow: [0.57, 0.68], rElbow: [0.43, 0.68], lWrist: [0.53, 0.86], rWrist: [0.47, 0.86],
    lHip: [0.56, 0.74], rHip: [0.44, 0.74],
    lKnee: [0.68, 0.76], rKnee: [0.32, 0.76], lAnkle: [0.62, 0.92], rAnkle: [0.38, 0.92],
  }),
  flieger: pose({
    nose: [0.46, 0.21],
    lShoulder: [0.573, 0.266], rShoulder: [0.427, 0.334],
    lElbow: [0.68, 0.216], rElbow: [0.32, 0.384], lWrist: [0.79, 0.165], rWrist: [0.21, 0.435],
  }),
}

/** The same body seen in a mirror: left and right swap. */
export function mirrored(b: Body): Body {
  const flip = (q: Point): Point => ({ x: 1 - q.x, y: q.y, visibility: q.visibility })
  return {
    nose: flip(b.nose),
    lShoulder: flip(b.rShoulder), rShoulder: flip(b.lShoulder),
    lElbow: flip(b.rElbow), rElbow: flip(b.lElbow),
    lWrist: flip(b.rWrist), rWrist: flip(b.lWrist),
    lHip: flip(b.rHip), rHip: flip(b.lHip),
    lKnee: flip(b.rKnee), rKnee: flip(b.lKnee),
    lAnkle: flip(b.rAnkle), rAnkle: flip(b.lAnkle),
  }
}
