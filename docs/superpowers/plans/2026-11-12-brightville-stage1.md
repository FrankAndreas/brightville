# Brightville Stage 1 (Tiny Town, Yoga, Stars) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A child walks a wobbly character around a small 3D square, enters the Yoga Studio, holds three camera-checked poses and earns Stars that are saved.

**Architecture:** One Vite web app. Pure logic lives in `src/core` (no browser APIs, fully unit-tested). The 3D town (`src/city`, Three.js + Rapier) and each building (`src/buildings/<id>`, a Vue component) know each other only through a small contract: the town reports "door entered", the building reports `{ stars }` when finished. `App.vue` switches between the two.

**Tech Stack:** TypeScript, Vite, Vue 3, Pinia, Vitest (jsdom), ESLint, Three.js, `@dimforge/rapier3d-compat`, `@mediapipe/tasks-vision`.

**Spec:** `docs/superpowers/specs/2026-11-12-brightville-stage1-design.md`

## Global Constraints

- Node 22 or later. Use the current stable release of every dependency.
- All text and voice shown to the child is German (`de-DE`). Code, comments, commit messages and documents are English.
- No screen may require reading: icons, colours and voice only.
- Nothing is loaded from a CDN at run time. The pose model and WebAssembly files are served from `public/mediapipe/`.
- Camera frames are never stored, logged or sent anywhere.
- `src/core` imports nothing from `city`, `buildings`, `services`, `input`, Vue, Three.js or the DOM.
- The town reads input only through `IntentSource`, never from keyboard events.
- Saving goes only through `SaveStore`.
- A wrong or failed attempt never removes Stars.
- The town is built from shapes made in code; no downloaded art.
- Every task ends with `npm test`, `npm run lint` and `npm run build` passing.

## Review Focus

1. **Damaged or foreign save data** in local storage (not JSON, wrong shape, negative or fractional Stars, a newer version): the game starts with 0 Stars and does not crash. Tested in Task 2.
2. **Camera refused, missing, or unplugged mid-session:** the studio shows the "no camera" screen and Enter or Esc leads back to the square; Stars already earned in this visit are kept. Tested in Tasks 9 and 11.
3. **Child steps out of the picture during a pose** (no body found, or only part of it): the ring drains slowly, nothing throws, and after 30 seconds the next pose starts. Tested in Task 9.
4. **Keys held while focus is lost** (entering a building, switching tabs): the character does not keep walking on its own afterwards. Tested in Task 4.
5. **Leaving the studio with Esc mid-pose:** the camera is switched off (its light goes out), the tracker is closed, and the town resumes. Tested in Task 11.

Also pinned: a long pause between frames (hidden tab) must not fling the character through walls; the frame time is clamped (Task 5).

---

## File Structure

```
index.html
package.json  vite.config.ts  tsconfig.json  eslint.config.js  .gitignore  README.md
scripts/fetch-pose-assets.mjs      Copies MediaPipe wasm, downloads the pose model if missing
public/mediapipe/                  pose_landmarker_lite.task (committed), wasm/ (git-ignored, copied on install)
src/
  main.ts  App.vue
  core/
    save.ts                        SaveData, parseSave, serializeSave
    pose/body.ts                   Body type, bodyFromLandmarks, isBodyVisible
    pose/geometry.ts               angleDeg, shoulderWidth, mid
    pose/poses.ts                  PoseId, POSES, matchPose
    pose/fixtures.ts               Synthetic bodies for tests and for the dev preview
    pose/hold.ts                   createHold (ring fill, drain, timeout)
    pose/calibration.ts            createCalibration
  input/intents.ts                 Intents, IntentSource, keyboardIntents
  services/
    storage.ts                     SaveStore, localSaveStore
    tts.ts  sound.ts               Ported from ../kids-games/src/services
    device.ts                      detectDevice
    camera.ts                      openCamera, closeCamera, CameraError
    poseTracker.ts                 createPoseTracker
  stores/player.ts                 Pinia: stars, award
  components/
    StartGate.vue  StarCounter.vue  DoorPrompt.vue  Confetti.vue
  buildings/
    types.ts  registry.ts
    yoga/flow.ts                   Pure state machine of one studio visit
    yoga/YogaStudio.vue  yoga/YogaTeacher.vue  yoga/HoldRing.vue
  city/
    spring.ts  movement.ts  tumble.ts  doors.ts  frame.ts     Pure helpers
    world.ts  character.ts  blob.ts  props.ts  followCamera.ts  Three.js + Rapier
    city.ts                        createCity
    CityView.vue
```

Tests sit next to their file as `<name>.test.ts`.

---

