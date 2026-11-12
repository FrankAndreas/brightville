import { describe, it, expect } from 'vitest'
import { edgeScale, hitTest, buildRound, createTapRest, REST_MS } from './differences'

describe('edgeScale', () => {
  it('returns 1.0 for a point at the centre', () => {
    expect(edgeScale(0.5, 0.5)).toBe(1)
  })

  it('returns > 1 when within 12% of an edge', () => {
    expect(edgeScale(0.05, 0.5)).toBeGreaterThan(1)
  })

  it('returns MAX_SCALE at the very edge (0)', () => {
    expect(edgeScale(0, 0.5)).toBeCloseTo(1.9)
  })

  it('clamps at 1 for edge distances >= EDGE_ZONE', () => {
    expect(edgeScale(0.15, 0.5)).toBe(1)
  })
})

describe('hitTest', () => {
  // Container: 800px wide, 600px tall
  const rect = { width: 800, height: 600 }

  it('returns true when tap is within the hotspot radius', () => {
    const hotspot = { x: 0.5, y: 0.5, r: 40 }
    // Tap exactly at centre — distance 0
    expect(hitTest(0.5, 0.5, hotspot, rect)).toBe(true)
  })

  it('returns true when tap is within scaled edge radius', () => {
    const hotspot = { x: 0.05, y: 0.5, r: 30 }
    // Tap at hotspot centre — always hits regardless of scale
    expect(hitTest(0.05, 0.5, hotspot, rect)).toBe(true)
  })

  it('returns false when tap is far outside radius', () => {
    const hotspot = { x: 0.5, y: 0.5, r: 30 }
    // Tap 200px away in screen space = 0.25 fraction away
    expect(hitTest(0.75, 0.5, hotspot, rect)).toBe(false)
  })
})

describe('hitTest scaling', () => {
  const hotspot = { x: 0.5, y: 0.5, r: 40 }

  it('shrinks the radius with the rendered image', () => {
    // 400px wide → radius 20px; tap 30px right of centre misses
    const rect = { width: 400, height: 300 }
    expect(hitTest(0.5 + 30 / 400, 0.5, hotspot, rect)).toBe(false)
    expect(hitTest(0.5 + 15 / 400, 0.5, hotspot, rect)).toBe(true)
  })

  it('grows the radius with the rendered image', () => {
    // 1600px wide → radius 80px; tap 60px right of centre hits
    const rect = { width: 1600, height: 1200 }
    expect(hitTest(0.5 + 60 / 1600, 0.5, hotspot, rect)).toBe(true)
  })
})

