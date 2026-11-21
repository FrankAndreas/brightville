# Town Growth, Map and Bicycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grow Brightville by a nature district (forest and farm) and a workshop district joined onto the old square,
with mountains behind the forest, a map she opens from the town, and a bicycle that rides her to the building or
district stop she taps.

**Architecture:**
- **The districts:** districts are data like the old town (`src/city/map.ts`). Each lives in its own file under
  `src/city/districts/`, so approach B could load one as a scene of its own later. The town's ground, wall, nature
  and checks work from an **outline** (a union of rectangles) instead of `TOWN_HALF`.
- **The ride:** pure route planning and steering in `src/city/ride.ts`. It drives the existing character controller
  at bicycle speed, so heights, collisions and the camera stay right.
- **The map:** an SVG component drawn from the same data.

**Tech Stack:** Vue 3 `<script setup>`, TypeScript, Three.js, Rapier (`@dimforge/rapier3d-compat`), Vitest (jsdom),
Playwright (performance checks, from `/home/andreas/work/family-hub/e2e/node_modules/playwright`).

**Spec:** `docs/superpowers/specs/2026-11-21-brightville-town-growth-design.md`

## Global Constraints

- German voice, English code. No CDN: models are built from code. The layout fits 1024×768 (touch) and 1440×900.
- The old town is unchanged: every building, house, street, path and door spot stays where it is
  (`src/buildings/registry.ts` is not edited).
- Walking speed stays 4 m/s. The bicycle's top speed is **12 m/s**, slower in curves, with a gentle start and stop.
- Nothing she walks on is steeper than **20°** (`MAX_SLOPE_DEG`). Every door and lot can be reached on foot from
  `START`. The lake is closed.
- Rides cost nothing and are not logged (no Stars, stickers, goal or play time).
- **Frame-rate yardstick:** about 50 frames a second in Chrome on this laptop's Intel UHD 620 at double pixel
  density, measured as in the performance review. Below about 45 the town lowers its own sharpness (`quality.ts`).
  The grown town must hold this while walking in the districts and on the longest ride.
- **Fallback:** if a checkpoint misses the yardstick and simpler drawing of far districts doesn't win it back, stop
  and ask Andreas before going on. Approach B (districts as separate scenes) is a re-plan, not a task here.
- **Voice lines (exact):**
  - map opens: `Wohin willst du fahren?`
  - a ride to a building: `Wir fahren zu ${dativeName}!`, where `dativeName` is the building's own phrase (table in
    Task 8);
  - stops: `Wir fahren zum Platz!`, `Wir fahren zum Bauernhof!`, `Wir fahren in den Wald!`,
    `Wir fahren zur Werkstatt!`;
  - a tap on a closed building: that building's door line (`doorLine` in `App.vue`).
- Commits are Conventional Commits and end with the two attribution lines:
  - `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  - `Claude-Session: https://claude.ai/code/session_01AaK9DPyUsG7sZZPHidc45Q`

## Review Focus

1. **A ride passing other doors:**
   - **The problem:** while riding past another building, the door prompt shows, and a tap on it enters that
     building.
   - **Expected:** entering cancels the ride, and coming back out never resumes it. (Test in Task 7.)
2. **Opening the map during a ride:**
   - **Expected:** a new tap starts a new ride from where she is. The old one never finishes in the background or
     snaps her anywhere. (Test in Task 7.)
3. **Riding to where she already stands:**
   - **The situation:** tapping the building whose door she is at, or the stop she is on.
   - **Expected:** no ride; she just stays and faces it. (Test in Task 6.)
4. **Starting from awkward places:**
   - **The places:** the top of the hill, the playground platform, inside a lot's garden, on the jetty, or right
     beside the lake.
   - **Expected:** the first stretch reaches a street without crossing water, houses, blocks or trampolines.
     (Test in Task 6.)
5. **A door's state changing during a ride:**
   - **The situation:** the goal is reached, or play time runs out, while she rides.
   - **Expected:** arriving shows the door's current state, and arriving never enters. (Test in Task 7.)

---

## File Structure

