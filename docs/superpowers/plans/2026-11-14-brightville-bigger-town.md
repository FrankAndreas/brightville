# Bigger Town Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Brightville's 62 m square into a 120 m town with streets, hills, a lake, detailed houses and life, with the 18 door buildings mixed through it, smooth on an iPad Air 4.

**Architecture:** The whole map is data in one pure module (`src/city/map.ts`: streets, lots, hills, lake, height function), checked by grid tests before anything is drawn. `world.ts` turns it into a heightfield, street ribbons, water and colliders. Houses come from a pure kit (box lists) merged into a few vertex-coloured meshes per area; repeated nature is instanced. Townsfolk, animals and boats are pure step functions with thin Three.js visuals and no physics.

**Tech Stack:** Vue 3, TypeScript, Three.js 0.187 (`three/examples/jsm/utils/BufferGeometryUtils.js`), Rapier 3D compat, Vitest (`// @vitest-environment node` for physics tests).

**Spec:** `docs/superpowers/specs/2026-11-14-brightville-bigger-town-design.md`

**Delivery:** three PRs from three branches, each a playable town:
- **Part A:** map, landscape, layout and camera (Tasks 1–5).
- **Part B:** houses and nature (Tasks 6–8).
- **Part C:** life (Tasks 9–11).

The design doc goes in with Part A. Each part ends with the Chrome check, README, a fresh opus reviewer and a PR; the next part branches from main after the merge.

## Global Constraints

- German voice and labels, English code; no CDN; models built from code.
- Walk speed stays 4 m/s (`movement.ts`); the character controller, wobbly, trampolines and door model (`DoorDef`, `nearestDoor`, `DOOR_RADIUS` 2.5) keep their behaviour.
- Door buildings: footprint 8 × 5 m, door 1 m in front (`doors.ts` `footprint`), quarter turns only (`side`).
- Daylight only. Fonts and buttons unchanged. Nothing from Trick or Clawd (figure, title art, bridge, fonts).
- Target: 60 fps on an iPad Air 4 (A14, 2360 × 1640), never below 30; at most 300 draw calls (`renderer.info.render.calls`) anywhere in the town.
- Townsfolk wear a random free look (`src/core/look`) and no outfit catalogue item.
- Tests: Vitest for TS, existing suite green after each task; `npx vue-tsc --noEmit`, `npx eslint .` clean.
- Never disturb the dev server on 8000/5173; check servers on 8017–8019 / 5186–5188, killed by PID.

## Review Focus

1. **The camera behind a house or inside a hill**, in a narrow street or after a turn. She must still see herself. → Task 4 test `pulls the camera in front of a house between it and her` and `keeps the camera above the ground on a hill`.
2. **A trampoline bounce or a jump carrying her over the lake barrier, the town edge, or onto a roof she can't get down from.** → Task 2 test `a bounce on every trampoline lands her on walkable ground`, and Task 1 keeps trampolines 8 m from the lake and the edge.
3. **Walking down a hill read as a fall** (tumble or `land` event) or as floating off the ground. → Task 2 physics test `walks over the highest hill and down without tumbling`.
4. **Something standing where she enters a door**, such as a townsperson, animal, tree, bench or lamp. → Task 7 and Task 9 tests keep everything ≥ `DOOR_RADIUS + 1` from every door spot.
5. **Memory and speed over many visits.** Going into buildings and back disposes and rebuilds the town. Merged geometries, instanced meshes and sprite textures must be freed, and the town must not slow down after ten trips. → Task 7 test `dispose frees every geometry and texture`, and the Chrome check in each part.

---

## Part A: Map, landscape, layout, camera (branch `feat/bigger-town`)

### Task 1: The map as data

