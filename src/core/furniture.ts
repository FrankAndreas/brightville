// Her room's furniture (stage 8): the spots in the room. The catalogue and its rules follow with the Möbelhaus.

/** Where a piece of furniture stands: one piece per spot */
export type Spot = 'bild' | 'vorhang' | 'lampe' | 'bett' | 'teppich' | 'pflanze' | 'spielzeug'
export const SPOTS: Spot[] = ['bild', 'vorhang', 'lampe', 'bett', 'teppich', 'pflanze', 'spielzeug']
