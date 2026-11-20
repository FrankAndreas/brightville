# Spielwelt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new earning building, the Spielwelt: a wide 2D world to scroll, carry things in and drive a car through, with five position-word tasks on a sixth ladder, Raum, then free play.

**Architecture:** `raum` joins the ladder machinery. A pure world module (`src/core/world.ts`) holds the layout, the German phrases, where a dropped thing settles and which relations hold. A pure task module (`src/core/raum.ts`) makes a visit's tasks and examples and the setup moves. A pure flow (`src/buildings/spielwelt/flow.ts`) runs a visit. The screen (`Spielwelt.vue`) draws the world as one wide SVG, scrolls it, drags things, drives the car.

**Tech Stack:** Vue 3, Pinia, Vitest; FastAPI, pytest.

**Spec:** `docs/superpowers/specs/2026-11-20-brightville-spielwelt-design.md`

## Global Constraints

- World units: the view is 100 high; the world is `WORLD_WIDTH` = 900 wide and wraps around. Ground line y = 80 (y grows downwards); back lane feet at y = 74, front lane at y = 88.
- Every phrase is whole, correct German with articles and cases (dative for where something is, accusative for where it goes; "im" for "in dem"); pronouns ihn/sie/es.
- links neben / rechts neben are the screen's left/right, close to the object. Step 5: two clues to two objects that stand close; both must hold.
- Only a release near the task's object(s) (within 50 units) is judged; other set-downs pass silently.
- One arrangement per child in browser storage (`brightville.spielwelt.<id>`); a task moves only what it needs.
- Raum: window 10, misses 2, start 1; a visit: two finding + three placing tasks; 1 Star each + 5; `minSecondsPerStar` 2.
- After the tasks: free play until she leaves; no more Stars.
- Building: id `spielwelt`, spoken name `Spielwelt`, icon `🚗`, kind `earn`, needs `[]`, in a scenery house the map tests accept, near the playground.
- Overall number: seven shares; `KG_TARGETS.raum = 0.6` → mark 54. Tags `spielwelt: { codes: ['MA.2'], zugaenge: [4, 2] }`; `NOT_LOGGED = [9]`.
- The lessons of the earlier reviews (lit reset, 🔊 stops and forgets, sync on empty effects, no dead taps in examples, one fair answer).

## Review Focus

1. A thing that fits two words at once (on the bench and next to the tree): the task's word is checked; a miss sentence never contradicts what she sees. (Task 3 tests)
2. Wrap-around: a thing at x = 895 and an object at x = 5 are neighbours; scrolling past the end. (Task 3 tests, Task 6 test)
3. Saved arrangement broken or from an older layout: falls back to the start arrangement. (Task 6 test)
4. Dragging: a tap without a move doesn't throw a thing; a drag starting on the background scrolls; carrying to the edge scrolls. (Task 6 tests)
5. Things on/in the car move with it; a task's setup never puts a thing in the car while she drives. (Task 3/4 tests)

---

### Task 1: Server — Raum
- [ ] Failing tests in `tests/test_school.py` (state includes `raum`; 10 with 2 misses moves; only-Raum result; parent sets Raum) → implement (`WINDOW`, `MISSES_ALLOWED`, `SchoolResultsIn.raum`) → pytest, black, flake8, mypy → commit `feat: Raum, a sixth Lehrplan ladder on the server`.

### Task 2: App ladders and the parents' numbers
**Files:** `src/core/ladders.ts`, `src/core/lehrplan.ts` (`STEP_TEXT.raum`: `auf, unter, in`, `neben, vor, hinter`, `zwischen`, `links, rechts`, `zwei Angaben zusammen`, `fertig (Ende 2. Klasse)`; `KG_TARGETS.raum = 0.6`; `NOT_LOGGED = [9]`), `src/components/LehrplanOverview.vue` (Raum under Mathematik), fixtures and tests.
- [ ] Failing tests: Raum moves after 10/2; `startLadders` has it; a Spielwelt visit sends only Raum; overall over seven shares and `kgMark()` 54; `practice()` lists Zugang 4; overview row `ladder-raum` sets its step → implement → `npm test`, lint, typecheck → commit `feat: Raum in the app's ladders and the parents' overview`.