**Files:**
- Create: `src/city/map.ts`, `src/city/map.test.ts`
- Modify: `src/buildings/registry.ts` (each `door` position and `side`), `src/buildings/registry.test.ts` (old square tests move to `map.test.ts`; the exact door positions in the `toMatchObject` checks go)
- Modify: `src/city/props.ts` (`TRAMPOLINES`, `BLOCKS`, `BALLS` positions)

**Interfaces:**
- Produces, all exported from `map.ts`:
  - `TOWN_HALF = 60`, `PLAZA = { x: 0, z: 0, radius: 8 }`, `START = { x: 0, z: 5 }`.
  - `interface Street { points: { x: number; z: number }[]; width: number }`; `STREETS: Street[]`.
  - `interface Hill { x: number; z: number; radius: number; height: number }`; `HILLS: Hill[]`.
  - `LAKE: { x: number; z: number; rx: number; rz: number }` (an ellipse).
  - `JETTY: Footprint`.
  - `EMPTY_LOTS: DoorSpot[]` (4).
  - `SCENERY_HOUSES: { x: number; z: number; w: number; d: number; floors: 1 | 2 | 3; facing: Side }[]`.
  - `heightAt(x: number, z: number): number` (0 on every flat area).
  - `isFlat(x, z): boolean`, `inLake(x, z): boolean`, `onStreet(x, z): boolean`.
  - `solidAreas(): Footprint[]`: every door building, scenery house and playground block.
  - `MAX_SLOPE_DEG = 20`.

- [ ] **Step 1: Write the failing map tests** in `map.test.ts`. Each one uses `BUILDINGS` from the registry and `TRAMPOLINES`/`BLOCKS` from props.
  - `keeps every house, lot and prop inside the town, 2 m from the edge`.
  - `keeps houses, lots and the playground from overlapping, with 1 m between`. The steps and platform touch each other as today.
  - `is flat under every house, lot, street, the plaza, the jetty and 3 m around each door spot`: `heightAt === 0` on a 0.5 m grid of each.
  - `has no slope steeper than MAX_SLOPE_DEG`: a finite difference of `heightAt` on a 0.5 m grid over the whole town.
  - `has at least one hill 3 m high or more`.
  - `reaches every door spot and every empty lot from START on foot`: a breadth-first walk on a 0.5 m grid over cells not in `solidAreas()`, not `inLake`, and inside `TOWN_HALF - 1`.
  - `keeps the lake closed`: every grid cell `inLake` is ≥ 3 m from every door spot, street, house and trampoline, except the jetty.
  - `mixes the buildings`: for each street, at most 3 of the learning buildings (`kind === 'earn'`) have their door within 6 m of it. The 4 play and 2 shop buildings are not all within 25 m of each other.
  - `puts Mein Haus within 20 m of START`.
  - `keeps every trampoline 8 m from the lake, the edge and every house, 4 m from every door` (Review Focus 2).
  - `faces every door onto a street or the plaza`: the door spot is within street width/2 + 1 m of a street, or on the plaza.

- [ ] **Step 2: Run** `npx vitest run src/city/map.test.ts`. Expected: FAIL, because `./map` is not found.

- [ ] **Step 3: Write `map.ts` and the new positions.**
  - Streets run from the plaza in four directions, with a ring road joining them about 30–35 m out and a few short lanes.
  - The lake sits in one corner, about 22 × 14 m in radius, with the jetty reaching in from the nearest street.
  - Hills go between the streets: 3–4 of them, 2–5 m high and 10–14 m in radius.
  - Hill shape: `heightAt` adds each hill as `height · smoothstep(1 − d/radius)` with the smoothstep squared, which keeps the edges gentle. It multiplies by 0 inside the flat areas plus a 4 m fade.
  - Place the 18 doors in `registry.ts` along the streets, mixed.
  - Place the 4 empty lots, 20–30 scenery houses, the playground (keep its shape, move it as a whole) and the trampolines and balls.
  - Rewrite the old square tests in `registry.test.ts`: overlap, the room before doors and the playground move to `map.test.ts`, and the `x/z` in the `toMatchObject` checks are dropped.

