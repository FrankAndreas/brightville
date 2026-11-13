import catalogue from '../../shared/stickers.json'

/** A sticker as the page shows it; the server decides who has earned it (backend/app/stickers.py). */
export interface StickerDef {
  id: string
  emoji: string
  /** The badge behind the picture */
  color: string
  /** Said when tapped */
  name: string
  /** What it is for, said after the name: "Für zehn Besuche in der Bibliothek." */
  for: string
}

export const STICKERS: StickerDef[] = catalogue.map(({ id, emoji, color, name, for: what }) => ({ id, emoji, color, name, for: what }))

export const stickerDef = (id: string): StickerDef | undefined => STICKERS.find(s => s.id === id)
