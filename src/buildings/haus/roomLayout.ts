import type { Spot } from '@/core/furniture'

/** Left, top, width, height in percent of the room */
export type Rect = [number, number, number, number]

/**
 * Where each furniture spot is in her room (stage 8). The curtain hangs over the window and starts right of the
 * leave and 🔊 buttons in the top-left corner, also on an upright iPad.
 */
export const SPOT_RECTS: Record<Spot, Rect> = {
  bild: [5, 18, 13, 18],
  vorhang: [24, 9, 20, 7],
  lampe: [45, 1, 10, 13],
  bett: [2, 64, 27, 30],
  teppich: [30, 86, 32, 11],
  pflanze: [62, 66, 9, 26],
  spielzeug: [72, 74, 11, 20],
}

/** The window, under the curtain */
export const WINDOW_RECT: Rect = [25, 14, 18, 24]

/** What a screen reader says for each spot */
export const SPOT_NAMES: Record<Spot, string> = {
  bild: 'Bild', vorhang: 'Vorhang', lampe: 'Lampe', bett: 'Bett', teppich: 'Teppich', pflanze: 'Pflanze', spielzeug: 'Spielzeug',
}

export const percent = ([left, top, width, height]: Rect) =>
  ({ left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` })