### Task 1: Project scaffold and start gate

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `eslint.config.js`, `.gitignore`, `index.html`, `src/main.ts`, `src/App.vue`, `src/components/StartGate.vue`
- Test: `src/App.test.ts`

**Interfaces:**
- Produces: npm scripts `dev`, `build` (runs `vue-tsc --noEmit` then `vite build`), `test` (`vitest run`), `lint`. Vitest environment `jsdom`. Path alias `@` → `src`.
- Produces: `StartGate.vue` emits `start` on the first pointer press or key press. It shows one large "play" picture, no text.
- Produces: `App.vue` shows `StartGate` until `start`, then the game area (`<main data-test="game">`).

- [ ] **Step 1: Scaffold** with `npm create vite@latest . -- --template vue-ts`, add `pinia`, `vitest`, `jsdom`, `@vue/test-utils`, `eslint`, `typescript-eslint`, `eslint-plugin-vue`. `.gitignore`: `node_modules`, `dist`, `public/mediapipe/wasm`. `index.html`: `lang="de"`, title "Brightville", viewport that disables zoom.

- [ ] **Step 2: Write the failing test** in `src/App.test.ts`

```ts
it('shows the start gate first and the game after a key press', async () => {
  const w = mount(App, { global: { plugins: [createPinia()] } })
  expect(w.find('[data-test="start-gate"]').exists()).toBe(true)
  expect(w.find('[data-test="game"]').exists()).toBe(false)
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
  await nextTick()
  expect(w.find('[data-test="game"]').exists()).toBe(true)
})
it('starts on a pointer press too', async () => { /* pointerdown on the gate → game shown */ })
```

- [ ] **Step 3: Run** `npm test` — expected: FAIL (no start gate).
- [ ] **Step 4: Implement** `StartGate.vue` and `App.vue`.
- [ ] **Step 5: Run** `npm test && npm run lint && npm run build` — expected: all pass.
- [ ] **Step 6: Commit** `chore: scaffold app with start gate` (include the gameplay document and `docs/`).

---

### Task 2: Stars and saving

**Files:**
- Create: `src/core/save.ts`, `src/services/storage.ts`, `src/stores/player.ts`, `src/components/StarCounter.vue`
- Modify: `src/App.vue` (show `StarCounter` in the game area)
- Test: `src/core/save.test.ts`, `src/services/storage.test.ts`, `src/stores/player.test.ts`

**Interfaces:**
- Produces:

```ts
// core/save.ts
export const SAVE_VERSION = 1
export interface SaveData { version: 1; stars: number }
export function emptySave(): SaveData                    // { version: 1, stars: 0 }
export function parseSave(raw: string | null): SaveData  // never throws
export function serializeSave(data: SaveData): string

// services/storage.ts
export interface SaveStore { load(): SaveData; save(data: SaveData): void }
export const SAVE_KEY = 'brightville.save'
export function localSaveStore(storage?: Storage): SaveStore  // save() swallows quota and access errors

// stores/player.ts
export const usePlayerStore: // state { stars: number }, actions init(store: SaveStore), award(count: number)
```

- `award` ignores counts that are not positive whole numbers, and saves after every change.
- `StarCounter.vue`: a star picture and the number, `data-test="stars"`, `aria-label="Sterne"`.

- [ ] **Step 1: Write the failing tests**

```ts
// save.test.ts
it.each([null, '', 'not json', '[]', '{"version":1}', '{"version":1,"stars":-4}',
         '{"version":1,"stars":2.5}', '{"version":1,"stars":"7"}', '{"version":2,"stars":9}'])
  ('falls back to an empty save for %s', raw => expect(parseSave(raw)).toEqual({ version: 1, stars: 0 }))
it('round-trips', () => expect(parseSave(serializeSave({ version: 1, stars: 12 }))).toEqual({ version: 1, stars: 12 }))

// storage.test.ts
it('loads what it saved under brightville.save', ...)
it('does not throw when setItem throws', ...)
it('does not throw when getItem throws and returns an empty save', ...)

// player.test.ts
it('starts from the store and saves each award', ...)   // init with stars 5, award(3) → stars 8, store.save called with stars 8
it.each([0, -1, 1.5, NaN])('ignores award(%s)', ...)
```

- [ ] **Step 2: Run** `npm test` — expected: FAIL (modules missing).
- [ ] **Step 3: Implement** the three modules and `StarCounter.vue`; call `init(localSaveStore())` in `main.ts`.
- [ ] **Step 4: Run** `npm test && npm run lint && npm run build` — expected: pass.
- [ ] **Step 5: Commit** `feat: stars with local saving`

---

### Task 3: Voice and sound

