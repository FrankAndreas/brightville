export const SAVE_VERSION = 1

/** Everything the game remembers between visits. */
export interface SaveData {
  version: 1
  stars: number
}

export function emptySave(): SaveData {
  return { version: SAVE_VERSION, stars: 0 }
}

/**
 * Reads saved data. Anything unreadable, damaged or from a newer version gives
 * an empty save: a child must never see an error because of old data.
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
  const { version, stars } = data as Record<string, unknown>
  if (version !== SAVE_VERSION) return emptySave()
  if (typeof stars !== 'number' || !Number.isSafeInteger(stars) || stars < 0) return emptySave()
  return { version: SAVE_VERSION, stars }
}

export function serializeSave(data: SaveData): string {
  return JSON.stringify({ version: data.version, stars: data.stars })
}
