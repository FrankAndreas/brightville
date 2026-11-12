import { describe, expect, it } from 'vitest'
import type { Body, Joint } from './body'
import { FIXTURES, mirrored, standing } from './fixtures'
import { POSES, matchPose, type PoseId } from './poses'

const ids: PoseId[] = ['stern', 'riese', 'baum', 'frosch', 'flieger']

function scaled(b: Body, factor: number): Body {
  const out = {} as Body
  for (const joint of Object.keys(b) as Joint[]) {
    const p = b[joint]
    out[joint] = { x: 0.5 + (p.x - 0.5) * factor, y: 0.5 + (p.y - 0.5) * factor, visibility: p.visibility }
  }
  return out
}

function hidden(b: Body, ...joints: Joint[]): Body {
  const out = structuredClone(b)
  for (const joint of joints) out[joint].visibility = 0.1
  return out
}

describe('pose rules', () => {
  it.each(ids)('%s matches its own fixture and no other', id => {
    for (const other of ids) expect(matchPose(id, FIXTURES[other]), `${id} on ${other}`).toBe(id === other)
  })

  it.each(ids)('%s also matches mirrored', id => {
    expect(matchPose(id, mirrored(FIXTURES[id]))).toBe(true)
  })

  it.each(ids)('%s does not match plain standing', id => {
    expect(matchPose(id, standing())).toBe(false)
  })

  it.each(ids)('%s holds at half the size', id => {
    expect(matchPose(id, scaled(FIXTURES[id], 0.5))).toBe(true)
  })

  it.each(ids)('%s still tells poses apart when the feet are out of the picture', id => {
    for (const other of ids) {
      const body = hidden(FIXTURES[other], 'lAnkle', 'rAnkle')
      expect(matchPose(id, body), `${id} on ${other} without ankles`).toBe(id === other)
    }
  })

  it('does not match when a needed joint is hidden', () => {
    expect(matchPose('stern', hidden(FIXTURES.stern, 'lWrist'))).toBe(false)
    expect(matchPose('riese', hidden(FIXTURES.riese, 'nose'))).toBe(false)
    expect(matchPose('frosch', hidden(FIXTURES.frosch, 'rKnee'))).toBe(false)
    expect(matchPose('flieger', hidden(FIXTURES.flieger, 'rElbow'))).toBe(false)
    expect(matchPose('baum', hidden(FIXTURES.baum, 'lHip'))).toBe(false)
  })

  it('does not call bent arms a star', () => {
    const b = structuredClone(FIXTURES.stern)
    b.lElbow.y += 0.1
    b.rElbow.y += 0.1
    expect(matchPose('stern', b)).toBe(false)
  })

  // Side-on, the shoulders nearly overlap in the picture; lengths must not all look huge then
  function sideOn(b: Body): Body {
    const out = structuredClone(b)
    for (const joint of Object.keys(out) as Joint[]) out[joint].x = 0.5 + (out[joint].x - 0.5) * 0.08
    return out
  }

  it('does not hand out a tree for standing side-on with raised hands', () => {
    const b = sideOn(FIXTURES.riese)
    b.lAnkle.y -= 0.02
    expect(matchPose('baum', b)).toBe(false)
  })

  it('does not hand out a plane for standing side-on with one arm forward and up', () => {
    const b = sideOn(standing())
    b.lElbow = { x: 0.6, y: 0.24, visibility: 1 }
    b.lWrist = { x: 0.7, y: 0.18, visibility: 1 }
    b.rElbow = { x: 0.44, y: 0.4, visibility: 1 }
    b.rWrist = { x: 0.38, y: 0.5, visibility: 1 }
    expect(matchPose('flieger', b)).toBe(false)
  })

  it('needs the upper body to lean for the plane, not just one arm up and one down', () => {
    const b = structuredClone(FIXTURES.flieger)
    b.lShoulder = { x: 0.58, y: 0.3, visibility: 1 }
    b.rShoulder = { x: 0.42, y: 0.3, visibility: 1 }
    expect(matchPose('flieger', b)).toBe(false)
  })

  it('does not call sitting on a chair a frog', () => {
    const b = structuredClone(FIXTURES.frosch)
    // knees straight ahead, arms hanging beside the hips
    b.lKnee.x = 0.56
    b.rKnee.x = 0.44
    b.lWrist = { x: 0.64, y: 0.8, visibility: 1 }
    b.rWrist = { x: 0.36, y: 0.8, visibility: 1 }
    expect(matchPose('frosch', b)).toBe(false)
  })

  it('does not call hands in the lap a frog', () => {
    const b = structuredClone(FIXTURES.frosch)
    b.lWrist.y = b.rWrist.y = 0.7
    expect(matchPose('frosch', b)).toBe(false)
  })

  it('has the exact voice lines', () => {
    expect(Object.fromEntries(POSES.map(p => [p.id, p.voice]))).toEqual({
      stern: 'Mach einen Stern!',
      riese: 'Mach dich gross wie ein Riese!',
      baum: 'Steh wie ein Baum!',
      frosch: 'Hock dich hin wie ein Frosch!',
      flieger: 'Flieg wie ein Flugzeug!',
    })
  })
})
