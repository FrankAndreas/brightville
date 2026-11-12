// Memory: find the pairs. Deck building ported from Spielzeugkiste (src/logic/memory.js).

export interface Pair {
  id: string
  emoji: string
  /** Spoken when the card is turned, German */
  say: string
}

export interface Card extends Pair {
  /** Unique per card: the two cards of a pair differ here */
  key: string
}

function shuffle<T>(list: T[], random: () => number): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** `count` different pairs, picked at random, so a round isn't always the same animals. */
export function pickPairs(pairs: Pair[], count: number, random: () => number = Math.random): Pair[] {
  return shuffle(pairs, random).slice(0, count)
}

/** Every pair twice, shuffled. */
export function buildDeck(pairs: Pair[], random: () => number = Math.random): Card[] {
  return shuffle(pairs.flatMap(p => [{ ...p, key: `${p.id}-a` }, { ...p, key: `${p.id}-b` }]), random)
}

export interface MemoryGame {
  /** Keys face up and not yet found: none, one, or two that didn't match */
  readonly open: string[]
  /** Keys of the pairs found */
  readonly matched: string[]
  readonly done: boolean
  /**
   * Turns a card. 'ignored' when it is already face up or found, or while two
   * cards that didn't match are still showing.
   */
  flip(key: string): 'ignored' | 'first' | 'match' | 'miss'
  /** Turns two cards that didn't match face down again */
  hideMisses(): void
}

export function createMemory(deck: Card[]): MemoryGame {
  const byKey = new Map(deck.map(card => [card.key, card]))
  let open: string[] = []
  const matched: string[] = []

  return {
    get open() { return [...open] },
    get matched() { return [...matched] },
    get done() { return matched.length === deck.length },
    flip(key) {
      const card = byKey.get(key)
      if (!card || open.length === 2 || open.includes(key) || matched.includes(key)) return 'ignored'
      if (open.length === 0) {
        open = [key]
        return 'first'
      }
      if (byKey.get(open[0])!.id === card.id) {
        matched.push(open[0], key)
        open = []
        return 'match'
      }
      open = [open[0], key]
      return 'miss'
    },
    hideMisses() {
      if (open.length === 2) open = []
    },
  }
}
