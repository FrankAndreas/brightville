import type { IntentSource, Intents } from '@/input/intents'
import { clampFrame } from './frame'

export interface Loop {
  pause(): void
  resume(): void
  /** Pauses for good */
  stop(): void
}

/**
 * Runs `step` once per frame with what the player wants and a physics-safe
 * frame time in seconds. Starts paused.
 */
export function createLoop(intents: IntentSource, step: (intents: Intents, dt: number) => void): Loop {
  let running = false
  let stopped = false
  let raf = 0
  let last = 0

  function tick(now: number) {
    if (!running) return
    raf = requestAnimationFrame(tick)
    const dt = clampFrame((now - last) / 1000)
    last = now
    step(intents.read(), dt)
  }

  function pause() {
    running = false
    cancelAnimationFrame(raf)
  }

  return {
    pause,
    resume() {
      if (running || stopped) return
      running = true
      // Presses made while paused belong to whatever was on screen then:
      // the Enter that leaves a building must not walk straight back in
      intents.read()
      last = performance.now()
      raf = requestAnimationFrame(tick)
    },
    stop() {
      pause()
      stopped = true
    },
  }
}
