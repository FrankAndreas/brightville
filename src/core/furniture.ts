import catalogue from '../../shared/furniture.json'
import { shelfOpenIn } from './outfits'

// Her room's furniture (stage 8): sold on three shelves in the Möbelhaus, each piece on its own spot in her room.
// The server has the same rules (backend/app/furniture.py) and decides. Ids are forever and never a clothes id.

/** Where a piece of furniture stands: one piece per spot */
export type Spot = 'bild' | 'vorhang' | 'lampe' | 'bett' | 'teppich' | 'pflanze' | 'spielzeug'
export const SPOTS: Spot[] = ['bild', 'vorhang', 'lampe', 'bett', 'teppich', 'pflanze', 'spielzeug']

export interface FurnitureDef {
  id: string
  /** Said aloud */
  name: string
  /** For the voice: der, die, das, or pl */
  article: 'der' | 'die' | 'das' | 'pl'
  emoji: string
  spot: Spot
  shelf: 1 | 2 | 3
  price: number
}

export const FURNITURE = catalogue as FurnitureDef[]

export const furnitureDef = (id: string): FurnitureDef | undefined => FURNITURE.find(f => f.id === id)

/** The Möbelhaus' shelves: two pieces from the shelf above open the next; clothes don't count */
export const furnitureShelfOpen = (shelf: 1 | 2 | 3, owned: string[]): boolean => shelfOpenIn(FURNITURE, shelf, owned)