- [ ] **Step 4: Run** `npx vitest run src/city src/buildings`. Expected: PASS.

- [ ] **Step 5: Commit** `feat: the bigger town's map as data, the buildings mixed along its streets`.

### Task 2: Ground, streets, lake and edge from the map

**Files:**
- Modify: `src/city/world.ts`, `src/city/character.test.ts`, `src/city/character.ts` (`START` comes from `map.ts`)
- Create: `src/city/world.test.ts`

**Interfaces:**
- Consumes: everything from Task 1.
- Produces:
  - `buildTown(R, world, doors)`, with the same signature and the same `Town`. `HALF_SIZE` is removed from `world.ts`; users import `TOWN_HALF`.
  - The ground is a Rapier heightfield and a matching `PlaneGeometry`. Both are sampled from `heightAt` every 1 m.

- [ ] **Step 1: Write the failing tests.** All use `// @vitest-environment node` and real Rapier, with the `setup()` helper from `character.test.ts`.
  - `world.test.ts › rests a body on a hill at heightAt`: a character started at the top of the highest hill settles within 0.1 m of `heightAt + BODY_HEIGHT/2`.
  - `character.test.ts › walks over the highest hill and down without tumbling`: walk 25 m through the hill's middle. Expect no `tumble`, no `land` event with `impact`, and `grounded` in ≥ 90 % of frames.
  - `stops at the lake`: walk from the shore straight at the lake's middle for 5 s. The character stays outside `inLake`, except on the jetty.
  - `walks to the end of the jetty`.
  - `stops at the town's edge`: replaces the old square-wall test, using `TOWN_HALF`.
  - `a bounce on every trampoline lands her on walkable ground`: from each trampoline, jump with the stick held in each of 8 directions. After 3 s she is not `inLake`, is within `TOWN_HALF`, and has `y < 1.5 + heightAt`, so she is not left on a roof.

- [ ] **Step 2: Run** `npx vitest run src/city`. Expected: the new tests FAIL, because there is no hill, lake or jetty in the world yet.

- [ ] **Step 3: Build them in `world.ts`.**
  - Ground: `ColliderDesc.heightfield(n, n, heights, scale)`. Rapier's heightfield is column-major; check one corner in the test before trusting it.
  - Streets: a flat ribbon mesh per street at y 0.012, plus the plaza disc. Old per-door paths go.
  - Lake: a translucent blue ellipse at y 0.03 and a sandy shore ring. Around the ellipse, invisible cuboids 30 m high leave a gap for the jetty. The jetty is a wooden deck 0.25 m high on solid colliders, with invisible 30 m side walls along it.
  - Edge: a low hedge you see, with the 30 m barrier as today.
  - Scenery houses use today's `house()` until Part B.
  - Fog: `scene.fog = new THREE.Fog(sky, 55, 110)`.

- [ ] **Step 4: Run** `npx vitest run src/city src/buildings`. Expected: PASS, the whole suite.

- [ ] **Step 5: Commit** `feat: hills, streets, a lake with a jetty and a hedge round the bigger town`.

### Task 3: Signs everyone can see, 18 colours

**Files:** Modify `src/city/world.ts`; test in `src/city/world.test.ts`.

**Interfaces:**
- Produces:
  - `BUILDING_COLORS: [wall: number, roof: number][]`, with 18 pairs exported from `world.ts`, in registry order.
  - Signs become `THREE.Sprite`s 1.9 m wide, centred 1.2 m above the roof edge over the door. The 🔒 is a child sprite at the corner. The side-door bracket code goes.

- [ ] **Step 1: Failing tests.**
  - `gives every door building its own colour pair`: 18 pairs, none repeated, and the hue of each wall within 40° of today's pair at the same index modulo 12.
  - `shows each sign as a sprite above its door`: in `buildTown(...).scene`, one `Sprite` per door with an icon, with its x/z within 1 m of the door and above the house's height.

