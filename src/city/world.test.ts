// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from 'vitest'
import RAPIER from '@dimforge/rapier3d-compat'
import * as THREE from 'three'
import { BUILDINGS, toDoors } from '@/buildings/registry'
import { createCharacter } from './character'
import { HILLS, LAKE, TOWN_HALF, heightAt, inLake, solidAreas } from './map'
import { createFollowCamera } from './followCamera'
import { TRAMPOLINES } from './props'
import { BUILDING_LOOKS, GRAVITY, buildTown, cameraBlocker, disposeScene, lookOf } from './world'

describe('the town', () => {
  beforeAll(() => RAPIER.init())

  it('rests her on a hill at the height of the ground there', () => {
    for (const hill of HILLS) {
      const world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 })
      buildTown(RAPIER, world, [])
      // A little off the top, so a mirrored heightfield would show
      const x = hill.x + hill.radius / 3
      const z = hill.z - hill.radius / 4
      const character = createCharacter(RAPIER, world, { x, z }, TRAMPOLINES)
      world.timestep = 1 / 60
      let f = character.step({ moveX: 0, moveZ: 0, jump: false }, 1 / 60)
      for (let i = 0; i < 120; i++) {
        f = character.step({ moveX: 0, moveZ: 0, jump: false }, 1 / 60)
        world.step()
      }
      expect(f.y - 0.6, `hill at ${hill.x},${hill.z}`).toBeCloseTo(heightAt(x, z), 0)
      expect(Math.abs(f.y - 0.6 - heightAt(x, z))).toBeLessThan(0.15)
    }
  })
})

describe('the door buildings', () => {
  beforeAll(() => RAPIER.init())

  const OLD_WALLS = [0xd9c8ff, 0xfde4a8, 0xbde0fe, 0xc8f0d0, 0xf3dfc1, 0xd6ecff, 0xfff1b8, 0xcdeeea, 0xffc8dd, 0xe5d4ff, 0xffd6e8, 0x3d3d5c]
  const hue = (hex: number) => new THREE.Color(hex).getHSL({ h: 0, s: 0, l: 0 }).h * 360

  it('gives every door building its own colour pair, close to the one it had', () => {
    expect(Object.keys(BUILDING_LOOKS).sort()).toEqual(BUILDINGS.map(b => b.id).sort())
    expect(new Set(Object.values(BUILDING_LOOKS).map(l => `${l.wall}/${l.roof}`)).size).toBe(BUILDINGS.length)
    BUILDINGS.forEach((b, i) => {
      const d = Math.abs(hue(lookOf(b.id).wall) - hue(OLD_WALLS[i % OLD_WALLS.length]))
      expect(Math.min(d, 360 - d), b.id).toBeLessThanOrEqual(40)
    })
  })

  it('keeps each building\'s colour when another is left out: the colour belongs to the building, not its place in the list', () => {
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) })
    const doors = toDoors(BUILDINGS.slice(1), { camera: true, touch: true, keyboard: true, films: true }, true, 10)
    const { scene } = buildTown(RAPIER, new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 }), doors)
    vi.unstubAllGlobals()
    // The houses are merged into big meshes, each part's colour kept per vertex
    const second = doors[0]
    const want = new THREE.Color(lookOf(second.id).wall)
    let near = 0
    scene.traverse(o => {
      const m = o as THREE.Mesh
      const colour = m.isMesh ? m.geometry.getAttribute('color') : undefined
      if (!colour) return
      const pos = m.geometry.getAttribute('position')
      const at = new THREE.Vector3()
      for (let i = 0; i < pos.count; i++) {
        at.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld)
        const same = Math.abs(colour.getX(i) - want.r) + Math.abs(colour.getY(i) - want.g) + Math.abs(colour.getZ(i) - want.b) < 1e-3
        if (same && Math.hypot(at.x - second.x, at.z - second.z) < 12) near++
      }
    })
    expect(near, second.id).toBeGreaterThan(0)
  })

  it('gives a building not in the list a colour of its own instead of failing', () => {
    expect(lookOf('noch-nicht-da')).toMatchObject({ wall: expect.any(Number), roof: expect.any(Number) })
  })

  it('shows each sign as a picture above its door, seen from every side', () => {
    // No drawing here: a canvas without a context leaves the sign blank
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) })
    const doors = toDoors(BUILDINGS, { camera: true, touch: true, keyboard: true, films: true }, true, 10)
    const { scene } = buildTown(RAPIER, new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 }), doors)
    const sprites: THREE.Sprite[] = []
    scene.traverse(o => { if ((o as THREE.Sprite).isSprite) sprites.push(o as THREE.Sprite) })
    expect(sprites).toHaveLength(doors.length)
    for (const door of doors) {
      const sign = sprites.find(s => Math.hypot(s.position.x - door.x, s.position.z - door.z) <= 1)
      expect(sign, door.id).toBeDefined()
      expect(sign!.position.y, door.id).toBeGreaterThan(5)
    }
    vi.unstubAllGlobals()
  })
})

