import { onBeforeUnmount, onMounted } from 'vue'
import { keyToDirection, swipeDirection, type Direction } from '@/core/direction'

/**
 * Steering for the arrow games: arrow keys and WASD, and a swipe anywhere on
 * the element given `down`, `up` and `cancel`. The on-screen arrow pad calls the game directly.
 */
export function useSteering(onDir: (dir: Direction) => void): {
  down(e: PointerEvent): void
  up(e: PointerEvent): void
  cancel(): void
} {
  let swipe: { id: number; x: number; y: number } | null = null

  function onKey(e: KeyboardEvent) {
    const dir = keyToDirection(e.key)
    if (!dir) return
    e.preventDefault()
    onDir(dir)
  }

  onMounted(() => window.addEventListener('keydown', onKey))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

  return {
    down(e) {
      if (!swipe) swipe = { id: e.pointerId, x: e.clientX, y: e.clientY }
    },
    up(e) {
      if (!swipe || e.pointerId !== swipe.id) return
      const dir = swipeDirection(e.clientX - swipe.x, e.clientY - swipe.y)
      swipe = null
      if (dir) onDir(dir)
    },
    cancel() {
      swipe = null
    },
  }
}
