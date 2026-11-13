import { doorState, type DoorState } from '@/core/access'
import type { DoorDef } from '@/city/doors'
import type { DeviceCaps } from '@/services/device'

/** What the device can do, and what the town has: the Cinema needs films */
export type Capabilities = DeviceCaps & { films?: boolean }
import type { BuildingDef } from './types'
import { defineAsyncComponent } from 'vue'

// Each building's code is fetched on the first visit: the town doesn't need it to start
const school = () => import('./school/School.vue')
const schreiben = () => import('./schreiben/Schreiben.vue')
const yoga = () => import('./yoga/YogaStudio.vue')
const arcade = () => import('./arcade/Arcade.vue')
const ausmalen = () => import('./ausmalen/Ausmalen.vue')
const malen = () => import('./malen/Malen.vue')
const unterschiede = () => import('./unterschiede/Unterschiede.vue')
const bibliothek = () => import('./bibliothek/Bibliothek.vue')
const farblabor = () => import('./farblabor/Farblabor.vue')
const schlange = () => import('./schlange/Schlange.vue')
const bonbonjagd = () => import('./bonbonjagd/Bonbonjagd.vue')
const kino = () => import('./kino/Kino.vue')
const huepfhalle = () => import('./huepfhalle/Huepfhalle.vue')
const tanzsaal = () => import('./tanzsaal/Tanzsaal.vue')

/**
 * Every building in the town: learning at the back, making things and moving on the left, playing on the right.
 * A door's x and z are the spot in front of it; its house stands behind that, facing the middle.
 */
export const BUILDINGS: BuildingDef[] = [
  {
    id: 'school', spokenName: 'Schule', icon: '🔢', kind: 'earn', needs: [], door: { x: -25, z: -24 },
    component: defineAsyncComponent(school), preload: school,
  },
  {
    // Writing wants a finger or a pen on the glass; a mouse teaches nothing about it
    id: 'schreiben', spokenName: 'Schreiben', icon: '✏️', kind: 'earn', needs: ['touch'], door: { x: -15, z: -24 },
    component: defineAsyncComponent(schreiben), preload: schreiben,
  },
  {
    id: 'yoga', spokenName: 'Yoga', icon: '🧘', kind: 'earn', needs: ['camera'], door: { x: -5, z: -24 },
    component: defineAsyncComponent(yoga), preload: yoga,
  },
  {
    id: 'unterschiede', spokenName: 'Unterschiede', icon: '🔍', kind: 'earn', needs: [], door: { x: 5, z: -24 },
    component: defineAsyncComponent(unterschiede), preload: unterschiede,
  },
  {
    id: 'bibliothek', spokenName: 'Bibliothek', icon: '📚', kind: 'earn', needs: [], door: { x: 15, z: -24 },
    component: defineAsyncComponent(bibliothek), preload: bibliothek,
  },
  {
    id: 'farblabor', spokenName: 'Farblabor', icon: '🧪', kind: 'earn', needs: [], door: { x: 25, z: -24 },
    component: defineAsyncComponent(farblabor), preload: farblabor,
  },
  {
    id: 'ausmalen', spokenName: 'Ausmalen', icon: '🎨', kind: 'free', needs: [], door: { x: -23, z: -12, side: 'left' },
    component: defineAsyncComponent(ausmalen), preload: ausmalen,
  },
  {
    id: 'malen', spokenName: 'Malen', icon: '🖌️', kind: 'free', needs: [], door: { x: -23, z: -2, side: 'left' },
    component: defineAsyncComponent(malen), preload: malen,
  },
  {
    // Moving: the camera counts jumps and dance moves
    id: 'huepfhalle', spokenName: 'Hüpfhalle', icon: '🦘', kind: 'earn', needs: ['camera'], door: { x: -23, z: 8, side: 'left' },
    component: defineAsyncComponent(huepfhalle), preload: huepfhalle,
  },
  {
    id: 'tanzsaal', spokenName: 'Tanzsaal', icon: '🪩', kind: 'earn', needs: ['camera'], door: { x: -23, z: 18, side: 'left' },
    component: defineAsyncComponent(tanzsaal), preload: tanzsaal,
  },
  {
    id: 'arcade', spokenName: 'Spielhalle', icon: '🃏', kind: 'play', cost: 3, needs: [], door: { x: 23, z: -12, side: 'right' },
    component: defineAsyncComponent(arcade), preload: arcade,
  },
  {
    id: 'schlange', spokenName: 'Schlange', icon: '🐍', kind: 'play', cost: 3, needs: [], door: { x: 23, z: -2, side: 'right' },
    component: defineAsyncComponent(schlange), preload: schlange,
  },
  {
    id: 'bonbonjagd', spokenName: 'Bonbonjagd', icon: '🍬', kind: 'play', cost: 3, needs: [], door: { x: 23, z: 8, side: 'right' },
    component: defineAsyncComponent(bonbonjagd), preload: bonbonjagd,
  },
  {
    // Shown, but closed, until the parents chose films
    id: 'kino', spokenName: 'Kino', icon: '🎬', kind: 'play', cost: 3, needs: ['films'], door: { x: 23, z: 18, side: 'right' },
    component: defineAsyncComponent(kino), preload: kino,
  },
]

export function canServe(building: BuildingDef, device: Capabilities): boolean {
  return building.needs.every(need => device[need] === true)
}

/** What the door of this building is to the child right now. */
export function stateOf(
  building: BuildingDef, device: Capabilities, goalReached: boolean, stars: number, timeUp = false,
): DoorState {
  return doorState(building, canServe(building, device), goalReached, stars, timeUp)
}

/** The doors the town shows: one per building, open only when the child may walk in right now. */
export function toDoors(
  buildings: BuildingDef[], device: Capabilities, goalReached: boolean, stars: number, timeUp = false,
): DoorDef[] {
  return buildings.map(b => {
    const state = stateOf(b, device, goalReached, stars, timeUp)
    return {
      id: b.id, x: b.door.x, z: b.door.z, side: b.door.side ?? 'back',
      open: state === 'open', locked: state === 'locked', icon: b.icon,
    }
  })
}
