import { doorState, type DoorState } from '@/core/access'
import type { DoorDef } from '@/city/doors'
import type { DeviceCaps } from '@/services/device'
import type { BuildingDef } from './types'
import { defineAsyncComponent } from 'vue'

// Each building's code is fetched on the first visit: the town doesn't need it to start
const school = () => import('./school/School.vue')
const schreiben = () => import('./schreiben/Schreiben.vue')
const yoga = () => import('./yoga/YogaStudio.vue')
const arcade = () => import('./arcade/Arcade.vue')
const ausmalen = () => import('./ausmalen/Ausmalen.vue')
const malen = () => import('./malen/Malen.vue')

/**
 * Every building in the town: learning at the back, making things on the left, playing on the right.
 * A door's x and z are the spot in front of it; its house stands behind that, facing the middle.
 */
export const BUILDINGS: BuildingDef[] = [
  {
    id: 'school', spokenName: 'Schule', icon: '🔢', kind: 'earn', needs: [], door: { x: -15, z: -14 },
    component: defineAsyncComponent(school), preload: school,
  },
  {
    // Writing wants a finger or a pen on the glass; a mouse teaches nothing about it
    id: 'schreiben', spokenName: 'Schreiben', icon: '✏️', kind: 'earn', needs: ['touch'], door: { x: -5, z: -14 },
    component: defineAsyncComponent(schreiben), preload: schreiben,
  },
  {
    id: 'yoga', spokenName: 'Yoga', icon: '🧘', kind: 'earn', needs: ['camera'], door: { x: 5, z: -14 },
    component: defineAsyncComponent(yoga), preload: yoga,
  },
  {
    id: 'ausmalen', spokenName: 'Ausmalen', icon: '🎨', kind: 'free', needs: [], door: { x: -13, z: -6, side: 'left' },
    component: defineAsyncComponent(ausmalen), preload: ausmalen,
  },
  {
    id: 'malen', spokenName: 'Malen', icon: '🖌️', kind: 'free', needs: [], door: { x: -13, z: 4, side: 'left' },
    component: defineAsyncComponent(malen), preload: malen,
  },
  {
    id: 'arcade', spokenName: 'Spielhalle', icon: '🃏', kind: 'play', cost: 3, needs: [], door: { x: 13, z: -8, side: 'right' },
    component: defineAsyncComponent(arcade), preload: arcade,
  },
]

export function canServe(building: BuildingDef, device: DeviceCaps): boolean {
  return building.needs.every(need => device[need])
}

/** What the door of this building is to the child right now. */
export function stateOf(
  building: BuildingDef, device: DeviceCaps, goalReached: boolean, stars: number, timeUp = false,
): DoorState {
  return doorState(building, canServe(building, device), goalReached, stars, timeUp)
}

/** The doors the town shows: one per building, open only when the child may walk in right now. */
export function toDoors(
  buildings: BuildingDef[], device: DeviceCaps, goalReached: boolean, stars: number, timeUp = false,
): DoorDef[] {
  return buildings.map(b => {
    const state = stateOf(b, device, goalReached, stars, timeUp)
    return {
      id: b.id, x: b.door.x, z: b.door.z, side: b.door.side ?? 'back',
      open: state === 'open', locked: state === 'locked', icon: b.icon,
    }
  })
}