- `src/city/districts/types.ts` (new): the `District` and `Stop` types.
- `src/city/districts/nature.ts`, `src/city/districts/workshop.ts` (new): each district's data.
- `src/city/map.ts` (modify):
  - the old town becomes the `town` district;
  - adds `DISTRICTS`, `OUTLINE`, `BOUNDS`, `inTown`, `ALL_STREETS`, `ALL_SCENERY` and `STOPS`;
  - `EMPTY_LOTS` gains the district lots, appended after the cat's and the dog's gardens (indices 0 and 1 stay).
- `src/city/walkable.ts` (new): the shared walking grid, used by the map checks and the ride's first stretch.
- `src/city/world.ts` (modify): ground, streets, hedge along the outline with gates, district scenery, farm
  fences, field, crane.
- `src/city/nature.ts` (modify): placement within the outline; a dense forest.
- `src/city/farm.ts` (new): farm and forest animals, with their small touches.
- `src/city/mountains.ts` (new): the backdrop.
- `src/city/ride.ts` (new): street graph, route planning, steering.
- `src/city/bicycle.ts` (new): the bicycle model.
- `src/city/character.ts`, `src/city/city.ts`, `src/city/CityView.vue` (modify): bicycle speed, facing, ride API.
- `src/city/mapPicture.ts` (new): what the map draws, as plain data.
- `src/components/TownMap.vue` (new): the map.
- `src/App.vue`, `src/components/HelpOverlay.vue`, `src/input/intents.ts` (modify): map button, key `M`, taps, voice.
- `docs/roadmap.md` (modify).

---

### Task 1: The outline and the districts as data

**Files:**
- Create: `src/city/districts/types.ts`, `src/city/districts/nature.ts`, `src/city/districts/workshop.ts`,
  `src/city/walkable.ts`
- Modify: `src/city/map.ts`, `src/city/map.test.ts`
- Test: `src/city/map.test.ts`, `src/city/walkable.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // districts/types.ts
  export type DistrictId = 'town' | 'nature' | 'workshop'
  export type StopId = 'platz' | 'bauernhof' | 'wald' | 'werkstatt'
  export interface Stop { id: StopId; icon: string; x: number; z: number; /** heading she faces on arrival */ face: number; line: string }
  export interface District {
    id: DistrictId
    areas: Footprint[]             // rectangles; the outline is the union of all districts' areas
    ground: number                 // map colour (0xRRGGBB)
    streets: Street[]              // its own streets (the town's are STREETS)
    scenery: SceneryHouse[]
    lots: { use: 'nmg' | 'beebot' | 'spare'; spot: DoorSpot }[]
    stop: Stop
    gate?: { x: number; z: number; width: number }  // the gap in the hedge to the old town
  }
  // map.ts
  export const DISTRICTS: District[]           // [town, nature, workshop]
  export const OUTLINE: Footprint[]            // all areas
  export const BOUNDS: Footprint               // bounding box of OUTLINE
  export function inTown(x: number, z: number, margin?: number): boolean  // inside OUTLINE, `margin` m from its edge
  export const ALL_STREETS: Street[]           // STREETS + every district's streets
  export const ALL_SCENERY: SceneryHouse[]     // SCENERY_HOUSES + every district's scenery
  export const STOPS: Stop[]
  // walkable.ts
  export interface WalkGrid { step: number; free(x: number, z: number): boolean; reachable(from: Point): (x: number, z: number) => boolean }
  export function walkGrid(doors: DoorSpot[], step?: number): WalkGrid   // 0.5 m by default; her 0.4 m radius added to every solid
  ```
- Values from the spec:
  - old square: `{ minX: -60, maxX: 60, minZ: -60, maxZ: 60 }` (as today);
  - nature: about `{ minX: -35, maxX: 35, minZ: -105, maxZ: -60 }`, with its gate on the back avenue at x = 0;
  - workshop: about `{ minX: 60, maxX: 100, minZ: -20, maxZ: 20 }`, with its gate on the right avenue at z = 0;
  - the sizes may move by a few metres to pass the checks;
  - the back avenue and the right avenue continue through their gates into their district's streets;
  - nature: forest on the left half (x < 0), farm on the right (x > 0). Lots: `nmg` (on a street, within 20 m of
    the gate) and one `spare`;
  - workshop: `beebot` and two `spare`;
  - stops: ⛲ `platz` on the plaza's edge, 🚜 `bauernhof` at the farm gate, 🌲 `wald` where the path enters the
    forest, 🏗️ `werkstatt` in the middle of the yard. Each has its exact line from Global Constraints.

