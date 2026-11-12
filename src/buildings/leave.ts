// How the on-screen leave button reaches the open building. Each building
// already knows how to end (it does so on Esc); here it says so, and the
// button asks. Only one building is open at a time.

let current: (() => void) | null = null

/** A building says how it is left. Returns the function that takes this back. */
export function onLeaveRequest(fn: () => void): () => void {
  current = fn
  return () => {
    // A building that closes late must not take away its successor's answer
    if (current === fn) current = null
  }
}

/** Asks the open building to end, exactly as Esc does. */
export function requestLeave(): void {
  current?.()
}