- [ ] **Step 2: Run** `npx vitest run src/city/world.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.** Warmer pairs, kept close to the old hues.

- [ ] **Step 4: Run** it again. Expected: PASS.

- [ ] **Step 5: Commit** `feat: door signs seen from every side, a colour of its own for each building`.

### Task 4: Camera, shadows and look-home in the bigger town

**Files:**
- Modify: `src/city/followCamera.ts`, `src/city/view.ts`, `src/city/city.ts`
- Tests: `src/city/followCamera.test.ts`, `src/city/view.test.ts`
- Create: `src/city/quality.ts`, `src/city/quality.test.ts`

**Interfaces:**
- Produces:
  - `follow(target, dt, snap?, yaw?, blocked?: (from: Vec3, to: Vec3) => number | null)`. `blocked` returns the distance to the first solid thing between the focus and the camera. `city.ts` passes a Rapier `castRay` against fixed colliders, excluding her own.
  - `createView().step(intents, dt, at?: { x: number; z: number })`.
  - `quality.ts`: `nextPixelRatio(current: number, avgFrameMs: number, max: number): number`.

- [ ] **Step 1: Failing tests.**
  - `pulls the camera in front of a house between it and her`: with `blocked` returning 4, the camera is ≤ 3.8 m from the focus, on the same line.
  - `keeps the camera above the ground on a hill`: with the target at y 4, the camera y ≥ 4 + 2 after settling.
  - `view › looks towards the plaza from anywhere`: at `(30, 0)` after `lookHome` and 1 s of steps, the yaw is within 0.05 of `atan2(30, 0)`.
  - `view › looks the old way on the plaza`: at `(0, 5)`, the yaw is 0.
  - `quality › drops to 1.5 when frames are slow, then 1, and never below 1`: 1.5 at an average of 25 ms. It never rises again in a visit (`nextPixelRatio(1, 10, 2) === 1`).

- [ ] **Step 2: Run** `npx vitest run src/city`. Expected: the new tests FAIL.

- [ ] **Step 3: Implement.**
  - Camera height: `focus.y` follows `target.y` fully, but at a slower rate while she is in the air, so jumps still don't shake the picture.
  - Shadows: the sun's shadow camera is ±22 m around her and moves with her, snapped to the texel grid. The map is 2048.
  - Pixel ratio: `city.ts` averages the frame time over 2 s and applies `nextPixelRatio` with `renderer.setPixelRatio` and a resize.

- [ ] **Step 4: Run** `npx vitest run src/city`. Expected: PASS.

- [ ] **Step 5: Commit** `feat: the camera keeps her in sight among houses and hills, look-home turns to the plaza`.

### Task 5: Check, document, review, PR

- [ ] **Chrome check.** Run a check server (8019 / 5188, scratchpad `DATA_DIR`), then use Playwright with Chrome.
  - Take screenshots from the plaza, from a street with the camera turned, on the hilltop and at the jetty.
  - Log `renderer.info.render.calls` and the frame time over 10 s with CPU throttling 4×. Expect ≤ 300 calls and no frame-time growth after 5 trips in and out of a building. If needed, expose this through the existing `window.__city` debug in DEV.
- [ ] **README:** rewrite the town paragraph and the "which side of the square" sentence on adding a building. Tick the roadmap item.
- [ ] Run the full suite, `vue-tsc` and `eslint`. Then a fresh opus reviewer on the branch. Fix Critical and Important, and the minors as Andreas asks. Then the PR `feat: a bigger town with streets, hills and a lake`.

## Part B: Houses and nature (branch `feat/town-houses`)

### Task 6: The house kit

**Files:** Create `src/city/houseKit.ts` and `src/city/houseKit.test.ts`.

**Interfaces:**
- Produces:
  - `interface Part { x: number; y: number; z: number; w: number; h: number; d: number; color: number; rotY?: number }`.
  - `houseParts(spec: { w: number; d: number; floors: 1 | 2 | 3; wall: number; roof: number; seed: number; door: boolean }): Part[]`. Parts are local to a house facing +z with its front at `z = d/2`.
  - Roof shapes come from stepped boxes or a gabled shape built from 2 rotated boxes.

- [ ] **Step 1: Failing tests.**
  - `puts windows on every floor of the front`: ≥ 2 windows per floor on the front for `w ≥ 5`.
  - `leaves the door opening free when door is true`: no part overlaps the box `x ∈ [-1.1, 1.1], y < 2.9, z > d/2 − 0.3`.
  - `stays within its footprint plus 0.6 m of awnings and balconies`.
  - `is the same for the same seed and different for another`: chimney, awning, balcony and flower boxes vary.
  - `has between 20 and 120 parts`.

- [ ] **Step 2: Run** `npx vitest run src/city/houseKit.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `houseParts`.** Seed a mulberry32 random from `seed`.

