import { onBeforeUnmount, onMounted } from 'vue'
import type { Ladder } from '@/core/ladders'
import { stopSpeaking } from '@/services/tts'
import { useLaddersStore, type VisitResults } from '@/stores/ladders'
import { onLeaveRequest } from './leave'

// What every learning building's screen does the same way: its timers, its numbered runs of effects, the leave
// button, closing down; the ladder snapshot it records at; and how a solved task scores. What each building does with
// its own effects (speech, drums, dragging …) stays in the building.

/** One Star per solved task */
export const STARS_PER_TASK = 1
/** Extra Stars for finishing the whole visit */
export const SET_BONUS = 5

export interface Visit {
  /** Runs `fn` after `ms`, unless the visit has closed by then */
  later(fn: () => void, ms: number): void
  /** Waits `ms` on the visit's own timers */
  pause(ms: number): Promise<void>
  isClosed(): boolean
  /**
   * Starts a numbered run of effects: the function it returns says whether this run is still the newest and the visit
   * still open. What an older run still had to say is dropped when a newer one starts.
   */
  newRun(): () => boolean
  /** Makes every run so far stale (🔊 tapped while something is said) */
  dropRuns(): void
  /** Something to undo when the visit closes (a listener, the microphone …) */
  onShutDown(fn: () => void): void
  /** Closes the visit: timers stop, the voice stops, the leave button lets go. Once only. */
  shutDown(): void
}

/** The visit of the building whose setup calls this; `onLeave` answers the leave button (and Esc) */
export function useVisit(onLeave: () => void): Visit {
  let closed = false
  let current = 0
  const timers = new Set<ReturnType<typeof setTimeout>>()
  const cleanUps: (() => void)[] = []

  const visit: Visit = {
    later(fn, ms) {
      const id = setTimeout(() => {
        timers.delete(id)
        if (!closed) fn()
      }, ms)
      timers.add(id)
    },
    pause: ms => new Promise<void>(resolve => visit.later(resolve, ms)),
    isClosed: () => closed,
    newRun() {
      const mine = ++current
      return () => !closed && mine === current
    },
    dropRuns() {
      current++
    },
    onShutDown(fn) {
      cleanUps.push(fn)
    },
    shutDown() {
      if (closed) return
      closed = true
      for (const id of timers) clearTimeout(id)
      timers.clear()
      for (const fn of cleanUps.splice(0)) fn()
      stopSpeaking()
    },
  }

  onMounted(() => visit.onShutDown(onLeaveRequest(onLeave)))
  onBeforeUnmount(() => visit.shutDown())
  return visit
}

/**
 * A learning building's ladder as the visit starts: the step its tasks are asked at, how many answers she has at it,
 * and the child who plays. Her answers are recorded at that step for that child, even if either changes meanwhile.
 */
export function ladderVisit<L extends Ladder>(ladder: L) {
  const ladderStore = useLaddersStore()
  const step = ladderStore.ladders[ladder].step
  const windowLength = ladderStore.ladders[ladder].window.length
  const player = ladderStore.who
  return {
    step, windowLength, player,
    record(results: VisitResults) {
      ladderStore.record(results, { [ladder]: step }, player)
    },
  }
}

/** A task is solved: its Star, the bonus with the last one, and whether it was right on the first try */
export function scoreSolved<L extends Ladder>(
  state: { solved: number; stars: number; results: { ladder: L; firstTry: boolean }[] }, ladder: L, firstTry: boolean,
  total: number,
): void {
  state.solved += 1
  state.results.push({ ladder, firstTry })
  state.stars += STARS_PER_TASK
  // The bonus is earned with the last right answer, so leaving during the cheer keeps it
  if (state.solved === total) state.stars += SET_BONUS
}