- [ ] **Step 1: Write the failing tests.** Generalise `map.test.ts` from `TOWN_HALF` to the outline:
  - every check that loops over `-TOWN_HALF..TOWN_HALF` loops over `BOUNDS` and skips points where
    `!inTown(x, z)`;
  - "inside the town, 2 m from the edge" uses `inTown(·, ·, 2)` on all four corners of each footprint;
  - houses, lots and props include `ALL_SCENERY` and the district lots;
  - streets mean `ALL_STREETS`.

  Move the reachability flood fill into `walkable.ts` and use it there. Then add:
  ```ts
  it('joins the nature district behind and the workshop district to the right, each through a gate on its avenue', () => {
    const nature = DISTRICTS.find(d => d.id === 'nature')!, workshop = DISTRICTS.find(d => d.id === 'workshop')!
    expect(nature.areas.every(a => a.maxZ <= -60)).toBe(true)
    expect(workshop.areas.every(a => a.minX >= 60)).toBe(true)
    expect(onStreet(0, -60) && onStreet(0, -62)).toBe(true)      // the back avenue goes through
    expect(onStreet(60, 0) && onStreet(62, 0)).toBe(true)        // the right avenue goes through
  })
  it('keeps the old town as it was', () => {
    expect(STREETS).toEqual(OLD_STREETS)                          // a frozen copy in the test
    expect(SCENERY_HOUSES.length).toBe(19)
    expect(EMPTY_LOTS.slice(0, 2)).toEqual([{ x: -3.5, z: -40, side: 'left' }, { x: -51, z: 3.5, side: 'front' }])
  })
  it('has a lot for the NMG house within 20 m of the nature gate, one for the Bee-Bot house, and three spare', () => {
    const lots = DISTRICTS.flatMap(d => d.lots)
    const nmg = lots.filter(l => l.use === 'nmg'), beebot = lots.filter(l => l.use === 'beebot')
    expect(nmg).toHaveLength(1); expect(beebot).toHaveLength(1); expect(lots.filter(l => l.use === 'spare')).toHaveLength(3)
    expect(Math.hypot(nmg[0].spot.x - 0, nmg[0].spot.z + 60)).toBeLessThanOrEqual(20)
  })
  it('has one stop in each district, on a street or the plaza, reachable on foot', () => {
    expect(STOPS.map(s => s.id).sort()).toEqual(['bauernhof', 'platz', 'wald', 'werkstatt'])
    // reach = walkGrid(doors).reachable(START)
    for (const s of STOPS) { expect(streetDistance(s.x, s.z), s.id).toBeLessThanOrEqual(1); expect(reach(s.x, s.z), s.id).toBe(true) }
  })
  it('keeps every stop clear of doors, so arriving there shows no door prompt', () => {
    for (const s of STOPS) for (const d of doors) expect(Math.hypot(s.x - d.x, s.z - d.z), s.id).toBeGreaterThan(DOOR_RADIUS + 1)
  })
  ```
  In `walkable.test.ts`: from `START`, every point of a street in every district is reachable; a point inside a
  scenery house is not free.

- [ ] **Step 2: Run the tests and watch them fail.**
  Run: `npx vitest run src/city/map.test.ts src/city/walkable.test.ts`
  Expected: FAIL. `DISTRICTS`, `STOPS` and `walkable` don't exist yet.

