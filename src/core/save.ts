export const SAVE_VERSION = 2

/** Everything the game remembers between visits. */
export interface SaveData {
  version: 2
  stars: number
  /** The day the visits below belong to, 'YYYY-MM-DD'; '' when there are none */
  day: string
  /** Earning visits finished on that day */
  visits: number
}

export function emptySave(): SaveData {
  return { version: SAVE_VERSION, stars: 0, day: '', visits: 0 }
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const isCount = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0

/**
 * Reads saved data. Anything unreadable, damaged or from a newer version gives
 * an empty save: a child must never see an error because of old data.
 * A version 1 save (Stars only) is carried over. The Stars and the day are
 * checked separately, so a damaged day never costs the Stars.
 */
export function parseSave(raw: string | null): SaveData {
  if (!raw) return emptySave()
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return emptySave()
  }
  if (typeof data !== 'object' || data === null) return emptySave()
  const { version, stars, day, visits } = data as Record<string, unknown>
  if ((version !== 1 && version !== SAVE_VERSION) || !isCount(stars)) return emptySave()
  const save = { ...emptySave(), stars }
  if (version === SAVE_VERSION && typeof day === 'string' && DAY.test(day) && isCount(visits)) {
    save.day = day
    save.visits = visits
  }
  return save
}

export function serializeSave(data: SaveData): string {
  return JSON.stringify({ version: data.version, stars: data.stars, day: data.day, visits: data.visits })
}
