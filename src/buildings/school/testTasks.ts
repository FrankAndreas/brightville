import type { Task, Thing } from '@/core/numbers'

// A fixed visit for tests: every round type, a zero, and answers in different positions
export const TEST_THINGS: Thing[] = [
  { emoji: '🍎', one: 'ein Apfel', many: 'Äpfel' },
  { emoji: '⭐', one: 'ein Stern', many: 'Sterne' },
]

export const TEST_TASKS: Task[] = [
  { type: 'count', kind: 0, amount: 3, answer: 3, choices: [2, 3, 4] },
  { type: 'dice', kind: 0, dice: [4], answer: 4, choices: [4, 5, 3] },
  { type: 'plus', kind: 0, a: 1, b: 2, answer: 3, choices: [1, 3, 5] },
  { type: 'count', kind: 1, amount: 0, answer: 0, choices: [0, 1, 2] },
  { type: 'plus', kind: 1, a: 2, b: 2, answer: 4, choices: [4, 6, 2] },
]