### Task 3: The world
**Files:** create `src/core/world.ts`, `src/core/world.test.ts`.
**Interfaces:**
```ts
export type Gender = 'm' | 'f' | 'n'
export interface WorldObject {
  id: string; noun: string; gender: Gender; emoji?: string
  x: number; w: number; h: number            // centre x, width, height above the ground line
  top: number                                // y of the surface things rest on (auf)
  under: boolean; container: boolean; lane: 'mid' // objects stand on the ground line
}
export interface Thing { id: string; noun: string; gender: Gender; emoji: string }
export interface Place { x: number; y: number; lane: 'back' | 'mid' | 'front'; on?: string; inside?: string; under?: string }
export type Arrangement = Record<string, Place>
export type Word = 'auf' | 'unter' | 'in' | 'neben' | 'vor' | 'hinter' | 'zwischen' | 'links neben' | 'rechts neben'
export interface Clue { word: Word; object: string; other?: string }   // other: the second object of zwischen
export const WORLD_WIDTH = 900, GROUND = 80
export const OBJECTS: WorldObject[]; export const THINGS: Thing[]; export const CAR: string
export function startArrangement(): Arrangement
export function settle(x: number, y: number, objects?: WorldObject[]): Place       // where a dropped thing comes to rest
export function holds(place: Place, clue: Clue, objects?: WorldObject[]): boolean
export function describe(thingId: string, place: Place): string                     // "Der Ball ist jetzt neben dem Bett."
export function placeFor(clue: Clue, objects?: WorldObject[]): Place                // a spot where the clue holds
export function nounPhrase(o: { noun: string; gender: Gender }, kase: 'nom' | 'acc' | 'dat'): string
export function prepPhrase(clue: Clue, kase: 'acc' | 'dat'): string                 // "auf das Bett", "im Schrank", "zwischen dem Baum und der Bank"
export const distance: (a: number, b: number) => number                             // around the wrap
```
Layout per the spec (house, garden, pond, playground, street with car and garage, meadow), objects ≥ 1 screen apart between places so steps 1–3 can stay on one screen. Things per the spec (no container things).
- [ ] Failing tests: every phrase for every object and word in both cases (spot checks: `auf das Bett`, `auf dem Bett`, `im Schrank`, `in den Schrank`, `in die Kiste`, `unter der Bank`, `zwischen dem Baum und der Bank`, `links neben den Baum`); `settle` puts a drop over a table's top on it, below the top within its width under it, inside a container in it, on the ground otherwise by lane; `holds` for each word, including vor/hinter by lane, and wrap-around neighbours; `placeFor` returns a place where `holds` is true for every clue the tasks can ask; `describe` names the closest object with the true word; `startArrangement` puts every thing on the ground, apart, settled.
- [ ] Implement → PASS → commit `feat: the Spielwelt's world and its relations`.

### Task 4: Tasks
**Files:** create `src/core/raum.ts`, `src/core/raum.test.ts`.
**Interfaces:**
```ts
export type RaumTask =
  | { type: 'find'; thing: string; clues: Clue[] }       // she taps the thing
  | { type: 'place'; thing: string; clues: Clue[] }      // she carries the thing there
export interface RaumExample { thing: string; lines: { text: string; place?: Place }[] }
export function buildRaumSession(step: number, random?: () => number): RaumTask[]   // [find, place, find, place, place] order mixed
export function setupFor(task: RaumTask, arrangement: Arrangement, viewX: number, step: number, random?: () => number): Arrangement
export function taskText(task: RaumTask): string     // "Leg den Ball auf das Bett." / "Die Katze ist unter dem Tisch. Findest du sie?"
export function exampleFor(step: number, windowLength: number): RaumExample | null
export const TWO_CLUES: [Clue, Clue][]               // step 5 pairs that can both hold
```
Steps per the spec's table. `setupFor`: a find task puts the thing at `placeFor(clues)`; a place task puts the thing on the ground on a spot where no clue already holds, on the same screen as the object at steps 1–3 (else near `viewX`). Never in the car.
- [ ] Failing tests: five tasks, two find, three place; words per step; step 5 tasks have two clues from `TWO_CLUES` and `placeFor` satisfies both; texts are whole sentences with the right pronoun; `setupFor` (find: clue holds; place: no clue holds yet; steps 1–3 same screen); examples null at 6 or window ≥ 10.
- [ ] Implement → PASS → commit `feat: the Spielwelt's tasks`.