describe('what the camera sees through', () => {
  beforeAll(() => RAPIER.init())

  function town() {
    const world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 })
    const doors = toDoors(BUILDINGS, { camera: true, touch: true, keyboard: true, films: true }, true, 10)
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) })
    const built = buildTown(RAPIER, world, doors)
    vi.unstubAllGlobals()
    world.step()
    return { world, built, blocked: cameraBlocker(RAPIER, world) }
  }

  it('is stopped by a house and by a hill', () => {
    const { blocked } = town()
    // Through the school, from the street to behind it
    const school = BUILDINGS.find(b => b.id === 'school')!.door
    const d = blocked({ x: school.x - 1, y: 2, z: school.z }, { x: school.x + 9, y: 2, z: school.z })
    expect(d).not.toBeNull()
    expect(d!).toBeGreaterThan(1)
    expect(d!).toBeLessThan(3)
    const hill = [...HILLS].sort((a, b) => b.height - a.height)[0]
    expect(blocked({ x: hill.x - hill.radius - 2, y: 1, z: hill.z }, { x: hill.x, y: 1, z: hill.z })).not.toBeNull()
  })

  it('is stopped by a roof too, but she still can\'t stand on one', () => {
    const { blocked, world } = town()
    const school = BUILDINGS.find(b => b.id === 'school')!.door
    // Above the walls (5 m), through the roof
    expect(blocked({ x: school.x - 1, y: 6.5, z: school.z }, { x: school.x + 9, y: 6.5, z: school.z })).not.toBeNull()
    // Nothing solid up there: a ball dropped onto the roof falls through to the wall's top
    const ball = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(school.x + 3.5, 7.5, school.z))
    world.createCollider(RAPIER.ColliderDesc.ball(0.3), ball)
    for (let i = 0; i < 120; i++) world.step()
    expect(ball.translation().y).toBeLessThan(5.5)
  })

  it('looks through the invisible walls round the lake and the town', () => {
    const { blocked } = town()
    expect(blocked({ x: LAKE.x, y: 2, z: LAKE.z + LAKE.rz + 3 }, { x: LAKE.x, y: 2, z: LAKE.z })).toBeNull()
    expect(blocked({ x: 0, y: 3, z: TOWN_HALF - 3 }, { x: 0, y: 3, z: TOWN_HALF + 5 })).toBeNull()
  })

  it('moves the shadows only in whole texels as the sun sees them, so their edges don\'t shimmer', () => {
    const { built } = town()
    const texel = (22 * 2) / 2048
    for (const [x, z] of [[3.21, -7.77], [-40.05, 12.3], [0.004, 0.009], [17.5, 33.3]]) {
      built.followSun(x, z)
      const t = built.sun.target.position
      const forward = t.clone().sub(built.sun.position).normalize()
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()
      const up = new THREE.Vector3().crossVectors(right, forward)
      for (const axis of [right, up]) {
        const steps = t.dot(axis) / texel
        expect(Math.abs(steps - Math.round(steps)), `${x},${z}`).toBeLessThan(1e-3)
      }
      // Still where she is, give or take a texel or two
      expect(Math.hypot(t.x - x, t.z - z)).toBeLessThan(texel * 3)
    }
  })

  it('moves the sun\'s shadows with her', () => {
    const { built } = town()
    built.followSun(30, -20)
    expect(built.sun.target.position.x).toBeCloseTo(30, 0)
    expect(built.sun.target.position.z).toBeCloseTo(-20, 0)
    expect(built.sun.position.x - built.sun.target.position.x).toBeCloseTo(14, 0)
  })
})

