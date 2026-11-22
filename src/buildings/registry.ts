import { doorState, type DoorState, type Level } from '@/core/access'
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
const haus = () => import('./haus/Haus.vue')
const laden = () => import('./laden/Laden.vue')
const moebel = () => import('./moebel/Moebelhaus.vue')
const flatterflug = () => import('./flatterflug/Flatterflug.vue')
const reimhaus = () => import('./reimhaus/Reimhaus.vue')
const muster = () => import('./muster/Musterwerkstatt.vue')
const kalender = () => import('./kalender/Kalender.vue')
const spielwelt = () => import('./spielwelt/Spielwelt.vue')
const trommelhaus = () => import('./trommelhaus/Trommelhaus.vue')
const vokabeln = () => import('./vokabeln/Vokabeln.vue')

/**
 * Every building in the town, mixed along the streets of `src/city/map.ts` so every walk passes learning, playing and
 * shops; her own house is by the plaza where she starts. A door's x and z are the spot in front of it, on the street's
 * edge; its house stands behind that on `side`, facing the street.
 */
export const BUILDINGS: BuildingDef[] = [
  {
    id: 'school', spokenName: 'Schule', toName: 'zur Schule', icon: '🔢', kind: 'earn', needs: [], door: { x: 3.5, z: -13, side: 'right' },
    component: defineAsyncComponent(school), preload: school,
    oberstufe: { component: defineAsyncComponent(vokabeln), preload: vokabeln },
  },
  {
    // Writing wants a finger or a pen on the glass; a mouse teaches nothing about it
    id: 'schreiben', spokenName: 'Schreiben', toName: 'zum Schreiben', icon: '✏️', kind: 'earn', needs: ['touch'], door: { x: -24.5, z: 3.5, side: 'front' },
    component: defineAsyncComponent(schreiben), preload: schreiben,
  },
  {
    id: 'yoga', spokenName: 'Yoga', toName: 'zum Yoga', icon: '🧘', kind: 'earn', needs: ['camera'], door: { x: -3.5, z: 40, side: 'left' },
    component: defineAsyncComponent(yoga), preload: yoga,
  },
  {
    id: 'unterschiede', spokenName: 'Unterschiede', toName: 'zu den Unterschieden', icon: '🔍', kind: 'earn', needs: [], door: { x: -15, z: 3.5, side: 'front' },
    component: defineAsyncComponent(unterschiede), preload: unterschiede,
  },
  {
    id: 'bibliothek', spokenName: 'Bibliothek', toName: 'zur Bibliothek', icon: '📚', kind: 'earn', needs: [], door: { x: -3.5, z: -24, side: 'left' },
    component: defineAsyncComponent(bibliothek), preload: bibliothek,
  },
  {
    id: 'farblabor', spokenName: 'Farblabor', toName: 'zum Farblabor', icon: '🧪', kind: 'earn', needs: [], door: { x: 15, z: -3.5 },
    component: defineAsyncComponent(farblabor), preload: farblabor,
  },
  {
    id: 'ausmalen', spokenName: 'Ausmalen', toName: 'zum Ausmalen', icon: '🎨', kind: 'free', needs: [], door: { x: -15, z: -3.5 },
    component: defineAsyncComponent(ausmalen), preload: ausmalen,
  },
  {
    id: 'malen', spokenName: 'Malen', toName: 'zum Malen', icon: '🖌️', kind: 'free', needs: [], door: { x: -16, z: 28.5 },
    component: defineAsyncComponent(malen), preload: malen,

    oberstufe: {},
  },
  {
    // Moving: the camera counts jumps and dance moves
    id: 'huepfhalle', spokenName: 'Hüpfhalle', toName: 'zur Hüpfhalle', icon: '🦘', kind: 'earn', needs: ['camera'], door: { x: -40, z: 3.5, side: 'front' },
    component: defineAsyncComponent(huepfhalle), preload: huepfhalle,
  },
  {
    id: 'tanzsaal', spokenName: 'Tanzsaal', toName: 'zum Tanzsaal', icon: '🪩', kind: 'earn', needs: ['camera'], door: { x: 40, z: -3.5 },
    component: defineAsyncComponent(tanzsaal), preload: tanzsaal,
  },
  {
    id: 'arcade', spokenName: 'Spielhalle', toName: 'zur Spielhalle', icon: '🃏', kind: 'play', cost: 3, needs: [], door: { x: -3.5, z: -13, side: 'left' },
    component: defineAsyncComponent(arcade), preload: arcade,
  },
  {
    id: 'schlange', spokenName: 'Schlange', toName: 'zur Schlange', icon: '🐍', kind: 'play', cost: 3, needs: [], door: { x: -40, z: -3.5 },
    component: defineAsyncComponent(schlange), preload: schlange,
  },
  {
    id: 'bonbonjagd', spokenName: 'Bonbonjagd', toName: 'zur Bonbonjagd', icon: '🍬', kind: 'play', cost: 3, needs: [], door: { x: 3.5, z: 40, side: 'right' },
    component: defineAsyncComponent(bonbonjagd), preload: bonbonjagd,
  },
  {
    // Shown, but closed, until the parents chose films
    id: 'kino', spokenName: 'Kino', toName: 'ins Kino', icon: '🎬', kind: 'play', cost: 3, needs: ['films'], door: { x: 3.5, z: -40, side: 'right' },
    component: defineAsyncComponent(kino), preload: kino,
  },
  {
    // The child's own: the logbook and the sticker book
    id: 'haus', spokenName: 'Mein Haus', toName: 'nach Hause', icon: '🏠', kind: 'free', needs: [], door: { x: -3.5, z: 13, side: 'left' },
    unlogged: true, component: defineAsyncComponent(haus), preload: haus,

    oberstufe: {},
  },
  {
    // Add-ons for her character, after today's learning: next to the house with her wardrobe
    id: 'laden', spokenName: 'Kleiderladen', toName: 'zum Kleiderladen', icon: '👗', kind: 'shop', needs: [], door: { x: -3.5, z: 24, side: 'left' },
    component: defineAsyncComponent(laden), preload: laden,

    oberstufe: {},
  },
  {
    // Furniture for her room (stage 8)
    id: 'moebel', spokenName: 'Möbelhaus', toName: 'zum Möbelhaus', icon: '🛋️', kind: 'shop', needs: [], door: { x: 51, z: -3.5 },
    component: defineAsyncComponent(moebel), preload: moebel,

    oberstufe: {},
  },
  {
    // Her wobbly gets wings: flying through the clouds
    id: 'flatterflug', spokenName: 'Flatterflug', toName: 'zum Flatterflug', icon: '🪽', kind: 'play', cost: 3, needs: [], door: { x: 40, z: 3.5, side: 'front' },
    component: defineAsyncComponent(flatterflug), preload: flatterflug,
  },
  {
    // Hearing words: rhymes, first sounds and syllables (Lehrplan 21 D.1.A.1), on the lot by the Tanzsaal
    id: 'reimhaus', spokenName: 'Reimhaus', toName: 'zum Reimhaus', icon: '👂', kind: 'earn', needs: [], door: { x: 35.5, z: -16, side: 'right' },
    component: defineAsyncComponent(reimhaus), preload: reimhaus,
  },
  {
    // Seeing rules in things: rows to continue and things to sort (Lehrplan 21 MA.1.B, MA.3), past the Yoga studio
    id: 'muster', spokenName: 'Musterwerkstatt', toName: 'zur Musterwerkstatt', icon: '🧩', kind: 'earn', needs: [], door: { x: 3.5, z: 51, side: 'right' },
    component: defineAsyncComponent(muster), preload: muster,
  },
  {
    // Finding her way in time (Lehrplan 21 MA.3, Zugang 3): what was a plain house next to the Bibliothek
    id: 'kalender', spokenName: 'Kalender', toName: 'zum Kalender', icon: '🗓️', kind: 'earn', needs: [], door: { x: 3.5, z: -24, side: 'right' },
    component: defineAsyncComponent(kalender), preload: kalender,
  },
  {
    // A wide world for position words (Lehrplan 21 MA.2, Zugang 4): what was a plain house by the playground
    id: 'spielwelt', spokenName: 'Spielwelt', toName: 'zur Spielwelt', icon: '🚗', kind: 'earn', needs: [], door: { x: -16, z: 35.5, side: 'front' },
    component: defineAsyncComponent(spielwelt), preload: spielwelt,
  },
  {
    // Rhythm by tapping or clapping (Lehrplan 21 MU): what was a plain house on the way to the Tanzsaal
    id: 'trommelhaus', spokenName: 'Trommelhaus', toName: 'zum Trommelhaus', icon: '🥁', kind: 'earn', needs: [], door: { x: 24, z: -3.5, side: 'back' },
    component: defineAsyncComponent(trommelhaus), preload: trommelhaus,
  },
]

export function canServe(building: BuildingDef, device: Capabilities): boolean {
  return building.needs.every(need => device[need] === true)
}

/** What the door of this building is to the child right now. */
export function stateOf(
  building: BuildingDef, device: Capabilities, goalReached: boolean, stars: number, timeUp = false, level: Level = 'kindergarten',
): DoorState {
  return doorState(building, canServe(building, device), goalReached, stars, timeUp, level)
}

/** The doors the town shows: one per building, open only when the child may walk in right now. */
export function toDoors(
  buildings: BuildingDef[], device: Capabilities, goalReached: boolean, stars: number, timeUp = false, level: Level = 'kindergarten',
): DoorDef[] {
  return buildings.map(b => {
    const state = stateOf(b, device, goalReached, stars, timeUp, level)
    return {
      id: b.id, x: b.door.x, z: b.door.z, side: b.door.side ?? 'back',
      open: state === 'open', locked: state === 'locked', icon: b.icon,
    }
  })
}
