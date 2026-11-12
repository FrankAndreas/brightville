import type { IntentSource } from './intents'

type Press = 'jump' | 'interact' | 'leave'

/** Intents from on-screen controls: they call in, the town reads out. */
export interface TouchIntents extends IntentSource {
  /** Each -1…1; (0, 0) is a stick let go */
  setStick(x: number, z: number): void
  press(what: Press): void
}

export function touchIntents(): TouchIntents {
  let x = 0
  let z = 0
  const pressed = new Set<Press>()
  const take = (p: Press) => pressed.delete(p)
  const forget = () => {
    x = z = 0
    pressed.clear()
  }
  return {
    setStick(nx, nz) {
      x = nx
      z = nz
    },
    press: what => void pressed.add(what),
    read: () => ({ moveX: x, moveZ: z, jump: take('jump'), interact: take('interact'), leave: take('leave') }),
    reset: forget,
    dispose: forget,
  }
}
