import { onMounted, onUnmounted, ref, type Ref } from 'vue'

// A longer gap between frames (a hiccup, a slow device) counts as this much,
// so the game never jumps ahead
const MAX_DT = 100

/**
 * Calls onFrame(dtMs) on every animation frame while running. Pauses while
 * the page is hidden (iPad asleep, other tab) and stops on unmount.
 */
export function useGameLoop(onFrame: (dtMs: number) => void): { start(): void; stop(): void; running: Ref<boolean> } {
  const running = ref(false)
  let raf = 0
  let last = 0
  let resumeOnShow = false

  function frame(t: number) {
    if (!running.value) return
    const dt = last ? Math.min(MAX_DT, t - last) : 0
    last = t
    onFrame(dt)
    if (running.value) raf = requestAnimationFrame(frame)
  }

  function start() {
    if (running.value) return
    running.value = true
    last = 0
    raf = requestAnimationFrame(frame)
  }

  function stop() {
    running.value = false
    cancelAnimationFrame(raf)
  }

  function onVisibility() {
    if (document.hidden) {
      resumeOnShow = running.value
      stop()
    } else if (resumeOnShow) {
      resumeOnShow = false
      start()
    }
  }

  onMounted(() => document.addEventListener('visibilitychange', onVisibility))
  onUnmounted(() => {
    stop()
    document.removeEventListener('visibilitychange', onVisibility)
  })

  return { start, stop, running }
}
