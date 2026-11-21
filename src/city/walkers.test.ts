import { describe, expect, it } from 'vitest'
import { BUILDINGS } from '@/buildings/registry'
import { BODY_COLORS, GLASSES, HAIR_COLORS, HAIR_STYLES } from '@/core/look'
import { DOOR_RADIUS } from './doors'
import { onStreet } from './map'
import { ROUTES, WALK_SPEED, routeLength, startWalkers, stepWalker, townsfolkDress, turnToward, walkerAt, type Walker } from './walkers'

const away = { x: 999, z: 999 }
const run = (w: Walker, her: { x: number; z: number }, seconds: number, each?: (w: Walker) => void) => {
  for (let t = 0; t < seconds; t += 1 / 30) {
    w = stepWalker(w, her, 1 / 30)
    each?.(w)
  }
  return w
}
const pointsOf = (route: number) => {
  const out: { x: number; z: number }[] = []
  for (let a = 0; a < routeLength(route); a += 0.5) out.push(walkerAt({ route, along: a, dir: 1 }))
  return out
}

describe('townsfolk', () => {
  it('has a walker on the farm lane and one in the workshop yard', () => {
    const at = (x0: number, x1: number, z0: number, z1: number) =>
      ROUTES.some((_, r) => pointsOf(r).every(p => p.x >= x0 && p.x <= x1 && p.z >= z0 && p.z <= z1))
    expect(at(0, 35, -105, -60)).toBe(true)
    expect(at(60, 100, -20, 20)).toBe(true)
  })

  it('has 6 to 10 routes and one walker on each', () => {
    expect(ROUTES.length).toBeGreaterThanOrEqual(6)
    expect(ROUTES.length).toBeLessThanOrEqual(10)
    expect(startWalkers().map(w => w.route).sort()).toEqual(ROUTES.map((_, i) => i))
  })

  it('walks its loop and comes round again', () => {
    for (const [route] of ROUTES.entries()) {
      const w = { route, along: 0, dir: 1 as const }
      const length = routeLength(route)
      const later = run(w, away, length / WALK_SPEED + 0.5)
      expect(later.along).toBeLessThan(2)
      const half = run(w, away, length / WALK_SPEED / 2)
      expect(Math.abs(half.along - length / 2)).toBeLessThan(1)
    }
  })

  it('turns back when she stands in its way, and walks on its way again when she is gone', () => {
    const route = 1
    const her = walkerAt({ route, along: 6, dir: 1 })
    const turned = run({ route, along: 0, dir: 1 }, her, 4)
    expect(turned.dir).toBe(-1)
    // Nobody in the way any more: round the loop the other way, and on the next meeting it turns again
    const later = run(turned, away, 2)
    expect(later.dir).toBe(-1)
  })

  it('never comes closer to her than 1.4 m', () => {
    for (const [route] of ROUTES.entries()) {
      for (const at of [3, 10, 25]) {
        for (const lateral of [0, 0.7, -1.2]) {
          const on = walkerAt({ route, along: at, dir: 1 })
          const her = { x: on.x + Math.cos(on.heading) * lateral, z: on.z - Math.sin(on.heading) * lateral }
          let closest = Infinity
          run({ route, along: 0, dir: 1 }, her, 20, w => {
            const p = walkerAt(w)
            closest = Math.min(closest, Math.hypot(p.x - her.x, p.z - her.z))
          })
          expect(closest, `route ${route} at ${at} lateral ${lateral}`).toBeGreaterThanOrEqual(1.4)
        }
      }
    }
  })

  it(`keeps every route ${DOOR_RADIUS + 1} m from every door`, () => {
    for (const [route] of ROUTES.entries()) {
      for (const p of pointsOf(route)) {
        for (const b of BUILDINGS) {
          expect(Math.hypot(p.x - b.door.x, p.z - b.door.z), `route ${route} at ${p.x},${p.z} / ${b.id}`).toBeGreaterThanOrEqual(DOOR_RADIUS + 1 - 1e-9)
        }
      }
    }
  })

  it('keeps every route on a street', () => {
    for (const [route] of ROUTES.entries()) {
      const points = pointsOf(route)
      expect(points.length).toBeGreaterThan(10)
      for (const p of points) expect(onStreet(p.x, p.z), `route ${route} at ${p.x},${p.z}`).toBe(true)
    }
  })

  it('dresses townsfolk only in the free look', () => {
    let seed = 1
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    for (let i = 0; i < 200; i++) {
      const d = townsfolkDress(rand)
      expect(d.worn).toEqual({})
      expect(BODY_COLORS).toContain(d.look.body)
      expect(HAIR_STYLES).toContain(d.look.hair)
      expect(HAIR_COLORS).toContain(d.look.hairColor)
      expect(GLASSES).toContain(d.look.glasses)
    }
  })
})

describe('townsfolk, at the ends of their walks', () => {
  it('turns away from her once, not back and forth, when she stands near the end of a walk', () => {
    for (const [route, points] of ROUTES.entries()) {
      for (const end of points) {
        // She stands 2 m before the end, on the walker's way
        const along = (() => {
          let best = 0
          let closest = Infinity
          for (let a = 0; a < routeLength(route); a += 0.25) {
            const p = walkerAt({ route, along: a, dir: 1 })
            const d = Math.hypot(p.x - end.x, p.z - end.z)
            if (d < closest) { closest = d; best = a }
          }
          return best
        })()
        // She stands 2 m before the end, or 2 m past it (where the walker comes back out after turning there)
        for (const offset of [-2, 2]) {
          const L = routeLength(route)
          const her = walkerAt({ route, along: (along + offset + L) % L, dir: 1 })
          // The walker is just at the end when she comes: whichever way it is going
          for (const dir of [1, -1] as const) {
            let flips = 0
            let w: Walker = { route, along, dir }
            for (let t = 0; t < 10; t += 1 / 30) {
              const next = stepWalker(w, her, 1 / 30)
              if (next.dir !== w.dir) flips++
              w = next
            }
            expect(flips, `route ${route} end ${end.x},${end.z} offset ${offset} dir ${dir}`).toBeLessThanOrEqual(2)
          }
        }
      }
    }
  })

  it('turns round smoothly, not in one frame', () => {
    let shown = 0
    shown = turnToward(shown, Math.PI, 1 / 60)
    expect(shown).toBeGreaterThan(0.05)
    expect(shown).toBeLessThan(0.6)
    for (let i = 0; i < 60; i++) shown = turnToward(shown, Math.PI, 1 / 60)
    expect(Math.abs(Math.atan2(Math.sin(shown - Math.PI), Math.cos(shown - Math.PI)))).toBeLessThan(0.05)
  })
})
