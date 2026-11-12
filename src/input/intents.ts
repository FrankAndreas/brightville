/** What the player wants to do, independent of the device it came from. */
export interface Intents {
  /** -1 left … 1 right */
  moveX: number
  /** -1 away from the camera … 1 towards it */
  moveZ: number
  /** True in one read() per press */
  jump: boolean
  /** True in one read() per press */
  interact: boolean
  /** True in one read() per press */
  leave: boolean
}

export interface IntentSource {
  read(): Intents
  /** Lets go of every held key and forgets pending presses */
  reset(): void
  dispose(): void
}

type Press = 'jump' | 'interact' | 'leave'

const PRESS_KEYS: Record<string, Press> = {
  Space: 'jump',
  Enter: 'interact',
  NumpadEnter: 'interact',
  KeyE: 'interact',
  Escape: 'leave',
}
const LEFT = ['ArrowLeft', 'KeyA']
const RIGHT = ['ArrowRight', 'KeyD']
const AWAY = ['ArrowUp', 'KeyW']
const NEAR = ['ArrowDown', 'KeyS']
// Keys that would otherwise scroll the page
const SCROLL_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'])

export function keyboardIntents(target: Window = window): IntentSource {
  const held = new Set<string>()
  const pressed = new Set<Press>()

  const onDown = (e: KeyboardEvent) => {
    if (SCROLL_KEYS.has(e.code)) e.preventDefault()
    if (e.repeat) return
    held.add(e.code)
    const press = PRESS_KEYS[e.code]
    if (press) pressed.add(press)
  }
  const onUp = (e: KeyboardEvent) => held.delete(e.code)
  // A key released while the window is elsewhere never sends keyup
  const forget = () => { held.clear(); pressed.clear() }
  const onVisibility = () => { if (target.document.hidden) forget() }

  target.addEventListener('keydown', onDown)
  target.addEventListener('keyup', onUp)
  target.addEventListener('blur', forget)
  target.document.addEventListener('visibilitychange', onVisibility)

  const any = (codes: string[]) => codes.some(c => held.has(c))
  const axis = (minus: string[], plus: string[]) => (any(plus) ? 1 : 0) - (any(minus) ? 1 : 0)
  const take = (p: Press) => pressed.delete(p)

  return {
    read: () => ({
      moveX: axis(LEFT, RIGHT),
      moveZ: axis(AWAY, NEAR),
      jump: take('jump'),
      interact: take('interact'),
      leave: take('leave'),
    }),
    reset: forget,
    dispose() {
      forget()
      target.removeEventListener('keydown', onDown)
      target.removeEventListener('keyup', onUp)
      target.removeEventListener('blur', forget)
      target.document.removeEventListener('visibilitychange', onVisibility)
    },
  }
}
