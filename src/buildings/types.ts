import type { Component } from 'vue'
import type { DoorSpot } from '@/city/doors'

/** What a building needs to be playable: from the device, or films chosen by the parents */
export type Need = 'camera' | 'touch' | 'keyboard' | 'films'

/** What a building reports when the child leaves it */
export interface BuildingResult {
  stars: number
}

/**
 * A building in the town. The town only knows this description; the building's
 * component only knows it must emit `finished` with a BuildingResult.
 */
export interface BuildingDef {
  id: string
  /** German, spoken at the door */
  spokenName: string
  /** Picture on the sign and in the door prompt */
  icon: string
  /**
   * Earning buildings give Stars and count towards the daily goal; play buildings cost Stars;
   * free buildings (making things) are always open and neither give nor cost
   */
  kind: 'earn' | 'play' | 'free'
  /** Stars taken on entering a play building */
  cost?: number
  needs: Need[]
  door: DoorSpot
  component: Component
  /** A free building whose visits are not written into the logbook (the house itself) */
  unlogged?: boolean
  /** Fetches the building's code. Awaited before entering, so a failed download never costs Stars. */
  preload?: () => Promise<unknown>
}
