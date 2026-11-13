import * as THREE from 'three'
import type { Dress, Glasses, HairStyle } from '@/core/look'
import { outfitDef } from '@/core/outfits'

// Her hair, her glasses and her add-ons, built from simple shapes in the blob's own space (blob.ts): the body is a
// sphere of radius 0.5, stretched to 1.15 in height, centred at y 0.62; the eyes look out along +z at y 0.82.
// Everything is hung on the blob's leaning group, so it wobbles along.

const BODY_Y = 0.62
const BODY_R = 0.5
const STRETCH = 1.15
const TOP = BODY_Y + BODY_R * STRETCH
const EYE_Y = 0.82

export interface Parts {
  body: number
  limbs: number
  head: THREE.Object3D[]
  face: THREE.Object3D[]
  neck: THREE.Object3D[]
  torso: THREE.Object3D[]
  back: THREE.Object3D[]
}

const material = (color: number | string, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...extra })

function mesh(geometry: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geometry, mat)
  m.position.set(x, y, z)
  m.castShadow = true
  return m
}

/** A shell just over the body between two heights (0 the top of the head, π the feet), like a piece of clothing */
function shell(mat: THREE.Material, from: number, to: number, grow = 0.012): THREE.Mesh {
  const m = mesh(new THREE.SphereGeometry(BODY_R + grow, 32, 16, 0, Math.PI * 2, from, to - from), mat, 0, BODY_Y, 0)
  m.scale.set(1, STRETCH, 1)
  return m
}

/** A ring around the body at a height, lying flat */
function ring(mat: THREE.Material, y: number, tube: number, grow = 0.02): THREE.Mesh {
  const rel = (y - BODY_Y) / (BODY_R * STRETCH)
  const radius = BODY_R * Math.sqrt(Math.max(0, 1 - rel * rel)) + grow
  const m = mesh(new THREE.TorusGeometry(radius, tube, 10, 32), mat, 0, y, 0)
  m.rotation.x = Math.PI / 2
  return m
}

function starShape(outer: number, inner: number): THREE.Shape {
  const s = new THREE.Shape()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer
    const a = Math.PI / 2 + (i * Math.PI) / 5
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r)
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r)
  }
  return s
}

function heartShape(size: number): THREE.Shape {
  const s = new THREE.Shape()
  s.moveTo(0, -size)
  s.bezierCurveTo(size * 1.4, -size * 0.1, size * 0.8, size * 1.1, 0, size * 0.4)
  s.bezierCurveTo(-size * 0.8, size * 1.1, -size * 1.4, -size * 0.1, 0, -size)
  return s
}

const flat = (shape: THREE.Shape) => new THREE.ExtrudeGeometry(shape, { depth: 0.02, bevelEnabled: false })

function hair(style: HairStyle, color: string): THREE.Object3D[] {
  const mat = material(color, { roughness: 0.8 })
  const cap = () => shell(mat, 0, Math.PI * 0.3, 0.02)
  switch (style) {
    case 'none':
      return []
    case 'spiky':
      return [cap(), ...[-0.24, -0.08, 0.08, 0.24].flatMap((x, i) => {
        const spike = mesh(new THREE.ConeGeometry(0.07, 0.22, 8), mat, x, TOP - 0.02 - Math.abs(x) * 0.25, -0.05 + (i % 2) * 0.06)
        spike.rotation.z = -x * 1.2
        return [spike]
      })]
    case 'ponytail': {
      const tail = mesh(new THREE.CapsuleGeometry(0.07, 0.3, 6, 10), mat, 0, TOP - 0.25, -0.47)
      tail.rotation.x = 0.35
      return [cap(), mesh(new THREE.SphereGeometry(0.08, 12, 10), mat, 0, TOP - 0.1, -0.4), tail]
    }
    case 'buns':
      return [cap(), ...[-1, 1].map(side => mesh(new THREE.SphereGeometry(0.13, 16, 12), mat, side * 0.27, TOP - 0.05, -0.05))]
    case 'curly':
      return Array.from({ length: 11 }, (_, i) => {
        const a = (i / 11) * Math.PI * 2
        return mesh(new THREE.SphereGeometry(0.09, 12, 10), mat, Math.cos(a) * 0.3, TOP - 0.1 + (i % 2) * 0.04, Math.sin(a) * 0.3 - 0.04)
      })
  }
}