**Files:**
- Create: `src/services/tts.ts`, `src/services/sound.ts`
- Modify: `src/App.vue` (on `start`: `unlockAudio()`)
- Test: `src/services/tts.test.ts`, `src/services/sound.test.ts`

**Interfaces:**
- Produces: `speak(text: string, lang = 'de-DE'): Promise<void>`, `stopSpeaking(): void`, `unlockAudio(): AudioContext | null`, `playBeat(kind: SoundKind): void` with `SoundKind = 'sparkle' | 'bell' | 'chime' | 'siren' | 'piano' | 'drum'`.

- [ ] **Step 1: Port** `../kids-games/src/services/tts.js`, `sound.js` and their tests to TypeScript. Keep behaviour and comments; drop `playBeats` and its tests (unused here).
- [ ] **Step 2: Run** `npm test` — expected: ported tests pass; both functions are silent no-ops when the browser API is missing.
- [ ] **Step 3: Add to `App.test.ts`:** starting the game calls `unlockAudio` once (mock the module).
- [ ] **Step 4: Run** `npm test && npm run lint && npm run build` — expected: pass.
- [ ] **Step 5: Commit** `feat: voice and sound services from Spielzeugkiste`

---

### Task 4: Input intents

**Files:**
- Create: `src/input/intents.ts`
- Test: `src/input/intents.test.ts`

**Interfaces:**
- Produces:

```ts
export interface Intents {
  moveX: number      // -1 left … 1 right
  moveZ: number      // -1 away from the camera … 1 towards it
  jump: boolean      // true in one read() per key press
  interact: boolean  // true in one read() per key press
  leave: boolean     // true in one read() per key press
}
export interface IntentSource { read(): Intents; dispose(): void }
export function keyboardIntents(target?: Window): IntentSource
```

- Keys: move = arrow keys and W A S D; jump = Space; interact = Enter and E; leave = Escape. Match on `event.code`. Call `preventDefault` for arrows and Space so the page does not scroll.

- [ ] **Step 1: Write the failing tests**

```ts
it('maps arrows and WASD to a move vector', ...)            // ArrowLeft → moveX -1; KeyD → moveX 1; ArrowUp → moveZ -1
it('cancels opposite keys', ...)                           // ArrowLeft + ArrowRight → moveX 0
it('reports jump once per press, not while held', ...)      // keydown Space → read().jump true, next read() false; key repeat events stay false
it('reports interact for Enter and for KeyE', ...)
it('reports leave for Escape', ...)
it('forgets held keys when the window loses focus', ...)    // keydown ArrowLeft, dispatch blur → moveX 0
it('forgets held keys when the page is hidden', ...)        // visibilitychange with document.hidden true
it('stops listening after dispose', ...)
```

- [ ] **Step 2: Run** `npm test` — expected: FAIL.
- [ ] **Step 3: Implement** `keyboardIntents`.
- [ ] **Step 4: Run** `npm test && npm run lint` — expected: pass.
- [ ] **Step 5: Commit** `feat: keyboard intents`

---

### Task 5: Town logic without graphics

**Files:**
- Create: `src/city/spring.ts`, `src/city/movement.ts`, `src/city/tumble.ts`, `src/city/doors.ts`, `src/city/frame.ts`
- Test: one `.test.ts` beside each

**Interfaces:**
- Produces:

```ts
// spring.ts — damped spring used for squash, lean and arm swing
export interface Spring { value: number; velocity: number }
export function stepSpring(s: Spring, target: number, stiffness: number, damping: number, dt: number): Spring

// movement.ts
export const WALK_SPEED = 4          // metres per second
export const JUMP_SPEED = 5          // metres per second upwards, about 1.2 m high
export function desiredVelocity(i: Pick<Intents, 'moveX' | 'moveZ'>): { x: number; z: number }  // length ≤ WALK_SPEED

// tumble.ts
export const TUMBLE_MS = 1500
export const TUMBLE_IMPACT_SPEED = 6 // metres per second lost in one step
export const TUMBLE_FALL_HEIGHT = 2.5
export function shouldTumble(impactSpeed: number, fallHeight: number): boolean

// doors.ts
export interface DoorDef { id: string; x: number; z: number; open: boolean }
export const DOOR_RADIUS = 2.5
export function nearestDoor(pos: { x: number; z: number }, doors: DoorDef[]): DoorDef | null  // nearest within DOOR_RADIUS, open or closed

// frame.ts
export const MAX_FRAME_S = 0.05
export function clampFrame(dtSeconds: number): number  // 0 for negative or NaN, at most MAX_FRAME_S
```

- [ ] **Step 1: Write the failing tests**

