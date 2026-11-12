/** A tracked point in the camera picture: x to the right, y downwards. */
export interface Point {
  x: number
  y: number
  /** 0…1, how sure the tracker is that the point is in view */
  visibility: number
}

export type Joint =
  | 'nose' | 'lShoulder' | 'rShoulder' | 'lElbow' | 'rElbow' | 'lWrist' | 'rWrist'
  | 'lHip' | 'rHip' | 'lKnee' | 'rKnee' | 'lAnkle' | 'rAnkle'

export type Body = Record<Joint, Point>

// Positions in MediaPipe's list of 33 pose landmarks
const INDEX: Record<Joint, number> = {
  nose: 0,
  lShoulder: 11, rShoulder: 12, lElbow: 13, rElbow: 14, lWrist: 15, rWrist: 16,
  lHip: 23, rHip: 24, lKnee: 25, rKnee: 26, lAnkle: 27, rAnkle: 28,
}
const NEEDED = 29

/** Below this a joint counts as not seen */
export const MIN_VISIBILITY = 0.6

/**
 * Picks the joints the poses use out of the tracker's landmarks.
 * `aspect` is the picture's width divided by its height: landmarks come as
 * fractions of width and of height, and x is stretched so that a distance
 * means the same in both directions.
 */
export function bodyFromLandmarks(
  landmarks: { x: number; y: number; visibility?: number }[], aspect = 1,
): Body | null {
  if (landmarks.length < NEEDED) return null
  const body = {} as Body
  for (const joint of Object.keys(INDEX) as Joint[]) {
    const l = landmarks[INDEX[joint]]
    body[joint] = { x: l.x * aspect, y: l.y, visibility: l.visibility ?? 0 }
  }
  return body
}

const seen = (p: Point) => p.visibility >= MIN_VISIBILITY

/** Head to knees in view: enough to start. */
export function isBodyVisible(b: Body): boolean {
  return [b.nose, b.lShoulder, b.rShoulder, b.lHip, b.rHip, b.lKnee, b.rKnee].every(seen)
}

export function allSeen(b: Body, joints: Joint[]): boolean {
  return joints.every(j => seen(b[j]))
}
