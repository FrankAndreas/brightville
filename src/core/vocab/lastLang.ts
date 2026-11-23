import type { Lang } from './types'

// The language a child picked last on the Oberstufe's language screen (LanguagePick), remembered on the device. The
// Kleiderladen labels his range in it.

export const lastLangKey = (owner: number | null): string => `brightville.vocab.lang.${owner ?? 0}`

/** The kept language, or null when nothing usable is kept (or the storage can't be read) */
export function keptLang(owner: number | null, storage?: Storage): Lang | null {
  try {
    const kept = (storage ?? window.localStorage).getItem(lastLangKey(owner))
    return kept === 'en' || kept === 'fr' ? kept : null
  } catch {
    return null
  }
}

/** The language he picked last; English when none */
export const lastPickedLang = (owner: number | null, storage?: Storage): Lang => keptLang(owner, storage) ?? 'en'
