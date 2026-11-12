import type { Pair } from '@/core/memory'

export const PAIRS_PER_ROUND = 6
export const COLUMNS = 4

/** The animals a round is drawn from */
export const ANIMALS: Pair[] = [
  { id: 'cat', emoji: '🐱', say: 'Katze' },
  { id: 'dog', emoji: '🐶', say: 'Hund' },
  { id: 'cow', emoji: '🐮', say: 'Kuh' },
  { id: 'pig', emoji: '🐷', say: 'Schwein' },
  { id: 'lion', emoji: '🦁', say: 'Löwe' },
  { id: 'fox', emoji: '🦊', say: 'Fuchs' },
  { id: 'bear', emoji: '🐻', say: 'Bär' },
  { id: 'rabbit', emoji: '🐰', say: 'Hase' },
  { id: 'frog', emoji: '🐸', say: 'Frosch' },
  { id: 'monkey', emoji: '🐵', say: 'Affe' },
  { id: 'penguin', emoji: '🐧', say: 'Pinguin' },
  { id: 'owl', emoji: '🦉', say: 'Eule' },
  { id: 'unicorn', emoji: '🦄', say: 'Einhorn' },
  { id: 'elephant', emoji: '🐘', say: 'Elefant' },
  { id: 'turtle', emoji: '🐢', say: 'Schildkröte' },
  { id: 'butterfly', emoji: '🦋', say: 'Schmetterling' },
]
