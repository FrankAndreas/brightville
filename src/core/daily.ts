import type { SaveData } from './save'

/** Earning visits needed per day before the play buildings open */
export const DAILY_GOAL = 2

/** The calendar day on this device, 'YYYY-MM-DD'. */
export function dayOf(date: Date): string {
  const two = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`
}

/** The saved visits, as far as they belong to the given day. */
export function visitsOn(save: Pick<SaveData, 'day' | 'visits'>, day: string): number {
  return save.day === day ? save.visits : 0
}

export function goalReached(visits: number): boolean {
  return visits >= DAILY_GOAL
}
