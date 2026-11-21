// Picking and shuffling with a given random source, so a task maker given a seed always makes the same tasks

/** One of the items */
export function pick<T>(items: T[], random: () => number): T {
  return items[Math.floor(random() * items.length)]
}

/** The items in a new random order (Fisher–Yates); the list given is left as it is */
export function shuffle<T>(items: T[], random: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