describe('buildRound', () => {
  const SCENE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600">
  <rect width="800" height="600" fill="blue"/>
  <g data-diff="sun" data-cx="400" data-cy="150" data-r="50">
    <g data-variant="orig"><circle id="sun" cx="400" cy="150" r="40" fill="yellow"/></g>
    <g data-variant="red" data-label="Rot!" display="none"><circle cx="400" cy="150" r="40" fill="red"/></g>
    <g data-variant="gone" data-label="Weg!" display="none"/>
  </g>
  <g data-diff="tree" data-cx="100" data-cy="300" data-r="30">
    <g data-variant="orig"><rect id="tree" x="90" y="290" width="20" height="20"/></g>
    <g data-variant="gone" data-label="Baum weg!" display="none"/>
  </g>
  <g data-diff="cat" data-cx="600" data-cy="450" data-r="40">
    <g data-variant="orig"/>
    <g data-variant="here" data-label="Katze!" display="none"><circle id="cat" cx="600" cy="450" r="10"/></g>
  </g>
</svg>`

  const parse = (s: string) => new DOMParser().parseFromString(s, 'image/svg+xml')
  const visible = (doc: Document, sel: string) => {
    for (let el: Element | null = doc.querySelector(sel); el; el = el.parentElement) {
      if (el.getAttribute('display') === 'none') return false
    }
    return true
  }
  // Deterministic "random" that always returns the given values in turn
  const seq = (...vals: number[]) => { let i = 0; return () => vals[i++ % vals.length] }

  it('picks the requested number of differences', () => {
    const round = buildRound(SCENE, 2)
    expect(round.hotspots).toHaveLength(2)
    expect(round.hotspots.map(h => h.id)).toEqual([1, 2])
  })

  it('caps the count at the number of candidates', () => {
    expect(buildRound(SCENE, 10).hotspots).toHaveLength(3)
  })

  it('converts hotspot centres to fractions and keeps radius in 800px units', () => {
    const round = buildRound(SCENE, 3)
    const sun = round.hotspots.find(h => h.key === 'sun')
    expect(sun).toMatchObject({ x: 0.5, y: 0.25, r: 50 })
  })

  it('shows the picked variant only in the modified image', () => {
    // random() = 0.99 → last variant; shuffle is driven by the same sequence
    const round = buildRound(SCENE, 3, seq(0.99))
    const orig = parse(round.original)
    const mod  = parse(round.modified)
    expect(visible(orig, '#sun')).toBe(true)
    expect(visible(orig, '#tree')).toBe(true)
    expect(visible(orig, '#cat')).toBe(false)
    expect(visible(mod, '#sun')).toBe(false)
    expect(visible(mod, '#tree')).toBe(false)
    expect(visible(mod, '#cat')).toBe(true)
  })

  it('uses the variant label', () => {
    const round = buildRound(SCENE, 3, seq(0))
    const sun = round.hotspots.find(h => h.key === 'sun')
    expect(sun?.label).toBe('Rot!')
    const mod = parse(round.modified)
    expect(mod.querySelector('[data-variant="red"]')?.getAttribute('display')).toBeNull()
  })

  it('leaves differences that were not picked unchanged', () => {
    const round = buildRound(SCENE, 1, seq(0))
    const picked = round.hotspots[0].key
    const mod = parse(round.modified)
    for (const key of ['sun', 'tree', 'cat'].filter(k => k !== picked)) {
      const g = mod.querySelector(`[data-diff="${key}"]`)
      expect(g?.querySelector('[data-variant="orig"]')?.getAttribute('display')).toBeNull()
    }
  })

  it('reports the picked variant', () => {
    const round = buildRound(SCENE, 3, seq(0))
    expect(round.hotspots.find(h => h.key === 'sun')?.variant).toBe('red')
  })

  it('prefers differences that were not in the previous round', () => {
    for (let i = 0; i < 20; i++) {
      const previous = buildRound(SCENE, 2).hotspots
      const fresh = ['sun', 'tree', 'cat'].find(k => !previous.some(h => h.key === k))
      const round = buildRound(SCENE, 2, Math.random, previous)
      expect(round.hotspots.map(h => h.key)).toContain(fresh)
    }
  })

  it('picks another variant for a difference that repeats', () => {
    for (let i = 0; i < 20; i++) {
      const previous = buildRound(SCENE, 3).hotspots
      const round = buildRound(SCENE, 3, Math.random, previous)
      const before = previous.find(h => h.key === 'sun')?.variant
      expect(round.hotspots.find(h => h.key === 'sun')?.variant).not.toBe(before)
    }
  })

  it('repeats a variant when a difference has no other', () => {
    const previous = buildRound(SCENE, 3).hotspots
    const round = buildRound(SCENE, 3, Math.random, previous)
    expect(round.hotspots.find(h => h.key === 'tree')?.variant).toBe('gone')
  })

  it('varies between rounds', () => {
    const picks = new Set<string>()
    for (let i = 0; i < 30; i++) {
      const r = buildRound(SCENE, 1)
      picks.add(`${r.hotspots[0].key}/${r.hotspots[0].label}`)
    }
    expect(picks.size).toBeGreaterThan(2)
  })
})

describe('createTapRest', () => {
  it('lets the pictures rest after five misses within ten seconds', () => {
    const rest = createTapRest()
    for (let t = 0; t < 4; t++) expect(rest.miss(t * 1000)).toBe(false)
    expect(rest.resting(4500)).toBe(false)
    expect(rest.miss(5000)).toBe(true)
    expect(rest.resting(5000 + REST_MS - 1)).toBe(true)
    expect(rest.resting(5000 + REST_MS)).toBe(false)
  })

  it('forgets misses older than ten seconds', () => {
    const rest = createTapRest()
    for (const t of [0, 3000, 6000, 9000]) rest.miss(t)
    // The first miss is now 10.5 s old: only four count
    expect(rest.miss(10_500)).toBe(false)
    expect(rest.resting(10_500)).toBe(false)
  })

  it('starts counting again after a rest', () => {
    const rest = createTapRest()
    for (let t = 0; t < 5; t++) rest.miss(t * 100)
    const after = 400 + REST_MS
    for (let i = 0; i < 4; i++) expect(rest.miss(after + i)).toBe(false)
    expect(rest.miss(after + 4)).toBe(true)
  })

  it('takes no misses while resting', () => {
    const rest = createTapRest()
    for (let t = 0; t < 5; t++) rest.miss(t)
    expect(rest.miss(10)).toBe(false)
    expect(rest.resting(10)).toBe(true)
  })
})
