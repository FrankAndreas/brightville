import * as THREE from 'three'
import type RAPIER from '@dimforge/rapier3d-compat'
import type { DoorDef } from './doors'

type Rapier = typeof RAPIER

/** Half the side of the square town, metres */
export const HALF_SIZE = 20
export const GRAVITY = 10
const WALL_HEIGHT = 1.2
// The real barrier is much taller than the wall you see, so no trampoline
// bounce carries anyone out of the world
const BARRIER_HEIGHT = 30

const COLORS = {
  sky: 0xbfe7ff,
  grass: 0xb8e6a3,
  path: 0xf6e7c1,
  wall: 0xfff4d6,
  houses: [0xffc8dd, 0xbde0fe, 0xfde4a8],
  roofs: [0xff8fab, 0x8ecae6, 0xf4a261],
  // One wall and roof colour per door building, in the order of the doors
  buildings: [[0xd9c8ff, 0xa58bf0], [0xbde0fe, 0x8ecae6], [0xffc8dd, 0xff8fab], [0xfde4a8, 0xf4a261]],
  leafOpen: 0x6b4a2b,
  leafClosed: 0x8a8a8a,
  doorOpen: 0xffd93d,
  doorClosed: 0xb8b8b8,
}

export interface DoorVisual {
  /** Pulses the glowing ring of an open door */
  update(timeS: number): void
  /** Repaints the door: glowing when open, grey when closed, with a lock when locked */
  setState(open: boolean, locked: boolean): void
}

function box(w: number, h: number, d: number, color: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.9 }))
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function staticBox(R: Rapier, world: RAPIER.World, x: number, y: number, z: number, w: number, h: number, d: number) {
  world.createCollider(R.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(x, y, z))
}

function house(
  R: Rapier, world: RAPIER.World, scene: THREE.Scene,
  x: number, z: number, w: number, h: number, d: number, color: number, roofColor: number,
): THREE.Group {
  const group = new THREE.Group()
  group.position.set(x, 0, z)
  const walls = box(w, h, d, color)
  walls.position.y = h / 2
  // A four-sided roof fitted to the walls with a small overhang
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(1, h * 0.6, 4),
    new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.9, flatShading: true }),
  )
  cone.rotation.y = Math.PI / 4
  cone.castShadow = true
  const roof = new THREE.Group()
  roof.add(cone)
  roof.position.y = h + h * 0.3
  roof.scale.set(w * 0.78, 1, d * 0.78)
  group.add(walls, roof)
  scene.add(group)
  staticBox(R, world, x, h / 2, z, w, h, d)
  return group
}

// A round sign with the building's picture, readable without words
function sign(icon: string): THREE.Mesh {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const g = canvas.getContext('2d')
  if (g) {
    g.fillStyle = '#ffffff'
    g.beginPath()
    g.arc(size / 2, size / 2, size / 2 - 6, 0, Math.PI * 2)
    g.fill()
    g.lineWidth = 12
    g.strokeStyle = '#a58bf0'
    g.stroke()
    g.font = `${size * 0.55}px sans-serif`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(icon, size / 2, size / 2 + 8)
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return new THREE.Mesh(
    new THREE.CircleGeometry(0.95, 40),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true }),
  )
}

