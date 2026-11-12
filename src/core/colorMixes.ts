// The Farblabor: two paint pots, one bowl. Which colour do they make?

export const COLORS = {
  rot: { hex: '#e53935', name: 'Rot' },
  gelb: { hex: '#fdd835', name: 'Gelb' },
  blau: { hex: '#1e66d0', name: 'Blau' },
  weiss: { hex: '#ffffff', name: 'Weiss' },
  schwarz: { hex: '#1f1f1f', name: 'Schwarz' },
  orange: { hex: '#fb8c00', name: 'Orange' },
  gruen: { hex: '#43a047', name: 'Grün' },
  lila: { hex: '#8e24aa', name: 'Lila' },
  rosa: { hex: '#f8a5c2', name: 'Rosa' },
  grau: { hex: '#9e9e9e', name: 'Grau' },
  hellblau: { hex: '#90caf9', name: 'Hellblau' },
} as const

export type ColorId = keyof typeof COLORS

export interface Mix {
  a: ColorId
  b: ColorId
  result: ColorId
}

export const MIXES: Mix[] = [
  { a: 'rot', b: 'gelb', result: 'orange' },
  { a: 'blau', b: 'gelb', result: 'gruen' },
  { a: 'rot', b: 'blau', result: 'lila' },
  { a: 'rot', b: 'weiss', result: 'rosa' },
  { a: 'schwarz', b: 'weiss', result: 'grau' },
  { a: 'blau', b: 'weiss', result: 'hellblau' },
]

export const LAB_TASKS = 5

export interface LabTask {
  mix: Mix
  /** Three colours to pick from */
  choices: ColorId[]
  answer: number
}

function shuffle<T>(list: T[], random: () => number): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** One visit: LAB_TASKS different mixes, each with the result and two other mixed colours to pick from. */
export function buildLab(random: () => number = Math.random): LabTask[] {
  const results = MIXES.map(m => m.result)
  return shuffle(MIXES, random).slice(0, LAB_TASKS).map(mix => {
    const others = shuffle(results.filter(r => r !== mix.result), random).slice(0, 2)
    const choices = shuffle([mix.result, ...others], random)
    return { mix, choices, answer: choices.indexOf(mix.result) }
  })
}
