import type { Component } from 'vue'

/** What a building needs from the device to be playable */
export type Need = 'camera' | 'touch' | 'keyboard'

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
  /** Earning buildings give Stars and count towards the daily goal; play buildings cost Stars */
  kind: 'earn' | 'play'
  /** Stars taken on entering a play building */
  cost?: number
  needs: Need[]
  door: { x: number; z: number }
  component: Component
}
