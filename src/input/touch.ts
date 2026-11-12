import type { IntentSource, Press } from './intents'

/** Intents from on-screen controls: they call in, the town reads out. */
export interface TouchIntents extends IntentSource {
  /** Each -1…1; (0, 0) is a stick let go */
  setStick(x: number, z: number): void
  /** -1, 0 or 1 while a turn button is held */
  setTurn(turn: number): void
  press(what: Press): void
}

export function touchIntents(): TouchIntents {
  let x = 0
  let z = 0
  let turn = 0
  const pressed = new Set<Press>()
  const take = (p: Press) => pressed.delete(p)
  const forget = () => {
    x = z = turn = 0
    pressed.clear()
  }
  return {
    setStick(nx, nz) {
      x = nx
      z = nz
    },
    setTurn(next) {
      turn = next
    },
    press: what => void pressed.add(what),
    read: () => ({
      moveX: x, moveZ: z, jump: take('jump'), interact: take('interact'), leave: take('leave'),
      turn, turnAround: take('turnAround'), lookHome: take('lookHome'),
    }),
    reset: forget,
    dispose: forget,
  }
}