```ts
// spring: settles on the target (after 300 steps of 1/60 s, |value - target| < 0.01); overshoots first with low damping; dt 0 changes nothing
// movement: diagonal input has length WALK_SPEED, not WALK_SPEED * √2; zero input → zero
// tumble: (6.1, 0) → true; (5.9, 0) → false; (0, 2.6) → true; (0, 2.4) → false
// doors: null when none within 2.5; the nearer of two; a closed door is still returned
// frame: clampFrame(1) === 0.05; clampFrame(-1) === 0; clampFrame(NaN) === 0; clampFrame(0.016) === 0.016
```

- [ ] **Step 2: Run** `npm test` — expected: FAIL.
- [ ] **Step 3: Implement** the five modules. `stepSpring` uses semi-implicit Euler.
- [ ] **Step 4: Run** `npm test && npm run lint` — expected: pass.
- [ ] **Step 5: Commit** `feat: town movement helpers`

---

### Task 6: The town on screen

**Files:**
- Create: `src/city/world.ts`, `src/city/character.ts`, `src/city/blob.ts`, `src/city/props.ts`, `src/city/followCamera.ts`, `src/city/city.ts`, `src/city/CityView.vue`
- Modify: `src/App.vue` (show `CityView` in the game area)
- Test: `src/city/CityView.test.ts`

**Interfaces:**
- Consumes: `IntentSource`, `keyboardIntents` (Task 4); everything from Task 5.
- Produces:

```ts
// city.ts
export interface CityOptions {
  canvas: HTMLCanvasElement
  intents: IntentSource
  doors: DoorDef[]
  onNearDoor(id: string | null): void   // called when the nearest door changes
  onEnter(id: string): void             // interact pressed at an open door
}
export interface City { pause(): void; resume(): void; dispose(): void }
export function createCity(opts: CityOptions): Promise<City>
```

- `CityView.vue`: props `doors: DoorDef[]`, `paused: boolean`; emits `near-door` (id or null) and `enter` (id). It creates `keyboardIntents()` and the city on mount, calls `pause()`/`resume()` when `paused` changes, and disposes both on unmount.

**What to build (values from the spec, the rest tuned by feel):**
- Ground 40 × 40 m, pastel green; a wall 1.2 m high around it; soft directional light with shadows; sky-coloured background.
- Three plain houses as scenery (boxes with a roof) and the Yoga Studio: a larger house with a round sign above the door showing a figure with raised arms, and a door frame that glows when the door is open and is grey when closed. Door positions come from `opts.doors`.
- Character: Rapier kinematic character controller on a capsule (radius 0.4, total height 1.2); horizontal speed from `desiredVelocity`, gravity and `JUMP_SPEED` for jumping; turns to face its direction of travel.
- Blob: a sphere body with two eyes and two short arms. Squash and stretch on jump and landing, lean into acceleration, arms swinging behind the motion, each driven by `stepSpring`.
- Tumble: when `shouldTumble` is true, replace the controller for `TUMBLE_MS` with a free dynamic ball that rolls, ignore movement input, then stand the character up where the ball ended.
- Props: five balls of different sizes (dynamic bodies the character pushes) and one trampoline, a round pad that launches the character to about 4 m.
- Camera: fixed offset `(0, 6, 9)` from the character, looking at it, following smoothly. No player control.
- Each frame: `clampFrame`, read intents once, step physics, update visuals, render. `pause()` stops the loop and ignores intents; `resume()` restarts it without a time jump.
- Resize with the window; cap the pixel ratio at 2.

- [ ] **Step 1: Write the failing test** `CityView.test.ts` with `city.ts` mocked:

```ts
it('creates the city with the given doors and disposes it on unmount', ...)
it('pauses and resumes when the paused prop changes', ...)
it('emits near-door and enter from the city callbacks', ...)
```

- [ ] **Step 2: Run** `npm test` — expected: FAIL.
- [ ] **Step 3: Implement** the files above. Add `three` and `@dimforge/rapier3d-compat`.
- [ ] **Step 4: Run** `npm test && npm run lint && npm run build` — expected: pass.
- [ ] **Step 5: Check in the browser** (`npm run dev`, `http://localhost:5173`): after the start gate the character walks with arrows and WASD, jumps with Space, cannot leave the square, pushes balls, bounces on the trampoline and tumbles after the bounce, then stands up. Steady 60 frames per second in the browser's performance view. Switching to another tab for ten seconds and back leaves the character where it was.
- [ ] **Step 6: Commit** `feat: tiny town with wobbly character`

---

### Task 7: Building contract and door flow

