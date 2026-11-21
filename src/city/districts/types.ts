import type { DoorSpot, Footprint } from '../doors'
import type { SceneryHouse, Street } from '../map'

export type DistrictId = 'town' | 'nature' | 'workshop'
export type StopId = 'platz' | 'bauernhof' | 'wald' | 'werkstatt'

/** A landmark on the map she can ride to, even before its district has a building: always open, no door */
export interface Stop {
  id: StopId
  icon: string
  x: number
  z: number
  /** The heading she faces on arrival (0 is towards +z, π/2 towards +x), looking at the landmark */
  face: number
  /** What the voice says when the ride starts */
  line: string
}

/** A part of the town: the old square, or one of the districts joined onto it */
export interface District {
  id: DistrictId
  /** Rectangles that never overlap; the town's outline is the union of all districts' areas */
  areas: Footprint[]
  /** Its colour on the map (0xRRGGBB) */
  ground: number
  /** Its own streets (the old town's are STREETS) */
  streets: Street[]
  scenery: SceneryHouse[]
  /** Lots kept for buildings still to come: a garden until then */
  lots: { use: 'nmg' | 'beebot' | 'spare'; spot: DoorSpot }[]
  /** The nature district has two: the farm and the forest */
  stops: Stop[]
  /** The gap in the hedge to the old town, where its avenue goes through */
  gate?: { x: number; z: number; width: number }
}