/** The building behind a door: a larger house with a sign and a door that glows when open. */
function doorBuilding(R: Rapier, world: RAPIER.World, scene: THREE.Scene, door: DoorDef, index: number): DoorVisual {
  const depth = 5
  const frontZ = door.z - 1
  const [wall, roofColor] = COLORS.buildings[index % COLORS.buildings.length]
  const group = house(R, world, scene, door.x, frontZ - depth / 2, 8, 5, depth, wall, roofColor)

  const frame = box(2.2, 2.9, 0.2, COLORS.doorOpen)
  frame.position.set(0, 1.45, depth / 2 + 0.05)
  const leaf = box(1.7, 2.5, 0.22, COLORS.leafOpen)
  leaf.position.set(0, 1.25, depth / 2 + 0.07)
  group.add(frame, leaf)

  if (door.icon) {
    const board = sign(door.icon)
    board.position.set(0, 3.95, depth / 2 + 0.06)
    group.add(board)
  }
  const lock = sign('🔒')
  lock.scale.setScalar(0.75)
  lock.position.set(0, 1.5, depth / 2 + 0.2)
  group.add(lock)

  const ringMaterial = new THREE.MeshBasicMaterial({ color: COLORS.doorOpen, transparent: true })
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.25, 40), ringMaterial)
  ring.rotation.x = -Math.PI / 2
  ring.position.set(door.x, 0.03, door.z)
  scene.add(ring)

  let isOpen = true
  const paint = (mesh: THREE.Mesh, color: number) => (mesh.material as THREE.MeshStandardMaterial).color.setHex(color)

  function setState(open: boolean, locked: boolean) {
    isOpen = open
    paint(frame, open ? COLORS.doorOpen : COLORS.doorClosed)
    paint(leaf, open ? COLORS.leafOpen : COLORS.leafClosed)
    ringMaterial.color.setHex(open ? COLORS.doorOpen : COLORS.doorClosed)
    ringMaterial.opacity = open ? 0.9 : 0.5
    lock.visible = locked
    if (!open) ring.scale.set(1, 1, 1)
  }
  setState(door.open, door.locked ?? false)

  return {
    setState,
    update(timeS) {
      if (!isOpen) return
      const pulse = 1 + Math.sin(timeS * 3) * 0.08
      ring.scale.set(pulse, pulse, 1)
    },
  }
}

export interface Town {
  scene: THREE.Scene
  doorVisuals: DoorVisual[]
}

/** Builds the square: ground, walls, lights, scenery houses and one building per door. */
export function buildTown(R: Rapier, world: RAPIER.World, doors: DoorDef[]): Town {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(COLORS.sky)

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb8e6a3, 1.6))
  const sun = new THREE.DirectionalLight(0xfff2d6, 2.2)
  sun.position.set(14, 26, 12)
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  sun.shadow.radius = 6
  const cam = sun.shadow.camera
  cam.left = cam.bottom = -HALF_SIZE - 4
  cam.right = cam.top = HALF_SIZE + 4
  cam.near = 1
  cam.far = 80
  scene.add(sun)

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(HALF_SIZE * 2, HALF_SIZE * 2),
    new THREE.MeshStandardMaterial({ color: COLORS.grass, roughness: 1 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.receiveShadow = true
  scene.add(ground)
  staticBox(R, world, 0, -0.5, 0, HALF_SIZE * 2, 1, HALF_SIZE * 2)

  // A round plaza in the middle and paths to the doors
  const plaza = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.MeshStandardMaterial({ color: COLORS.path, roughness: 1 }))
  plaza.rotation.x = -Math.PI / 2
  plaza.position.y = 0.01
  plaza.receiveShadow = true
  scene.add(plaza)
  for (const door of doors) {
    const length = Math.hypot(door.x, door.z)
    const path = new THREE.Mesh(new THREE.PlaneGeometry(2.4, length), new THREE.MeshStandardMaterial({ color: COLORS.path, roughness: 1 }))
    path.rotation.x = -Math.PI / 2
    path.rotation.z = -Math.atan2(door.x, -door.z)
    path.position.set(door.x / 2, 0.012, door.z / 2)
    path.receiveShadow = true
    scene.add(path)
  }

  // Low wall you see, tall barrier you don't
  const sides: [number, number, number, number][] = [
    [0, -HALF_SIZE, HALF_SIZE * 2, 0.6], [0, HALF_SIZE, HALF_SIZE * 2, 0.6],
    [-HALF_SIZE, 0, 0.6, HALF_SIZE * 2], [HALF_SIZE, 0, 0.6, HALF_SIZE * 2],
  ]
  for (const [x, z, w, d] of sides) {
    const wall = box(w, WALL_HEIGHT, d, COLORS.wall)
    wall.position.set(x, WALL_HEIGHT / 2, z)
    scene.add(wall)
    staticBox(R, world, x, BARRIER_HEIGHT / 2, z, w, BARRIER_HEIGHT, d)
  }

  // Scenery
  house(R, world, scene, -13, -15.5, 6, 3.4, 5, COLORS.houses[0], COLORS.roofs[0])
  house(R, world, scene, 13, -15.5, 6, 3.8, 5, COLORS.houses[1], COLORS.roofs[1])
  house(R, world, scene, -15.5, 7, 5, 3.2, 6, COLORS.houses[2], COLORS.roofs[2])

  return { scene, doorVisuals: doors.map((door, i) => doorBuilding(R, world, scene, door, i)) }
}