**Files:**
- Create: `src/buildings/types.ts`, `src/buildings/registry.ts`, `src/services/device.ts`, `src/components/DoorPrompt.vue`
- Modify: `src/App.vue`
- Test: `src/buildings/registry.test.ts`, `src/services/device.test.ts`, extend `src/App.test.ts`

**Interfaces:**
- Consumes: `CityView` (Task 6), `usePlayerStore().award` (Task 2), `speak` (Task 3).
- Produces:

```ts
// buildings/types.ts
export type Need = 'camera' | 'touch' | 'keyboard'
export interface BuildingResult { stars: number }
export interface BuildingDef {
  id: string
  spokenName: string            // German, spoken at the door
  icon: string                  // emoji shown in the door prompt
  needs: Need[]
  door: { x: number; z: number }
  component: Component          // emits 'finished' with a BuildingResult
}

// services/device.ts
export interface DeviceCaps { camera: boolean; touch: boolean; keyboard: boolean }
export function detectDevice(): DeviceCaps
// camera: navigator.mediaDevices?.getUserMedia exists; touch: navigator.maxTouchPoints > 0; keyboard: matchMedia('(any-hover: hover)').matches

// buildings/registry.ts
export const BUILDINGS: BuildingDef[]                      // empty until Task 11
export function canServe(b: BuildingDef, d: DeviceCaps): boolean
export function toDoors(buildings: BuildingDef[], d: DeviceCaps): DoorDef[]   // open = canServe
```