- [ ] **Step 4: Run** it again. Expected: PASS.

- [ ] **Step 5: Commit** `feat: a kit for detailed blocky houses`.

### Task 7: Merged houses in the town

**Files:**
- Create: `src/city/merge.ts`, `src/city/merge.test.ts`
- Modify: `src/city/world.ts`, `src/city/city.ts` (dispose)

**Interfaces:**
- Produces:
  - `mergeParts(parts: (Part & { at: Matrix4 })[], chunk = 30): THREE.Mesh[]`. Parts are grouped by the 30 m cell of their position, with one `BufferGeometry` per cell and one shared `MeshStandardMaterial({ vertexColors: true })`.
  - Door buildings and scenery houses all come from `houseParts`. The door frame, leaf, ring and sign stay separate meshes, so they can change colour.

- [ ] **Step 1: Failing tests.**
  - `merges a hundred houses into at most one mesh per 30 m cell`.
  - `keeps each part's colour in the vertex colours`.
  - `dispose frees every geometry and texture` (Review Focus 5): build the town in a test, dispose it through `createCity`'s dispose path (extract `disposeScene(scene)` into `world.ts` and test that), and count `dispose` calls with spies on `BufferGeometry.prototype.dispose` and `Texture.prototype.dispose`.

- [ ] **Step 2: Run** `npx vitest run src/city`. Expected: FAIL.

- [ ] **Step 3: Implement**, replacing `house()`. Colliders stay one cuboid per house footprint.

- [ ] **Step 4: Run** `npx vitest run src/city src/buildings`. Expected: PASS.

- [ ] **Step 5: Commit** `feat: the town's houses in detail, drawn in a few merged pieces`.

### Task 8: Trees, flowers, fences, lamps, benches

**Files:**
- Create: `src/city/nature.ts`, `src/city/nature.test.ts`
- Modify: `src/city/world.ts`

**Interfaces:**
- Produces:
  - `type Kind = 'tree' | 'bush' | 'flowers' | 'fence' | 'lamp' | 'bench'`.
  - `placeNature(seed: number): { kind: Kind; x: number; z: number; rotY: number; scale: number }[]`, which is pure and uses `map.ts`.
  - `buildNature(R, world, scene, items)` gives one `InstancedMesh` per kind and part. Tree trunks, lamps and benches get small cylinder or cuboid colliders; flowers and bushes get none.

- [ ] **Step 1: Failing tests.**
  - `places nothing on a street, the plaza, the jetty or in the lake`.
  - `keeps everything DOOR_RADIUS + 1 from every door spot and off every house and lot` (Review Focus 4).
  - `keeps every door reachable with the nature's colliders added`: rerun the Task 1 breadth-first walk with trunks, lamps and benches as solid.
  - `lines streets with lamps every 12–18 m`.
  - `puts flower beds by the lake and in gardens`.

