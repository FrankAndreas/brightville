import catalogue from '../../shared/outfits.json'

// The add-ons for her character: sold on three shelves in the Kleiderladen, or given with a sticker. The server has
// the same rules (backend/app/outfits.py) and decides; these let the page show what it will decide.

/** Where an add-on goes on the character: one at a time in each place */
export type Place = 'head' | 'neck' | 'body' | 'back'
export const PLACES: Place[] = ['head', 'neck', 'body', 'back']

export interface OutfitDef {
  id: string
  /** Said aloud */
  name: string
  emoji: string
  place: Place
  /** Sold ones: the shelf and the price in Stars */
  shelf?: 1 | 2 | 3
  price?: number
  /** Gifts: the sticker that brings it; never sold */
  sticker?: string
}

export const OUTFITS = catalogue as OutfitDef[]

export const outfitDef = (id: string): OutfitDef | undefined => OUTFITS.find(o => o.id === id)
export const giftFor = (stickerId: string): OutfitDef | undefined => OUTFITS.find(o => o.sticker === stickerId)

/** Owned add-ons from the shelf above needed to open a shelf */
const TO_OPEN = 2

/** Shelf 1 is open from the start; each further one once two add-ons from the shelf above are owned (gifts don't count). */
export function shelfOpen(shelf: 1 | 2 | 3, owned: string[]): boolean {
  if (shelf === 1) return true
  const fromAbove = owned.filter(id => outfitDef(id)?.shelf === shelf - 1).length
  return fromAbove >= TO_OPEN
}

/** What she can spend in the shop: saved Stars count half, Stars earned since count fully */
export function shopMoney(stars: number, savings: number): number {
  return Math.floor(savings / 2) + (stars - savings)
}

/**
 * Pays a price: from the savings first, two saved Stars for each price Star, the rest from Stars earned since.
 * The new Stars and savings, or null when it isn't enough.
 */
export function pay(price: number, stars: number, savings: number): { stars: number; savings: number } | null {
  const fromSavings = Math.min(Math.floor(savings / 2), price)
  const rest = price - fromSavings
  if (rest > stars - savings) return null
  return { stars: stars - 2 * fromSavings - rest, savings: savings - 2 * fromSavings }
}
