import type { DoorDef } from '@/city/doors'
import type { DeviceCaps } from '@/services/device'
import type { BuildingDef } from './types'
import YogaStudio from './yoga/YogaStudio.vue'

/** Every building in the town */
export const BUILDINGS: BuildingDef[] = [
  { id: 'yoga', spokenName: 'Yoga', icon: '🧘', needs: ['camera'], door: { x: 0, z: -14 }, component: YogaStudio },
]

export function canServe(building: BuildingDef, device: DeviceCaps): boolean {
  return building.needs.every(need => device[need])
}

/** The doors the town shows: one per building, closed when this device can't play it. */
export function toDoors(buildings: BuildingDef[], device: DeviceCaps): DoorDef[] {
  return buildings.map(b => ({ id: b.id, x: b.door.x, z: b.door.z, open: canServe(b, device), icon: b.icon }))
}