describe('the camera in the real town', () => {
  beforeAll(() => RAPIER.init())

  it('sees her from everywhere she can walk, in every direction the view turns', () => {
    const world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 })
    const doors = toDoors(BUILDINGS, { camera: true, touch: true, keyboard: true, films: true }, true, 10)
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) })
    const { scene } = buildTown(RAPIER, world, doors)
    vi.unstubAllGlobals()
    world.step()
    scene.updateMatrixWorld(true)
    const blocked = cameraBlocker(RAPIER, world)
    const solid = solidAreas(doors).map(f => ({ minX: f.minX - 0.5, maxX: f.maxX + 0.5, minZ: f.minZ - 0.5, maxZ: f.maxZ + 0.5 }))
    // Houses, roofs and doors: what could stand between the camera and her
    const walls: THREE.Object3D[] = []
    scene.traverse(o => {
      const mesh = o as THREE.Mesh
      const type = mesh.geometry?.type
      // Door frames and leaves are boxes; the houses are merged boxes, coloured by their corners. Trees (instanced)
      // may cover her for a moment: the camera doesn't dodge them, so it doesn't jump at every tree
      const merged = (mesh.material as THREE.MeshStandardMaterial | undefined)?.vertexColors === true
      if (((type === 'BoxGeometry' && !(o as THREE.InstancedMesh).isInstancedMesh)) || merged) walls.push(o)
    })
    expect(walls.length).toBeGreaterThan(20)
    const ray = new THREE.Raycaster()
    const hidden: string[] = []
    // Off the whole metres, where walls stand: a ray grazing a wall exactly is no cover
    for (let x = -TOWN_HALF + 3.3; x <= TOWN_HALF - 3; x += 4) {
      for (let z = -TOWN_HALF + 3.3; z <= TOWN_HALF - 3; z += 4) {
        if (inLake(x, z) || solid.some(f => x >= f.minX && x <= f.maxX && z >= f.minZ && z <= f.maxZ)) continue
        const y = heightAt(x, z) + 0.6
        for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
          const view = createFollowCamera()
          view.follow({ x, y, z, grounded: true }, 0, true, yaw, blocked)
          const her = new THREE.Vector3(x, y + 0.4, z)
          const from = view.camera.position.clone()
          const length = from.distanceTo(her)
          ray.set(from, her.clone().sub(from).normalize())
          ray.far = length - 0.3
          const hits = ray.intersectObjects(walls, false)
          if (hits.length) hidden.push(`${x},${z} yaw ${yaw.toFixed(2)} cam ${from.toArray().map(v => v.toFixed(1))} hit ${(hits[0].object as THREE.Mesh).geometry.type} at ${hits[0].point.toArray().map(v => v.toFixed(1))} d ${hits[0].distance.toFixed(1)}/${length.toFixed(1)}`)
        }
      }
    }
    expect(hidden).toEqual([])
  })
})

describe('freeing the town', () => {
  beforeAll(() => RAPIER.init())

  it('dispose frees every geometry, material and texture', () => {
    const world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 })
    const doors = toDoors(BUILDINGS, { camera: true, touch: true, keyboard: true, films: true }, true, 10)
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) })
    const { scene } = buildTown(RAPIER, world, doors)
    vi.unstubAllGlobals()
    const geometries = new Set<THREE.BufferGeometry>()
    const materials = new Set<THREE.Material>()
    const textures = new Set<THREE.Texture>()
    scene.traverse(o => {
      const mesh = o as THREE.Mesh
      if (mesh.geometry) geometries.add(mesh.geometry)
      for (const m of [mesh.material].flat()) if (m) materials.add(m as THREE.Material)
      for (const t of (o.userData.textures as THREE.Texture[] | undefined) ?? []) textures.add(t)
    })
    const freed = new Set<unknown>()
    const spy = function (this: unknown) { freed.add(this) }
    vi.spyOn(THREE.BufferGeometry.prototype, 'dispose').mockImplementation(spy)
    vi.spyOn(THREE.Material.prototype, 'dispose').mockImplementation(spy)
    vi.spyOn(THREE.Texture.prototype, 'dispose').mockImplementation(spy)
    const instanced: THREE.InstancedMesh[] = []
    scene.traverse(o => { if ((o as THREE.InstancedMesh).isInstancedMesh) instanced.push(o as THREE.InstancedMesh) })
    expect(instanced.length).toBeGreaterThan(5)
    // Their matrices and colours live in buffers of their own, freed only by the mesh's dispose
    vi.spyOn(THREE.InstancedMesh.prototype, 'dispose').mockImplementation(spy)
    disposeScene(scene)
    expect(instanced.filter(m => !freed.has(m))).toHaveLength(0)
    expect([...geometries].filter(g => !freed.has(g))).toHaveLength(0)
    expect([...materials].filter(m => !freed.has(m))).toHaveLength(0)
    expect(textures.size).toBe(doors.length * 2)
    expect([...textures].filter(t => !freed.has(t))).toHaveLength(0)
  })

  it('draws the houses in a few merged pieces', () => {
    const world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 })
    const doors = toDoors(BUILDINGS, { camera: true, touch: true, keyboard: true, films: true }, true, 10)
    vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) })
    const { scene } = buildTown(RAPIER, world, doors)
    vi.unstubAllGlobals()
    let meshes = 0
    scene.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes++ })
    // Each door keeps its frame, leaf and ring; the houses are merged
    expect(meshes).toBeLessThan(doors.length * 3 + 80)
  })
})
