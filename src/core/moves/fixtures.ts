import type { Body, Joint, Point } from '@/core/pose/body'
import { standing } from '@/core/pose/fixtures'

// Made-up bodies for the move rules, built from Yoga's standing body (shoulders 0.16 apart, at y 0.3).
// The tests check the rules against them and the figures on screen are drawn from them.

const p = (x: number, y: number, visibility = 1): Point => ({ x, y, visibility })

export function changed(changes: Partial<Record<Joint, [number, number] | Point>>, from: Body = standing()): Body {
  const body = { ...from }
  for (const [joint, value] of Object.entries(changes) as [Joint, [number, number] | Point][]) {
    body[joint] = Array.isArray(value) ? p(value[0], value[1]) : value
  }
  return body
}

/** The whole body moved up (negative) or down (positive) in the picture. */
export function shifted(dy: number, from: Body = standing()): Body {
  const body = {} as Body
  for (const [joint, q] of Object.entries(from) as [Joint, Point][]) body[joint] = { ...q, y: q.y + dy }
  return body
}

/** Some joints out of the picture. */
export function unseen(joints: Joint[], from: Body): Body {
  const body = { ...from }
  for (const j of joints) body[j] = { ...body[j], visibility: 0 }
  return body
}

export const ARMS_UP = changed({ lElbow: [0.6, 0.2], rElbow: [0.4, 0.2], lWrist: [0.6, 0.06], rWrist: [0.4, 0.06] })
export const ARMS_T = changed({ lElbow: [0.7, 0.3], rElbow: [0.3, 0.3], lWrist: [0.82, 0.3], rWrist: [0.18, 0.3] })
export const HANDS_ON_HIPS = changed({ lElbow: [0.68, 0.42], rElbow: [0.32, 0.42], lWrist: [0.57, 0.55], rWrist: [0.43, 0.55] })
export const HANDS_ON_HEAD = changed({ lElbow: [0.68, 0.18], rElbow: [0.32, 0.18], lWrist: [0.55, 0.14], rWrist: [0.45, 0.14] })
export const WAVE = changed({ lElbow: [0.66, 0.2], lWrist: [0.7, 0.06] })
export const CLAP = changed({ lElbow: [0.62, 0.45], rElbow: [0.38, 0.45], lWrist: [0.52, 0.42], rWrist: [0.48, 0.42] })
/** Down in a squat: the upper body 0.8 shoulder widths lower */
export const SQUAT = shifted(0.13)
/** In the air: the whole body 0.4 shoulder widths higher */
export const HOP = shifted(-0.065)
/** Bent over, hands down at the knees */
export const BEND = changed({ lElbow: [0.6, 0.62], rElbow: [0.4, 0.62], lWrist: [0.56, 0.76], rWrist: [0.44, 0.76] }, shifted(0.16))