- `App.vue` behaviour: when `near-door` names a building, show `DoorPrompt` (the building's icon and a picture of the Enter key; a crossed-out icon when the door is closed) and speak its `spokenName` once per approach. On `enter`, pause the town and show the building's component full-screen. On its `finished`, call `award(result.stars)`, hide it and resume the town. `App.vue` accepts an optional `buildings` prop (default `BUILDINGS`) so tests can pass a stub.

- [ ] **Step 1: Write the failing tests**

```ts
// registry: canServe is true only when every need is met; toDoors marks a camera building closed without a camera
// device: reads the three browser signals (stub navigator and matchMedia)
// App (CityView stubbed, one stub building that emits finished { stars: 9 }):
it('speaks the name and shows the prompt near a door', ...)
it('opens the building on enter and pauses the town', ...)
it('awards the stars and returns to the town when the building finishes', ...)   // stars counter shows 9, paused false
it('awards nothing for { stars: 0 }', ...)
```

- [ ] **Step 2: Run** `npm test` — expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run lint && npm run build` — expected: pass.
- [ ] **Step 5: Commit** `feat: building contract and door flow`

---

### Task 8: Pose rules

**Files:**
- Create: `src/core/pose/body.ts`, `src/core/pose/geometry.ts`, `src/core/pose/poses.ts`, `src/core/pose/fixtures.ts`
- Test: `src/core/pose/body.test.ts`, `src/core/pose/poses.test.ts`

**Interfaces:**
- Produces:

```ts
// body.ts — image coordinates: x to the right, y downwards, both 0…1
export interface Point { x: number; y: number; visibility: number }
export type Joint = 'nose' | 'lShoulder' | 'rShoulder' | 'lElbow' | 'rElbow' | 'lWrist' | 'rWrist'
                  | 'lHip' | 'rHip' | 'lKnee' | 'rKnee' | 'lAnkle' | 'rAnkle'
export type Body = Record<Joint, Point>
export function bodyFromLandmarks(l: { x: number; y: number; visibility?: number }[]): Body | null
// MediaPipe indices: nose 0, shoulders 11/12, elbows 13/14, wrists 15/16, hips 23/24, knees 25/26, ankles 27/28. null if fewer than 29 points.
export const MIN_VISIBILITY = 0.6
export function isBodyVisible(b: Body): boolean   // nose, both shoulders, both hips, both knees ≥ MIN_VISIBILITY

// geometry.ts
export function angleDeg(a: Point, b: Point, c: Point): number   // angle at b, 0…180
export function mid(a: Point, b: Point): Point
export function shoulderWidth(b: Body): number

// poses.ts
export type PoseId = 'stern' | 'riese' | 'baum' | 'frosch' | 'flieger'
export interface PoseDef { id: PoseId; voice: string; matches(b: Body): boolean }
export const POSES: PoseDef[]
export function matchPose(id: PoseId, b: Body): boolean   // false when a joint the rule uses is below MIN_VISIBILITY

// fixtures.ts
export function standing(): Body                       // arms hanging, feet together, all visibility 1
export const FIXTURES: Record<PoseId, Body>            // one clear example per pose, built from standing()
export function mirrored(b: Body): Body                // x → 1 - x and left/right swapped
```

**The rules.** All distances are in shoulder widths (`sw`), so they hold at any distance from the camera. Starting values; loosen only if the browser check in Task 11 shows a pose is hard to hit.

| Pose | Voice (exact) | Rule |
|---|---|---|
| `stern` | `Mach einen Stern!` | Both elbows straighter than 150°. Each wrist within 0.5 sw of its shoulder's height and more than 0.9 sw outside it. Ankles more than 1.5 sw apart. The line between the wrists is tilted less than 12°. |
| `riese` | `Mach dich gross wie ein Riese!` | Both wrists above the nose. Ankles less than 0.8 sw apart. Ankles differ in height by less than 0.3 sw. |
| `baum` | `Steh wie ein Baum!` | Ankles differ in height by more than 0.5 sw. Either both wrists above the shoulders, or wrists less than 0.4 sw apart. Hips more than 0.8 sw above the lower knee (not squatting). |
| `frosch` | `Hock dich hin wie ein Frosch!` | Middle of the hips less than 0.5 sw above the middle of the knees. Both wrists below the hips. |
| `flieger` | `Flieg wie ein Flugzeug!` | Both elbows straighter than 150°. Wrists more than 2.5 sw apart. The line between the wrists is tilted 20° or more. |

- [ ] **Step 1: Write the failing tests**

```ts
// body.test.ts
it('maps MediaPipe indices to joints', ...)             // landmark 15 becomes lWrist, 28 becomes rAnkle
it('returns null for fewer than 29 landmarks', ...)
it('treats a missing visibility as 0', ...)
it('isBodyVisible is false when a knee is below 0.6', ...)

// poses.test.ts
const ids: PoseId[] = ['stern', 'riese', 'baum', 'frosch', 'flieger']
it.each(ids)('%s matches its own fixture and no other', id => {
  for (const other of ids) expect(matchPose(id, FIXTURES[other])).toBe(id === other)
})
it.each(ids)('%s also matches mirrored', id => expect(matchPose(id, mirrored(FIXTURES[id]))).toBe(true))
it.each(ids)('%s does not match plain standing', id => expect(matchPose(id, standing())).toBe(false))
it.each(ids)('%s holds at half the size', ...)          // scale the fixture by 0.5 around its centre
it('does not match when a needed joint is hidden', ...) // stern fixture with lWrist visibility 0.1 → false
it('has the exact voice lines', ...)                    // the five strings from the table
```

- [ ] **Step 2: Run** `npm test` — expected: FAIL.
- [ ] **Step 3: Implement** the four modules.
- [ ] **Step 4: Run** `npm test && npm run lint` — expected: pass.
- [ ] **Step 5: Commit** `feat: yoga pose rules`

---

### Task 9: One studio visit as a state machine

**Files:**
- Create: `src/core/pose/hold.ts`, `src/core/pose/calibration.ts`, `src/buildings/yoga/flow.ts`
- Test: one `.test.ts` beside each

**Interfaces:**
- Consumes: `Body`, `isBodyVisible`, `PoseId`, `POSES`, `matchPose` (Task 8).
- Produces:

```ts
// hold.ts
export const HOLD_MS = 5000
export const DRAIN_FACTOR = 0.5      // the ring empties at half the speed it fills
export const POSE_TIMEOUT_MS = 30000
export interface Hold { update(matching: boolean, dtMs: number): { progress: number; status: 'holding' | 'done' | 'timeout' } }
export function createHold(): Hold   // progress 0…1; 'done' wins over 'timeout' in the same update

// calibration.ts
export const CALIBRATION_MS = 1000
export interface Calibration { update(visible: boolean, dtMs: number): boolean }  // true once visible for 1000 ms without a gap
export function createCalibration(): Calibration

// buildings/yoga/flow.ts
export const POSES_PER_VISIT = 3
export const STARS_PER_POSE = 3
export function pickPoses(random?: () => number): PoseId[]   // 3 different poses
export type YogaPhase = 'starting' | 'noCamera' | 'calibrating' | 'posing' | 'done'
export interface YogaState { phase: YogaPhase; pose: PoseId | null; poseNumber: number; progress: number; bodyVisible: boolean; stars: number }
export type YogaEvent =
  | { type: 'cameraReady' }
  | { type: 'cameraFailed' }                 // refused, missing, or lost later
  | { type: 'frame'; body: Body | null; dtMs: number }
export type YogaEffect =
  | { type: 'speak'; text: string }
  | { type: 'chime' }
  | { type: 'confetti' }
export interface YogaFlow { readonly state: YogaState; send(e: YogaEvent): YogaEffect[] }
export function createYogaFlow(poses: PoseId[]): YogaFlow
```

**Behaviour:**
- `starting` → `cameraReady` → `calibrating`, effect speak `Stell dich so hin, dass ich dich ganz sehe!`
- `starting`, `calibrating` or `posing` → `cameraFailed` → `noCamera`, effect speak `Ich finde keine Kamera.` `stars` keeps its value.
- `calibrating`: frames feed the calibration; once it is true → `posing` with the first pose, effect speak that pose's voice line.
- `posing`: frames feed the hold with `body !== null && matchPose(pose, body)`. On `done`: `stars += 3`, effect chime, then the next pose (speak its line) or, after the last, `done` with effects confetti and speak `Super gemacht!` On `timeout`: next pose with no chime and no Stars; after the last, `done`.
- `done` and `noCamera` ignore every event.
- `state.bodyVisible` follows `isBodyVisible` of the latest frame.

- [ ] **Step 1: Write the failing tests**

```ts
// hold.test.ts
it('is done after 5000 ms of matching', ...)
it('drains at half speed and never below 0', ...)        // 2000 ms on, 2000 ms off → progress 0.2; 10000 ms off → 0
it('does not reset when the pose is lost for a moment', ...)
it('times out after 30000 ms without finishing', ...)
it('reports done, not timeout, when both happen in one update', ...)

// calibration.test.ts
it('needs 1000 ms without a gap', ...)                   // 900 on, 100 off, 900 on → false; then 100 on → true

// flow.test.ts
it('pickPoses returns 3 different known poses', ...)
it('goes through calibration, three poses and ends with 9 stars', ...)
it('speaks each pose line once', ...)
it('gives no stars for a pose that times out and moves on', ...)
it('survives frames with no body', ...)                  // body: null for 31 s in posing → next pose, no throw
it('camera failure during a pose keeps earned stars', ...) // one pose done, then cameraFailed → phase noCamera, stars 3
it('ignores events after done', ...)
```

- [ ] **Step 2: Run** `npm test` — expected: FAIL.
- [ ] **Step 3: Implement** the three modules.
- [ ] **Step 4: Run** `npm test && npm run lint` — expected: pass.
- [ ] **Step 5: Commit** `feat: yoga visit flow`

---

### Task 10: Camera and body tracking

**Files:**
- Create: `src/services/camera.ts`, `src/services/poseTracker.ts`, `scripts/fetch-pose-assets.mjs`, `public/mediapipe/pose_landmarker_lite.task`
- Modify: `package.json` (`postinstall` runs the script)
- Test: `src/services/camera.test.ts`

**Interfaces:**
- Consumes: `Body`, `bodyFromLandmarks` (Task 8).
- Produces:

```ts
// camera.ts
export class CameraError extends Error { reason: 'denied' | 'missing' }
export function openCamera(): Promise<MediaStream>
// getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false })
// NotAllowedError and SecurityError → 'denied'; anything else, or no mediaDevices → 'missing'
export function closeCamera(stream: MediaStream): void   // stops every track
export function onCameraLost(stream: MediaStream, cb: () => void): void   // the video track's 'ended' event

// poseTracker.ts
export interface PoseTracker { detect(video: HTMLVideoElement, timeMs: number): Body | null; close(): void }
export function createPoseTracker(): Promise<PoseTracker>
// FilesetResolver.forVisionTasks('/mediapipe/wasm'); PoseLandmarker with modelAssetPath '/mediapipe/pose_landmarker_lite.task',
// runningMode 'VIDEO', numPoses 1. Try delegate 'GPU', fall back to 'CPU' if creation fails.
```

- `scripts/fetch-pose-assets.mjs`: copies `node_modules/@mediapipe/tasks-vision/wasm/*` to `public/mediapipe/wasm/`. If the model file is missing it downloads `https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task`. The model is committed so a fresh checkout works offline; the wasm folder is git-ignored and recreated on install. If the download fails the script prints the URL and the target path and exits with an error.

- [ ] **Step 1: Write the failing tests** `camera.test.ts`

```ts
it('asks for video only, no audio', ...)
it('throws CameraError denied for NotAllowedError', ...)
it('throws CameraError missing for NotFoundError', ...)
it('throws CameraError missing when mediaDevices does not exist', ...)
it('closeCamera stops every track', ...)
it('onCameraLost fires when the video track ends', ...)
```

- [ ] **Step 2: Run** `npm test` — expected: FAIL.
- [ ] **Step 3: Implement** `camera.ts`, `poseTracker.ts` and the script. Add `@mediapipe/tasks-vision`. Run `npm install` to fetch the assets.
- [ ] **Step 4: Run** `npm test && npm run lint && npm run build` — expected: pass; `dist/mediapipe/` contains the model and the wasm files.
- [ ] **Step 5: Commit** `feat: camera and pose tracking services`

---

### Task 11: The Yoga Studio

**Files:**
- Create: `src/buildings/yoga/YogaStudio.vue`, `src/buildings/yoga/YogaTeacher.vue`, `src/buildings/yoga/HoldRing.vue`, `src/components/Confetti.vue`, `README.md`
- Modify: `src/buildings/registry.ts`
- Test: `src/buildings/yoga/YogaStudio.test.ts`, extend `src/buildings/registry.test.ts`

**Interfaces:**
- Consumes: `createYogaFlow`, `pickPoses` (Task 9); `openCamera`, `closeCamera`, `onCameraLost`, `createPoseTracker` (Task 10); `speak`, `playBeat` (Task 3); `keyboardIntents` (Task 4); `FIXTURES` (Task 8) for drawing the teacher.
- Produces: `BUILDINGS` contains `{ id: 'yoga', spokenName: 'Yoga', icon: '🧘', needs: ['camera'], door: { x: 0, z: -14 }, component: YogaStudio }`.

**What to build:**
- `YogaStudio.vue` emits `finished` with `{ stars }`. On mount it opens the camera, then the tracker, then sends `cameraReady`; any failure sends `cameraFailed`. A `requestAnimationFrame` loop sends one `frame` event per new video frame and runs the returned effects: `speak` → `speak()`, `chime` → `playBeat('chime')`, `confetti` → show `Confetti`.
- Layout: calm single-colour room. Left: the child's camera picture, mirrored, with a body outline that is grey and turns green when `state.bodyVisible`. Right: `YogaTeacher` showing the current pose with `HoldRing` around it. Three dots at the top show which pose the child is on; when a pose is held, its dot bursts into three Stars. The Star counter itself goes up when the child is back on the square. No text anywhere.
- `YogaTeacher.vue`: prop `pose: PoseId | null`. Draws a friendly stick figure in SVG from the joints of `FIXTURES[pose]` (round head with a face, thick rounded limbs), so the teacher and the rules can never disagree.
- `HoldRing.vue`: prop `progress` 0…1, an SVG ring that fills clockwise.
- `noCamera` phase: a large crossed-out camera picture and a picture of the Enter key. Enter or Esc emits `finished`.
- `done` phase: confetti for 3 seconds, then emit `finished`.
- Esc at any time emits `finished` with the Stars earned so far.
- Before emitting and on unmount: stop the loop, `closeCamera`, `tracker.close()`, `stopSpeaking()`, dispose the intents.
- Development aid: in `import.meta.env.DEV`, pressing L logs the current `Body` as JSON to the console, so real examples can be added to the tests later. Nothing is logged otherwise.
- `README.md`: what the game is, how to run and test it, the controls table, where the spec and plan are, and that the camera needs HTTPS or `localhost`.

- [ ] **Step 1: Write the failing tests** `YogaStudio.test.ts` (camera, tracker, tts and sound modules mocked; frames driven by a fake tracker that returns queued bodies)

```ts
it('shows the no-camera screen when the camera is refused and leaves on Enter with 0 stars', ...)
it('shows the no-camera screen when the tracker cannot start', ...)
it('turns the outline green once the body is visible', ...)
it('finishes with 9 stars after three held poses', ...)           // fake timers; feed each pose's fixture for 5 s
it('leaves on Escape mid-pose with the stars earned so far', ...) // after one pose → finished { stars: 3 }
it('stops the camera and closes the tracker when leaving', ...)   // closeCamera and tracker.close called once
it('switches to no-camera when the camera is lost and keeps earned stars', ...)
it('renders no text nodes for the child', ...)                    // the root element's textContent is empty
// registry.test.ts
it('lists the yoga studio and needs a camera', ...)
```

- [ ] **Step 2: Run** `npm test` — expected: FAIL.
- [ ] **Step 3: Implement** the components and register the building.
- [ ] **Step 4: Run** `npm test && npm run lint && npm run build` — expected: pass.
- [ ] **Step 5: Walk through the spec's "What the child experiences" in the browser** (`npm run dev`), all seven steps, in front of the webcam. Then check:
  - Each of the five poses can be held by an adult; note any pose that needs more than three attempts and loosen its thresholds in `poses.ts` (keep the tests in Task 8 passing).
  - Refuse the camera permission: the no-camera screen appears and Enter leads back.
  - Press Esc mid-pose: the webcam light goes out and the town moves again.
  - Reload the page: the Star count is still there.
  - Pose tracking runs at 15 frames per second or more (log once in dev mode).
- [ ] **Step 6: Commit** `feat: yoga studio`