- [ ] **Step 3: Implement the data.**
  - Write `districts/*.ts` and the exports above in `map.ts`. `TOWN_HALF` stays (the old square's half size) for the
    old town's own data.
  - `streetDistance(x, z)` without a `streets` argument uses `ALL_STREETS`.
  - District ground is flat except for gentle bumps added to `HILLS` (none on streets or lots).
  - Lots and scenery positions: the builder's choice, passing every check.

- [ ] **Step 4: Run the tests and watch them pass.**
  Run: `npx vitest run src/city`
  Expected: PASS. Every old check passes unchanged in meaning.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/city/districts src/city/map.ts src/city/map.test.ts src/city/walkable.ts src/city/walkable.test.ts
  git commit -m "feat: the nature and workshop districts as data, joined onto the town's outline"
  ```

### Task 2: Drawing the districts

**Files:**
- Modify: `src/city/world.ts`, `src/city/nature.ts`, `src/city/animals.ts` (outline instead of `TOWN_HALF`)
- Test: `src/city/world.test.ts`, `src/city/nature.test.ts`

**Interfaces:**
- Consumes: `OUTLINE`, `BOUNDS`, `inTown`, `ALL_STREETS`, `ALL_SCENERY`, `DISTRICTS` (Task 1).
- Produces: `buildTown` draws everything; no new exports apart from
  `export function hedgeSegments(): { a: Point; b: Point }[]` in `world.ts` (the outline's edges minus the gates).

- [ ] **Step 1: Write the failing tests.**
  - `world.test.ts`:
    - `hedgeSegments()` lies on the outline's boundary;
    - it leaves a gap at least 6 m wide where each gate is;
    - no segment crosses a street (`onStreet` is false along every segment, sampled every 0.5 m);
    - the ground heightfield covers `BOUNDS`.
  - `nature.test.ts`:
    - every item is `inTown(x, z, 1.5)`;
    - the forest half of the nature district (x < 0, z < −62) holds at least 40 trees;
    - the farm half has fences around at least two pens;
    - no tree stands on a district street or lot.

- [ ] **Step 2: Run the tests and watch them fail.**
  Run: `npx vitest run src/city/world.test.ts src/city/nature.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement the drawing.**
  - **Ground:** the heightfield and the mesh over `BOUNDS`. Grass outside the outline may show beyond the hedge.
  - **Streets:** draw `ALL_STREETS`, with district dirt paths in a dirt colour.
  - **Hedge and barrier:** along `hedgeSegments()`.
  - **District scenery:** through `house(...)`, with a barn colour pair on the farm.
  - **Farm:** pens (the `fence` kind), a field strip, a tractor.
  - **Workshop:** paving, crates, a crane with a slowly turning arm.
  - **Nature placement:** within `inTown`, with dense trees in the forest half.
  - **Gardens:** on every empty lot.
  - Keep the 30 m merge cells (`mergeParts`).

- [ ] **Step 4: Run the tests, then look at the result.**
  Run: `npx vitest run src/city`
  Expected: PASS.

  Then build and screenshot with the performance harness (Task 5 describes it) at the nature gate and in the
  workshop. Expected: no gaps in the ground, the hedge closed except at the gates, no house floating or sunk.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/city
  git commit -m "feat: draw the forest, the farm and the workshop yard"
  ```

### Task 3: Life in the districts

**Files:**
- Create: `src/city/farm.ts`
- Modify: `src/city/animals.ts` (`createAnimals` also creates the farm's and forest's animals), `src/city/walkers.ts`
  (`ROUTES` gains a farm loop and a workshop loop), `src/services/sound.ts` (a moo)
- Test: `src/city/farm.test.ts`, `src/city/walkers.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface PenAnimal { kind: 'cow' | 'chicken' | 'sheep'; x: number; z: number; heading: number; homeX: number; homeZ: number; t: number; mooAt?: number }
  export function stepPenAnimal(a: PenAnimal, her: Point, dt: number, pen: Footprint): PenAnimal
  export interface Deer { x: number; z: number; heading: number; state: 'graze' | 'leave' | 'gone'; t: number }
  export function stepDeer(d: Deer, her: Point, dt: number): Deer
  export function wantsMoo(a: PenAnimal, her: Point, now: number): boolean   // within 6 m, and at least 8 s since the last moo
  ```
- Values:
  - **Chickens:** within 3 m of her, they move up to 2 m away from her, never leave their pen, and return home after
    she has been 5 m away for 2 s.
  - **Cows:** turn their head towards her within 6 m, and moo at most once every 8 s.
  - **Deer:** within 8 m, they walk into the trees (`leave`), are `gone` while she is within 12 m, and come back
    afterwards.

- [ ] **Step 1: Write the failing tests** (`farm.test.ts`):
  - a chicken 2 m from her ends farther away and inside its pen after 1 s of steps;
  - a cow moos when she comes within 6 m, and not again within 8 s;
  - deer leave at 8 m and are back after she has been 15 m away for 5 s;
  - every walker route point is `onStreet`.

- [ ] **Step 2: Run the tests and watch them fail.**
  Run: `npx vitest run src/city/farm.test.ts src/city/walkers.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement the animals.**
  - Write `farm.ts` and the block shapes, as in `animals.ts`, with no shadows.
  - Wire them into `createAnimals`.
  - Add `playMoo()` to `sound.ts`: a short WebAudio sound, a low sawtooth gliding down, about 0.6 s.

- [ ] **Step 4: Run the tests and watch them pass.**
  Run: `npx vitest run src/city src/services/sound.test.ts`
  Expected: PASS.

- [ ] **Step 5: Commit.**
  `feat: cows, chickens, sheep and deer in the new districts`

### Task 4: The mountains

**Files:**
- Create: `src/city/mountains.ts`
- Modify: `src/city/city.ts` (follow the camera each frame)
- Test: `src/city/mountains.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function createMountains(scene: THREE.Scene): { follow(cameraX: number, cameraZ: number): void; dispose(): void }
  ```
  - The group sits at `(cameraX, 0, cameraZ - 150)`, so the mountains never come closer.
  - Its materials have `fog: false`.
  - It is wide enough to fill a 60° view from anywhere in `BOUNDS`.
  - Snow caps, flat shading, and no physics.

- [ ] **Step 1: Write the failing test.**
  - After `follow(10, -80)`, the group's position is `(10, 0, -230)`;
  - every material has `fog === false`;
  - the peaks span at least 2 · 150 · tan(30°) + 40 m across.

- [ ] **Step 2: Run the test and watch it fail.**
  Run: `npx vitest run src/city/mountains.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement the mountains.** Write `mountains.ts`, call `follow` in the frame loop after the camera
  moves, and dispose of it with the town.

- [ ] **Step 4: Run the tests and watch them pass.**
  Run: `npx vitest run src/city`
  Expected: PASS.

- [ ] **Step 5: Commit.**
  `feat: mountains behind the forest`

### Task 5: Performance checkpoint 1 (decides C or B before any ride work)

**Files:**
- No source changes, unless simpler far drawing is needed: then `src/city/world.ts` and `src/city/merge.ts`.
- Modify: `docs/roadmap.md` (record the numbers).

**The harness** (from the performance review): copy these files into the worktree root, never commit them, and
delete them after:
- `zz-perf.html`, `zz-perf.ts`, `zz-perf.config.ts`, `zz-CityView.vue`, `zz-poseTracker.ts`;
- the copies are in `/tmp/claude-1000/-home-andreas-work-brightville/192d4444-d5a9-4b1b-bde2-dfd9bc91c28e/scratchpad/harness/`.

Then:
- build with `npx vite build -c zz-perf.config.ts --outDir <scratchpad>/pdist`;
- serve with `npx vite preview ... --port 5188`;
- run `<scratchpad>/perf/start.mjs` (GPU flags `--use-gl=angle --use-angle=gl-egl`).

Add a walk script for the districts: start at the plaza, hold the keys for about 20 s up the back avenue to the
farm and into the forest, then about 15 s to the workshop. Log the frame gaps as `start.mjs` does.

- [ ] **Step 1: Measure.** Run `start.mjs 1 25` twice, and the district walk twice.
  Expected: an average of at least 45 fps and p95 at most 34 ms, as in the old town (54 fps, p95 33 ms).
- [ ] **Step 2: If it misses,** draw far districts more simply (hide a district's merged meshes beyond 90 m from
  her, or lower its tree count), then measure again. If it still misses: **stop and ask Andreas**, since B is a
  re-plan.
- [ ] **Step 3: Record and commit.** Write the numbers in the roadmap, kill the server by PID from
  `ss -ltnp | grep 5188`, and delete the `zz-*` files.
  `docs: frame rate after the town grew`

### Task 6: The ride's route and steering (pure)

**Files:**
- Create: `src/city/ride.ts`
- Test: `src/city/ride.test.ts`

**Interfaces:**
- Consumes: `ALL_STREETS`, `PLAZA`, `walkGrid` (Task 1), `DoorSpot`, `DOOR_RADIUS`.
- Produces:
  ```ts
  export const RIDE_SPEED = 12
  export interface RideTarget { x: number; z: number; face: number }      // a door spot facing its house, or a stop
  export function doorTarget(door: DoorSpot): RideTarget                   // face = towards the house (from `side`)
  export function planRide(from: Point, to: RideTarget, grid: WalkGrid): Point[] | null  // null when already there (≤ DOOR_RADIUS)
  export interface RideState { path: Point[]; along: number; speed: number }
  export function startRide(path: Point[]): RideState
  export function steer(s: RideState, at: Point, dt: number): { state: RideState; dirX: number; dirZ: number; speed: number; arrived: boolean }
  ```
- Route:
  - **The first stretch** goes over the grid from `from` to the nearest street or plaza cell: breadth-first search
    on `grid`, then shortened by skipping corners where the straight line stays free.
  - **Then the street graph:** nodes at every street point, every crossing of two streets, and the plaza's rim. The
    shortest path (Dijkstra) runs to the point on a street nearest `to`, then to `to` itself.
- Speed:
  - up to 12 m/s, rising and falling by at most 8 m/s² (soft start and stop);
  - before a corner of angle θ, at most `max(4, 12 · cos(θ/2))`;
  - arrived within 0.3 m of the end.

- [ ] **Step 1: Write the failing tests.**
  ```ts
  it('rides the streets from the plaza to the farm stop, never over grass', () => { /* every point sampled every 0.5 m on the path is onStreet */ })
  it('from the top of the hill, the playground platform, a garden lot, the jetty and beside the lake: first stretch stays free and reaches a street', () => {})
  it('plans nothing when she is already at the door or the stop', () => { expect(planRide({ x: d.x + 1, z: d.z }, doorTarget(d), grid)).toBeNull() })
  it('the longest ride (workshop far end to forest far end) is 200–260 m and takes 17–24 s when steered at 60 fps', () => {})
  it('starts and stops gently and never passes 12 m/s', () => {})
  it('slows below 7 m/s in a right-angle corner', () => {})
  it('faces the house on arrival: doorTarget of a right-side door faces +x', () => {})
  ```

- [ ] **Step 2: Run the tests and watch them fail.**
  Run: `npx vitest run src/city/ride.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement `ride.ts`.**

- [ ] **Step 4: Run the tests and watch them pass.**
  Run: `npx vitest run src/city`
  Expected: PASS.

- [ ] **Step 5: Commit.**
  `feat: plan and steer a bicycle ride along the streets`

### Task 7: The ride in the town

**Files:**
- Create: `src/city/bicycle.ts`
- Modify:
  - `src/city/character.ts`: `step` takes an optional `speed` (top speed, default 4) and `face` (a heading to turn
    to when standing);
  - `src/city/city.ts`, `src/city/CityView.vue`
- Test: `src/city/ride.city.test.ts` (in the style of `flyer.test.ts` and `nature.physics.test.ts`, with Rapier),
  `src/city/CityView.test.ts`

**Interfaces:**
- Consumes: `planRide`, `startRide`, `steer`, `doorTarget`, `RideTarget` (Task 6).
- Produces:
  ```ts
  // City (city.ts)
  rideTo(target: RideTarget): 'riding' | 'there'   // 'there' when planRide gives null
  stopRide(): void
  position(): { x: number; z: number }
  // CityOptions
  onRideEnd?(how: 'arrived' | 'stopped'): void
  // CityView.vue
  defineExpose({ rideTo, position })   // forwards to the city; rideTo before the city is ready returns 'there'
  ```
- Behaviour:
  - **While riding:**
    - each frame passes `steer`'s direction as `moveX` and `moveZ`, with `speed` from `steer`;
    - the bicycle is shown under her;
    - the blob sits: no walking bounce;
    - the view's yaw swings behind the direction of travel.
  - **Stopping:** any of `moveX ≠ 0`, `moveZ ≠ 0`, `jump`, `turn ≠ 0`, `turnAround` or `lookHome` stops the ride
    within 0.5 s (speed falls to 0). The bicycle hides, `onRideEnd('stopped')` is called, and her input works again
    from the next frame.
  - **A ride waits for her:** in the air or tumbling, it starts only once she is grounded and not tumbling.
  - **Arriving:** she faces `target.face`, the bicycle hides, and `onRideEnd('arrived')` is called. Arriving never
    calls `onEnter`.
  - **Pausing:** `pause()` (entering a building, the help, the parents' area) cancels a ride without
    `onRideEnd('arrived')`. `resume()` never resumes it.
  - **A new ride:** `rideTo` during a ride replaces it, from where she is.

- [ ] **Step 1: Write the failing tests.**
  - a ride from `START` to the farm stop ends within 0.5 m of the stop, facing `face ± 0.1`, without `onEnter`;
  - pressing a walk key mid-ride ends it with `'stopped'` and then walks normally;
  - `pause()` mid-ride followed by `resume()`: the character doesn't move without input;
  - `rideTo` mid-ride: she ends at the second target;
  - a door that opens or locks mid-ride (`setDoors`): arriving shows the door's current state, and no enter happens
    on arrival.

- [ ] **Step 2: Run the tests and watch them fail.**
  Run: `npx vitest run src/city/ride.city.test.ts src/city/CityView.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement it.** The bicycle model is block-built in her body colour, with two wheels that turn with
  the speed.

- [ ] **Step 4: Run the tests and watch them pass.**
  Run: `npx vitest run`
  Expected: PASS.

- [ ] **Step 5: Commit.**
  `feat: ride the bicycle through the town`

### Task 8: The map

**Files:**
- Create: `src/city/mapPicture.ts`, `src/components/TownMap.vue`
- Modify:
  - `src/App.vue`: the 🗺️ button in `.corner`, the map, taps, voice;
  - `src/components/HelpOverlay.vue`: one more row;
  - `src/input/intents.ts`: a press `map` on `KeyM`;
  - `src/buildings/registry.ts`: only adds a `toName` field per building (the ride line's phrase); no door moves.
- Test: `src/city/mapPicture.test.ts`, `src/components/TownMap.test.ts`, `src/App.test.ts`,
  `src/components/HelpOverlay.test.ts`

**Interfaces:**
- Consumes: `DISTRICTS`, `ALL_STREETS`, `LAKE`, `PLAZA`, `STOPS` (Task 1); `CityView.rideTo` and `position`
  (Task 7); `stateOf` (`core/access.ts`).
- Produces:
  ```ts
  export interface MapMarker { kind: 'building' | 'stop'; id: string; icon: string; x: number; z: number; state: DoorState | 'stop' }
  export function mapPicture(buildings: { id: string; icon: string; door: DoorSpot; state: DoorState }[]): {
    viewBox: string; districts: { id: DistrictId; rects: Footprint[]; color: number }[]; streets: Street[]; lake: typeof LAKE; markers: MapMarker[]
  }   // unavailable buildings are left out; −z is up (the mountains' band along the top)
  ```
  `TownMap.vue` props: `markers` (via `mapPicture`) and `her: Point`. Emits: `choose(marker)` and `close`.
- **The ride line's phrase** (`toName`, dative, used as `Wir fahren ${toName}!`). The exact values:
  - school: `zur Schule`
  - schreiben: `zum Schreiben`
  - yoga: `zum Yoga`
  - unterschiede: `zu den Unterschieden`
  - bibliothek: `zur Bibliothek`
  - farblabor: `zum Farblabor`
  - ausmalen: `zum Ausmalen`
  - malen: `zum Malen`
  - huepfhalle: `zur Hüpfhalle`
  - tanzsaal: `zum Tanzsaal`
  - arcade: `zur Spielhalle`
  - schlange: `zur Schlange`
  - bonbonjagd: `zur Bonbonjagd`
  - kino: `ins Kino`
  - haus: `nach Hause`
  - laden: `zum Kleiderladen`
  - moebel: `zum Möbelhaus`
  - flatterflug: `zum Flatterflug`
  - reimhaus: `zum Reimhaus`
  - muster: `zur Musterwerkstatt`
  - kalender: `zum Kalender`
  - spielwelt: `zur Spielwelt`
  - trommelhaus: `zum Trommelhaus`

  The stop lines are the fixed ones in Global Constraints.
- **Behaviour:**
  - **Showing the button:** the 🗺️ button and the `M` key work only when `inTown && !helpOpen && !parentsOpen`.
  - **Opening:** the map speaks `Wohin willst du fahren?`.
  - **Tapping an `open` building or a stop:** speak its ride line, close the map, call `rideTo`. If the result is
    `'there'`, stay silent apart from the door's own line, which comes from being near the door.
  - **Tapping `locked`, `timeUp` or `poor`:** speak `doorLine(building)`; the map stays open and no ride starts.
  - **Closing:** ✕, tapping outside the picture, or `Escape`.
  - **Picture:** her dot is in `session.person.color`; closed buildings show the lock, as the door sign does.

- [ ] **Step 1: Write the failing tests.**
  - `mapPicture`:
    - unavailable buildings are left out;
    - four stops;
    - every building's marker sits at its door;
    - the viewBox covers `BOUNDS`;
    - the nature district lies above the old town.
  - `TownMap`:
    - tapping a marker emits `choose`;
    - tapping outside emits `close`;
    - nothing on it is text apart from `aria-label`s.
  - `App`:
    - the 🗺️ button opens the map and speaks the line;
    - tapping an open building speaks `Wir fahren zur Schule!` and calls `rideTo` with `doorTarget(school.door)`;
    - a locked play building speaks its door line, calls nothing, and keeps the map open;
    - the button is hidden inside a building and while the help is open;
    - `M` opens it.
  - `HelpOverlay`: the new row is read with the 🗺️ picture. Touch line: `Tipp auf die Karte, dann fährst du mit
    dem Velo.` Keys line: `Mit M öffnest du die Karte.`

- [ ] **Step 2: Run the tests and watch them fail.**
  Run: `npx vitest run src/city/mapPicture.test.ts src/components src/App.test.ts`
  Expected: FAIL.

- [ ] **Step 3: Implement the map.**

- [ ] **Step 4: Run all the checks.**
  Run: `npx vitest run && npx eslint . && npx vue-tsc --noEmit`
  Expected: all pass. Delete `tsconfig.tsbuildinfo` if one appears.

- [ ] **Step 5: Commit.**
  `feat: a map to ride to every building and district`

### Task 9: Performance checkpoint 2, walkthrough and roadmap

**Files:** `docs/roadmap.md`. The harness is used as in Task 5 and not committed.

- [ ] **Step 1: Measure.** The longest ride, from the workshop's far end to the forest stop, twice. Log fps, p95
  and frames over 50 ms.
  Expected: at least 45 fps and p95 at most 34 ms. If it misses, follow Task 5 Step 2.
- [ ] **Step 2: Walkthrough** at 1180×820 (touch), with screenshots in the scratchpad:
  - open the map;
  - ride to each stop and to a building in each district;
  - stop a ride with the joystick;
  - tap a locked building.

  Expected: every voice line as specified, no console errors, nothing off-screen.
- [ ] **Step 3: Update the roadmap.**
  - Add a "Done" entry for the grown town, the map and the bicycle.
  - Record the checkpoint numbers.
  - Remove "a growth plan for the town" from "Left for later".
  - Add the iPad checks: a ride with a finger stop, the frame rate on the longest ride, and the map at portrait size.
- [ ] **Step 4: Commit.**
  `docs: the grown town in the roadmap`
