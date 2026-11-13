import type { Place } from './outfits'

// How her wobbly character looks: chosen on the first visit, free, and changed again in the wardrobe.
// The server takes exactly these choices (backend/app/wardrobe.py, LOOK_OPTIONS).

export type HairStyle = 'none' | 'spiky' | 'ponytail' | 'buns' | 'curly'
export type Glasses = 'none' | 'round' | 'star' | 'heart'

export interface Look {
  body: string
  hair: HairStyle
  hairColor: string
  glasses: Glasses
}

/** What she looks like and what she wears: what the character is built from */
export interface Dress {
  look: Look
  worn: Partial<Record<Place, string>>
}

/** Today's orange first */
export const BODY_COLORS = ['#ff9a3c', '#4f8fe8', '#4bd37b', '#e86fb0', '#a58bf0', '#f2c230', '#3cc8c8', '#ff6b6b']
export const HAIR_STYLES: HairStyle[] = ['none', 'spiky', 'ponytail', 'buns', 'curly']
/** Brown, black, blond, red, blue, pink */
export const HAIR_COLORS = ['#6b3b1f', '#222222', '#f2c94c', '#d4572a', '#4f8fe8', '#ff8fc8']
export const GLASSES: Glasses[] = ['none', 'round', 'star', 'heart']

/** The character before she chose: today's orange blob */
export const DEFAULT_LOOK: Look = { body: BODY_COLORS[0], hair: 'none', hairColor: HAIR_COLORS[0], glasses: 'none' }

const OPTIONS: Record<keyof Look, readonly string[]> = {
  body: BODY_COLORS,
  hair: HAIR_STYLES,
  hairColor: HAIR_COLORS,
  glasses: GLASSES,
}

export function isLook(x: unknown): x is Look {
  if (typeof x !== 'object' || x === null) return false
  const keys = Object.keys(x)
  const wanted = Object.keys(OPTIONS)
  if (keys.length !== wanted.length || !wanted.every(k => keys.includes(k))) return false
  return wanted.every(k => OPTIONS[k as keyof Look].includes((x as Record<string, unknown>)[k] as string))
}

/** For a child who doesn't want to choose: the 🎲 */
export function randomLook(rnd: () => number = Math.random): Look {
  const pick = <T,>(list: readonly T[]) => list[Math.min(list.length - 1, Math.floor(rnd() * list.length))]
  return { body: pick(BODY_COLORS), hair: pick(HAIR_STYLES), hairColor: pick(HAIR_COLORS), glasses: pick(GLASSES) }
}
