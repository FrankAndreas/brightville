/**
 * What a door is to the child right now:
 *  - open: walk in
 *  - unavailable: this device can't play it (e.g. no camera)
 *  - locked: a play building before today's learning is done
 *  - timeUp: a play building after today's play time is used up
 *  - poor: a play building the child doesn't have the Stars for
 */
export type DoorState = 'open' | 'unavailable' | 'locked' | 'timeUp' | 'poor'

export function doorState(
  building: { kind: 'earn' | 'play'; cost?: number },
  canServe: boolean,
  goalReached: boolean,
  stars: number,
  timeUp = false,
): DoorState {
  if (!canServe) return 'unavailable'
  if (building.kind === 'earn') return 'open'
  // Learn first, play later: Stars alone never open a play building
  if (!goalReached) return 'locked'
  if (timeUp) return 'timeUp'
  return stars >= (building.cost ?? 0) ? 'open' : 'poor'
}
