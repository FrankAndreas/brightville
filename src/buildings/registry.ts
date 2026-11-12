import { doorState, type DoorState } from '@/core/access'
import type { DoorDef } from '@/city/doors'
import type { DeviceCaps } from '@/services/device'
import type { BuildingDef } from './types'
import { defineAsyncComponent } from 'vue'

/** Every building in the town */
export const BUILDINGS: BuildingDef[] = [
  {
    id: 'yoga', spokenName: 'Yoga', icon: '🧘', kind: 'earn', needs: ['camera'], door: { x: 0, z: -14 },
    // Loaded on first visit: the body tracking is large and the town doesn't need it
    component: defineAsyncComponent(() => import('./yoga/YogaStudio.vue')),
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