### Task 5: Flow
**Files:** create `src/buildings/spielwelt/flow.ts`, `flow.test.ts`.
**Interfaces:**
```ts
export type RaumEffect =
  | { type: 'speak'; text: string; light?: string; ask?: boolean; again?: string }
  | { type: 'setup'; arrangement: Arrangement }       // the screen moves things to here (animated)
  | { type: 'show'; thing: string; place: Place }     // an example moves a thing
  | { type: 'chime' } | { type: 'confetti' } | { type: 'free' }   // free: free play begins
export interface RaumState { index; task; missed; solved; stars; results: { ladder: 'raum'; firstTry: boolean }[]; phase: 'example' | 'asking' | 'cheering' | 'free' }
export function createRaumFlow(tasks: RaumTask[], example: RaumExample | null, arrangement: () => Arrangement, viewX: () => number, step: number): {
  readonly state: RaumState; start(); exampleDone(); tapThing(id: string); released(id: string, place: Place); next()
}
```
Find: tap on the thing → chime, `Super! Da ist ${die Katze}!`; on another thing → `Das ist ${der Ball}. ${taskText}`, missed. Place: release of the task's thing near an object of the clues → holds all → chime + `Super!`; else `describe(...) Leg ${ihn} ${prep}.`, missed; elsewhere → nothing. After the last: confetti, `Super gemacht! Jetzt darfst du frei spielen.`, phase `free` (taps and releases do nothing more).
- [ ] Failing tests for each line above, the setup effect before each task, taps during example/cheer/free ignored, 10 Stars → implement → PASS → commit `feat: the Spielwelt's flow`.

### Task 6: Screen and town
**Files:** create `src/buildings/spielwelt/Spielwelt.vue` (+ `WorldScene.vue` for the drawing if it grows), `Spielwelt.test.ts`; modify `registry.ts` (+ test), `shared/buildings.json`, `src/city/map.ts` (a scenery house near the playground becomes the door), `src/city/world.ts` (22nd colour), `src/core/lehrplan.ts` (`TAGS.spielwelt`).
Screen: one SVG of `WORLD_WIDTH × 100` drawn three times side by side (wrap), translated by `-viewX`; swipe on background scrolls; pointer-down on a thing lifts it (it follows the finger), release → `settle` → `flow.released`; near an edge while carrying, the view scrolls. The car: tap → honk + ◀ ▶ hold-to-drive; things on/in it move along. The top strip: the whole world small with a frame for the view; a tap scrolls there. Arrangement saved to storage on every change (try/catch), read at start (fallback to `startArrangement()` if broken).
- [ ] Failing tests: a placing task solved by dragging (pointer events) onto the object; a release elsewhere says nothing; a find task solved by tapping; a background swipe scrolls (`viewX` changes) and wraps; the strip jumps; the car drives with a thing on it; the arrangement survives a remount and a broken one falls back; leaving records solved tasks at the visit's step for the starting child; after the tasks free play stays and leaving keeps the Stars; registry/buildings.json/map.
- [ ] Implement → `npm test`, lint, typecheck, pytest → browser check at 1180×820, 1024×768, 768×1024 and a scroll-speed check → commit `feat: the Spielwelt, a wide world for position words`.

### Task 7: Docs
- [ ] README row + section + parents' paragraph (seven parts, about 54 %); roadmap item 16 and the calls → commit.
