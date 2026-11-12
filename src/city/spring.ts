/** A damped spring: drives squash, lean and arm swing of the wobbly body. */
export interface Spring {
  value: number
  velocity: number
}

/** One step towards the target (semi-implicit Euler, stable for game-sized steps). */
export function stepSpring(s: Spring, target: number, stiffness: number, damping: number, dt: number): Spring {
  if (dt <= 0) return { value: s.value, velocity: s.velocity }
  const velocity = s.velocity + (stiffness * (target - s.value) - damping * s.velocity) * dt
  return { value: s.value + velocity * dt, velocity }
}