- [ ] **Step 2: Run** `npx vitest run src/city/nature.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.** Trees go on the hills and along the lake, with the y of each item from `heightAt`.

- [ ] **Step 4: Run** `npx vitest run src/city src/buildings`. Expected: PASS.

- [ ] **Step 5: Commit** `feat: trees, flowers, fences, lamps and benches in the town`.

**Part B close:** the Chrome check as in Task 5 (≤ 300 calls, screenshots), the README, the reviewer and the PR `feat: detailed houses and nature in the town`.

## Part C: Life (branch `feat/town-life`)

### Task 9: Townsfolk

**Files:**
- Create: `src/city/walkers.ts`, `src/city/walkers.test.ts`
- Modify: `src/city/blob.ts` (option `{ detail: 'low' }`: spheres 12 × 8, no shadow casting), `src/city/city.ts`

**Interfaces:**
- Produces:
  - `ROUTES: { x: number; z: number }[][]`, with 6–8 closed loops on the streets.
  - `interface Walker { route: number; along: number; side: number; paused: number }`.
  - `stepWalker(w: Walker, her: { x: number; z: number }, dt: number): Walker` and `walkerAt(w): { x: number; z: number; heading: number }`. Speed is 1.2 m/s.
  - If she is within 1.6 m ahead, the walker slows to 0 and shifts `side` by up to 1 m away from her. It resumes once she is 2.5 m away.
  - `randomLook(rand): Look` uses only the free look fields, with no catalogue add-ons.

- [ ] **Step 1: Failing tests.**
  - `walks its loop and comes round again`.
  - `stops and steps aside when she stands in its way, and goes on when she leaves`.
  - `never comes towards her`: the distance to a stationary her never shrinks below 1.4 m.
  - `keeps every route DOOR_RADIUS + 1 from every door spot` (Review Focus 4).
  - `keeps every route on a street`: `onStreet` at every 0.5 m.
  - `dresses townsfolk only in the free look`: over 200 `randomLook` calls, no add-on id, every field from the look options.

- [ ] **Step 2: Run** `npx vitest run src/city/walkers.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement**, with low-detail blobs fed a `CharacterFrame` made from `walkerAt`, at y = `heightAt`.

- [ ] **Step 4: Run** `npx vitest run src/city`. Expected: PASS.

- [ ] **Step 5: Commit** `feat: townsfolk stroll the streets and step aside for her`.

### Task 10: Animals and boats

**Files:**
- Create: `src/city/animals.ts`, `src/city/animals.test.ts`
- Modify: `src/city/city.ts`

**Interfaces:**
- Produces:
  - `ducks(t)` and `boats(t)` give positions on loops inside the lake, with ≥ 2 m from the shore and the jetty.
  - `stepBird(b, her, dt)` is a state machine: hop → (her within 3 m) fly up and away 8 m → land → hop.
  - The cat sleeps on a wall with a breathing scale.
  - The dog wanders inside a fenced garden: `stepDog` clamps to the garden rectangle.
  - The models are block animals made with `houseParts`-style parts merged once per kind.

- [ ] **Step 1: Failing tests.**
  - `keeps ducks and boats on the water, 2 m from the shore and the jetty`.
  - `flies a bird away when she comes within 3 m, never towards her`.
  - `keeps the dog in its garden`.
  - `keeps every animal DOOR_RADIUS + 1 from every door spot`.

- [ ] **Step 2: Run** `npx vitest run src/city/animals.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run** `npx vitest run src/city`. Expected: PASS.

- [ ] **Step 5: Commit** `feat: ducks, boats, birds, a cat and a dog in the town`.

### Task 11: Check, document, review, PR

- [ ] Chrome check as in Task 5, with the townsfolk and animals moving: ≤ 300 calls, frame time at 4× throttling, and screenshots.
- [ ] README, then the reviewer, then the PR `feat: life in the town`.
- [ ] Ask Andreas to try each part on her iPad before merging it.