function glasses(kind: Glasses): THREE.Object3D[] {
  if (kind === 'none') return []
  const frame = material(kind === 'round' ? 0x333333 : kind === 'star' ? 0xf2c230 : 0xe8457a, { roughness: 0.4 })
  const lenses = [-1, 1].map(side => {
    const x = side * 0.19
    if (kind === 'round') return mesh(new THREE.TorusGeometry(0.15, 0.022, 8, 24), frame, x, EYE_Y, 0.53)
    const shape = kind === 'star' ? starShape(0.19, 0.09) : heartShape(0.15)
    const inner = kind === 'star' ? starShape(0.14, 0.065) : heartShape(0.11)
    shape.holes.push(new THREE.Path(inner.getPoints()))
    return mesh(flat(shape), frame, x, EYE_Y, 0.52)
  })
  const bridge = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 6), frame, 0, EYE_Y + 0.02, 0.55)
  bridge.rotation.z = Math.PI / 2
  return [...lenses, bridge]
}

/** Each add-on of shared/outfits.json, by id */
const BUILD: Record<string, () => THREE.Object3D[]> = {
  // Head
  schleife: () => {
    const red = material(0xe8457a)
    const loops = [-1, 1].map(side => {
      const c = mesh(new THREE.ConeGeometry(0.1, 0.18, 12), red, side * 0.1, TOP + 0.02, 0.05)
      c.rotation.z = side * Math.PI / 2
      return c
    })
    return [...loops, mesh(new THREE.SphereGeometry(0.05, 10, 8), red, 0, TOP + 0.02, 0.05)]
  },
  kappe: () => {
    const blue = material(0x3a7bd5)
    const top = mesh(new THREE.SphereGeometry(0.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), blue, 0, TOP - 0.16, 0)
    const brim = mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.03, 20, 1, false, -Math.PI / 2, Math.PI), blue, 0, TOP - 0.15, 0.3)
    return [top, brim]
  },
  blumenkranz: () => {
    const green = material(0x4bd37b)
    const colors = [0xff8fc8, 0xffd93d, 0xffffff, 0xa58bf0]
    return [ring(green, TOP - 0.12, 0.025, 0.04), ...Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2
      return mesh(new THREE.SphereGeometry(0.055, 10, 8), material(colors[i % 4]), Math.cos(a) * 0.36, TOP - 0.1, Math.sin(a) * 0.36)
    })]
  },
  zylinder: () => {
    const black = material(0x222222)
    return [mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 24), black, 0, TOP - 0.06, 0),
      mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.4, 24), black, 0, TOP + 0.15, 0),
      mesh(new THREE.CylinderGeometry(0.265, 0.265, 0.06, 24), material(0xe8457a), 0, TOP + 0.02, 0)]
  },
  krone: () => {
    const gold = material(0xf2c230, { metalness: 0.6, roughness: 0.3 })
    const band = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 24, 1, true), gold, 0, TOP - 0.02, 0)
    const points = Array.from({ length: 5 }, (_, i) => {
      const a = (i / 5) * Math.PI * 2 + Math.PI / 2
      return mesh(new THREE.ConeGeometry(0.06, 0.14, 8), gold, Math.cos(a) * 0.3, TOP + 0.1, Math.sin(a) * 0.3)
    })
    return [band, ...points, mesh(new THREE.SphereGeometry(0.04, 10, 8), material(0xe8457a), 0, TOP + 0.01, 0.31)]
  },
  einhornmuetze: () => {
    const white = material(0xffffff)
    const horn = mesh(new THREE.ConeGeometry(0.06, 0.3, 12), material(0xf2c230), 0, TOP + 0.16, 0.12)
    horn.rotation.x = 0.3
    const ears = [-1, 1].map(side => mesh(new THREE.ConeGeometry(0.06, 0.14, 8), white, side * 0.22, TOP + 0.02, -0.02))
    return [shell(white, 0, Math.PI * 0.32, 0.03), horn, ...ears]
  },
  glitzerband: () => {
    const band = ring(material(0xa58bf0, { metalness: 0.5, roughness: 0.3 }), TOP - 0.2, 0.03)
    const sparkles = [-0.2, 0, 0.2].map(x => mesh(flat(starShape(0.06, 0.025)), material(0xffd93d, { emissive: 0x806000 }), x, TOP - 0.14, 0.4))
    return [band, ...sparkles]
  },
  yogaband: () => [ring(material(0x4bd37b), TOP - 0.2, 0.035)],
  // Neck
  schal: () => {
    const red = material(0xe8457a, { roughness: 0.9 })
    const end = mesh(new THREE.BoxGeometry(0.1, 0.25, 0.04), red, 0.15, 0.38, 0.47)
    end.rotation.z = 0.15
    return [ring(red, 0.48, 0.06), end]
  },
  perlenkette: () => {
    const pearl = material(0xfaf7f0, { roughness: 0.2, metalness: 0.2 })
    return Array.from({ length: 14 }, (_, i) => {
      const a = -Math.PI * 0.15 + (i / 13) * Math.PI * 1.3
      return mesh(new THREE.SphereGeometry(0.035, 10, 8), pearl, Math.cos(a) * 0.49, 0.5 - Math.sin(a) * 0.06, Math.sin(a) * 0.49)
    })
  },
  discokette: () => [ring(material(0xcccccc, { metalness: 0.8 }), 0.5, 0.015),
    mesh(new THREE.IcosahedronGeometry(0.09, 1), material(0xdddddd, { metalness: 0.9, roughness: 0.15, flatShading: true }), 0, 0.4, 0.5)],
  medaille: () => {
    const disc = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 20), material(0xf2c230, { metalness: 0.7, roughness: 0.3 }), 0, 0.36, 0.52)
    disc.rotation.x = Math.PI / 2
    return [ring(material(0x3a7bd5), 0.5, 0.02), disc]
  },
  // Body
  tshirt: () => [shell(material(0x4f8fe8, { roughness: 0.9 }), Math.PI * 0.48, Math.PI * 0.78)],
  kleid: () => {
    const pink = material(0xff8fc8, { roughness: 0.8 })
    return [shell(pink, Math.PI * 0.5, Math.PI * 0.7), mesh(new THREE.CylinderGeometry(0.46, 0.6, 0.3, 24, 1, true), pink, 0, 0.18, 0)]
  },
  ballettkleid: () => {
    const rose = material(0xffc6e0, { roughness: 0.9, side: THREE.DoubleSide })
    const tutu = mesh(new THREE.RingGeometry(0.45, 0.72, 32), rose, 0, 0.36, 0)
    tutu.rotation.x = -Math.PI / 2
    return [shell(material(0xffc6e0), Math.PI * 0.45, Math.PI * 0.62), tutu]
  },
  astronaut: () => {
    const white = material(0xf4f4f4, { roughness: 0.6 })
    const pack = mesh(new THREE.BoxGeometry(0.4, 0.4, 0.14), white, 0, 0.6, -0.55)
    return [shell(white, Math.PI * 0.4, Math.PI * 0.85, 0.02), mesh(new THREE.BoxGeometry(0.14, 0.09, 0.02), material(0xe8457a), 0.16, 0.6, 0.5), pack]
  },
  // Back
  rucksack: () => {
    const green = material(0x4bd37b)
    return [mesh(new THREE.BoxGeometry(0.42, 0.45, 0.2), green, 0, 0.58, -0.55), mesh(new THREE.BoxGeometry(0.3, 0.15, 0.06), material(0x2f9e5b), 0, 0.48, -0.67)]
  },
  umhang: () => {
    const cape = mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.95, 24, 1, true, Math.PI * 0.55, Math.PI * 0.9),
      material(0xd62828, { side: THREE.DoubleSide, roughness: 0.8 }), 0, 0.52, 0)
    return [cape]
  },
  feenfluegel: () => {
    const wing = material(0xbde0fe, { transparent: true, opacity: 0.75, side: THREE.DoubleSide, roughness: 0.2 })
    return [-1, 1].flatMap(side => [0, 1].map(lower => {
      const w = mesh(new THREE.CircleGeometry(lower ? 0.22 : 0.32, 24), wing, side * (lower ? 0.25 : 0.32), lower ? 0.45 : 0.82, -0.55)
      w.scale.set(1, lower ? 0.8 : 1.3, 1)
      w.rotation.z = side * (lower ? -0.4 : 0.5)
      w.rotation.y = side * 0.45
      return w
    }))
  },
}

const PLACE_GROUP = { head: 'head', neck: 'neck', body: 'torso', back: 'back' } as const

/** The body and limb colours and every part her dress needs, sorted by where it goes. Unknown add-ons are skipped. */
export function dressParts(dress: Dress): Parts {
  const body = new THREE.Color(dress.look.body)
  const limbs = body.clone().multiplyScalar(0.92)
  const parts: Parts = {
    body: body.getHex(),
    limbs: limbs.getHex(),
    head: hair(dress.look.hair, dress.look.hairColor),
    face: glasses(dress.look.glasses),
    neck: [],
    torso: [],
    back: [],
  }
  for (const [place, id] of Object.entries(dress.worn)) {
    const def = id ? outfitDef(id) : undefined
    const build = def && def.place === place ? BUILD[def.id] : undefined
    if (build) parts[PLACE_GROUP[def!.place]].push(...build())
  }
  return parts
}
