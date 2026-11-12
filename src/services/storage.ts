import { emptySave, parseSave, serializeSave, type SaveData } from '@/core/save'

/** Where the save lives. Local storage now; the family server in a later stage. */
export interface SaveStore {
  load(): SaveData
  save(data: SaveData): void
}

export const SAVE_KEY = 'brightville.save'

export function localSaveStore(storage: Storage = window.localStorage): SaveStore {
  return {
    load() {
      try {
        return parseSave(storage.getItem(SAVE_KEY))
      } catch {
        return emptySave()
      }
    },
    save(data) {
      try {
        storage.setItem(SAVE_KEY, serializeSave(data))
      } catch {
        // Storage full or blocked (private mode): play on without saving
      }
    },
  }
}
