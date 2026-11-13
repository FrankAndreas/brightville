import type { IntentSource } from './intents'

const clamp = (v: number) => Math.max(-1, Math.min(1, v))

/** Several input devices as one: keys and fingers work at the same time. */
export function mergeIntents(...sources: IntentSource[]): IntentSource {
  return {
    read() {
      // Every source is read every time: a press left unread would fire later
      const all = sources.map(s => s.read())
      return {
        moveX: clamp(all.reduce((sum, i) => sum + i.moveX, 0)),
        moveZ: clamp(all.reduce((sum, i) => sum + i.moveZ, 0)),
        jump: all.some(i => i.jump),
        interact: all.some(i => i.interact),
        leave: all.some(i => i.leave),
        turn: clamp(all.reduce((sum, i) => sum + i.turn, 0)),
        turnAround: all.some(i => i.turnAround),
        lookHome: all.some(i => i.lookHome),
      }
    },
    reset: () => sources.forEach(s => s.reset()),
    dispose: () => sources.forEach(s => s.dispose()),
  }
}
