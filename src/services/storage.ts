import { emptySave, parseSave, serializeSave, type SaveData } from '@/core/save'

/** Where the save lives. Local storage now; the family server in a later stage. */
export interface SaveStore {
  load(): SaveData
  save(data: SaveData): void
}

export const SAVE_KEY = 'brightville.save'

/** `storage` defaults to the browser's local storage, looked up on each use because merely touching it can throw. */
export function localSaveStore(storage?: Storage): SaveStore {
  return {
    load() {
      try {
        return parseSave((storage ?? window.localStorage).getItem(SAVE_KEY))
      } catch {
        return emptySave()
      }
    },
    save(data) {
      try {
        (storage ?? window.localStorage).setItem(SAVE_KEY, serializeSave(data))
      } catch {
        // Storage full or blocked (private mode): play on without saving
      }
    },
  }
}
