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

/** Every building in the town */
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
    id: 'arcade', spokenName: 'Spielhalle', icon: '🃏', kind: 'play', cost: 3, needs: [], door: { x: 15, z: -14 },
    component: defineAsyncComponent(arcade), preload: arcade,
  },
]

export function canServe(building: BuildingDef, device: DeviceCaps): boolean {
  return building.needs.every(need => device[need])
}

/** What the door of this building is to the child right now. */
export function stateOf(building: BuildingDef, device: DeviceCaps, goalReached: boolean, stars: number): DoorState {
  return doorState(building, canServe(building, device), goalReached, stars)
}

/** The doors the town shows: one per building, open only when the child may walk in right now. */
export function toDoors(buildings: BuildingDef[], device: DeviceCaps, goalReached: boolean, stars: number): DoorDef[] {
  return buildings.map(b => {
    const state = stateOf(b, device, goalReached, stars)
    return { id: b.id, x: b.door.x, z: b.door.z, open: state === 'open', locked: state === 'locked', icon: b.icon }
  })
}
