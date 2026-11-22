import boxes from '../../../shared/vocab/boxes.json'

/** The days until a word is due again by the box it moves into; the server reads the same file (backend/app/vocab.py) */
const DAYS: number[] = boxes.days
const MAX_BOX: number = boxes.maxBox

function addDays(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Right: one box up, due after that box's days (the last box stays). Wrong: box 1, due tomorrow. */
export function nextBox(box: number, right: boolean, today: string): { box: number; due: string } {
  if (!right) return { box: 1, due: addDays(today, DAYS[0]) }
  if (box >= MAX_BOX) return { box: MAX_BOX, due: addDays(today, DAYS[MAX_BOX]) }
  return { box: box + 1, due: addDays(today, DAYS[box]) }
}

/** A word counts as learned from this box on */
export const isLearned = (box: number) => box >= boxes.learned
