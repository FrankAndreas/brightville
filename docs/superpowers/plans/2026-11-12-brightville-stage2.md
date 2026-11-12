# Brightville Stage 2 (School, Arcade, Daily Goal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the School (counting and sums, earns Stars), the Arcade (Memory, costs Stars) and a daily goal that unlocks the Arcade door.

**Architecture:** Same layers as stage 1. Goal and door rules are pure functions in `src/core`; the save format moves to version 2 with a migration. Each new building is a Vue component behind the existing `finished` contract. The town gets one new ability: changing a door's state after it was built.

**Tech Stack:** unchanged (TypeScript, Vite, Vue 3, Pinia, Vitest, Three.js, Rapier).

**Spec:** `docs/superpowers/specs/2026-11-12-brightville-stage2-design.md`

## Global Constraints

- Everything in the stage 1 plan's Global Constraints still holds.
- All spoken lines are German and exactly as written in the spec.
- A wrong answer never removes Stars, never plays a harsh sound, never shows a cross.
- Stars are only removed by entering a play building, by exactly its `cost`.
- A play building can never be entered while the daily goal is not reached.
- Every building screen works with keyboard alone and with pointer alone.
- Every task ends with `npm test`, `npm run lint` and `npm run build` passing.

## Review Focus

1. **A version 1 save** (stage 1 players) loads with its Stars and an empty day; a damaged version 2 save (missing day, negative visits, wrong types) falls back safely without losing a valid Star count where one exists.
2. **The day changes while the game is open** (left running overnight): the goal slots empty and the Arcade door locks without a reload.
3. **Double charging or free play:** pressing Enter twice at the Arcade door, or entering with exactly 3 Stars, charges once and never goes below 0.
4. **Keys pressed during speech or animation** in the School (answer chosen twice, a digit key during the count-along) do not skip tasks or award a task twice.
5. **Leaving mid-game with Esc** in both buildings: School keeps the Stars of finished tasks and counts as a visit only if at least one was earned; Arcade gives nothing back and leaves no timers running.

---

### Task 1: Save format 2 and the daily goal rules

**Files:**
- Modify: `src/core/save.ts`, `src/core/save.test.ts`, `src/stores/player.ts`, `src/stores/player.test.ts`, `src/services/storage.test.ts`
- Create: `src/core/daily.ts`, `src/core/daily.test.ts`

**Interfaces:**
- Produces:

```ts
// core/save.ts
export const SAVE_VERSION = 2
export interface SaveData { version: 2; stars: number; day: string; visits: number }  // day '' = never
export function parseSave(raw: string | null): SaveData   // v1 → { version: 2, stars, day: '', visits: 0 }

// core/daily.ts
export const DAILY_GOAL = 2
export function dayOf(date: Date): string                       // local 'YYYY-MM-DD'
export function visitsOn(save: Pick<SaveData, 'day' | 'visits'>, day: string): number   // 0 when save.day !== day
export function goalReached(visits: number): boolean

// stores/player.ts — adds
//   state: day, visits      getters: visitsToday, goalReached
//   init(store, now?: () => Date)
//   recordVisit(): boolean   // counts an earning visit today; true when this one reached the goal
//   spend(count: number): boolean   // false and unchanged when stars < count or count is not a positive whole number
//   refreshDay(): void       // call when time may have passed; resets today's visits on a new day
```

- [ ] **Step 1: Write the failing tests**

```ts
// save.test.ts
it('carries a version 1 save over with its stars', () => expect(parseSave('{"version":1,"stars":12}')).toEqual({ version: 2, stars: 12, day: '', visits: 0 }))
it('round-trips version 2', ...)
it.each([... '{"version":2,"stars":5}', '{"version":2,"stars":5,"day":7,"visits":1}', '{"version":2,"stars":5,"day":"2026-11-13","visits":-1}',
         '{"version":2,"stars":5,"day":"2026-11-13","visits":1.5}'])('keeps the stars but empties the day for %s', raw => expect(parseSave(raw)).toEqual({ version: 2, stars: 5, day: '', visits: 0 }))
// existing fallback cases now expect { version: 2, stars: 0, day: '', visits: 0 }; version 3 falls back

// daily.test.ts
it('formats the local day', () => expect(dayOf(new Date(2026, 10, 3, 23, 59))).toBe('2026-11-03'))
it('counts visits only for the same day', ...)       // visitsOn({ day: '2026-11-13', visits: 2 }, '2026-11-14') === 0
it('reaches the goal at 2', ...)                     // goalReached(1) false, (2) true, (3) true

// player.test.ts
it('recordVisit counts today and reports reaching the goal once', ...)   // false, true, false
it('forgets yesterday's visits on a new day but keeps the stars', ...)   // injected clock moves a day; refreshDay(); visitsToday 0
it('spend removes exactly the cost and saves', ...)
it.each([[2, 3], [5, 0], [5, -1], [5, 1.5]])('spend refuses with %s stars and cost %s', ...)
```

- [ ] **Step 2: Run** `npm test` — expected: FAIL.
- [ ] **Step 3: Implement.** `parseSave` validates Stars first, then the day part on its own, so a bad day part never costs the Stars.
- [ ] **Step 4: Run** `npm test && npm run lint && npm run build` — expected: pass.
- [ ] **Step 5: Commit** `feat: save format 2 and daily goal rules`

---

### Task 2: Door states and play buildings

**Files:**
- Modify: `src/buildings/types.ts`, `src/buildings/registry.ts`, `src/buildings/registry.test.ts`, `src/city/doors.ts`, `src/city/world.ts`, `src/city/city.ts`, `src/city/CityView.vue`, `src/city/CityView.test.ts`, `src/components/DoorPrompt.vue`, `src/App.vue`, `src/App.test.ts`
- Create: `src/core/access.ts`, `src/core/access.test.ts`, `src/components/GoalBar.vue`

**Interfaces:**
- Consumes: Task 1.
- Produces:

```ts
// buildings/types.ts
export interface BuildingDef { …; kind: 'earn' | 'play'; cost?: number }   // cost only for 'play'

// core/access.ts
export type DoorState = 'open' | 'unavailable' | 'locked' | 'poor'
export function doorState(b: { kind: 'earn' | 'play'; cost?: number }, canServe: boolean, goalReached: boolean, stars: number): DoorState
// unavailable (device) wins, then locked (play and goal not reached), then poor (stars < cost), else open

// city/doors.ts
export interface DoorDef { id; x; z; open: boolean; icon?: string; locked?: boolean }   // locked: draw a lock on the sign
// city/city.ts
export interface City { …; setDoors(doors: DoorDef[]): void }   // same ids and places; updates open/locked look and behaviour

// registry.ts
export function toDoors(buildings, device, goalReached: boolean, stars: number): DoorDef[]
```

- `CityView` calls `setDoors` when its `doors` prop changes.
- `App.vue`: doors are computed from the store, so they follow Stars and the goal. Near a door it speaks by state: open earn → `spokenName`; open play → `` `${spokenName}. Das kostet ${numberWord(cost)} Sterne.` ``; locked → `Erst lernen, dann spielen!`; poor → `` `Du brauchst ${numberWord(cost)} Sterne.` ``; unavailable → `spokenName`. On enter of a play building it calls `spend(cost)` and opens only if that returned true. On `finished` of an earn building with Stars > 0 it calls `recordVisit()`; when that returns true it shows `Confetti` for 3 s and speaks `Geschafft! Die Spielhalle ist offen!`. It calls `refreshDay()` every minute and when the page becomes visible again.
- `DoorPrompt`: prop `state: DoorState`, `icon`, optional `cost`, `visits`, `goal`. Pictures per the spec's door table; `data-state` attribute.
- `GoalBar.vue`: `DAILY_GOAL` slots (`data-test="goal-slot"`, `data-done`), then the play picture (`data-test="goal-prize"`, `data-open`). Shown beside the Star counter.
- `numberWord` arrives in Task 3; until then use a local `['null','eins','zwei','drei']` lookup in `App.vue` and replace it there.

- [ ] **Step 1: Write the failing tests** — `access.test.ts` (all four states and their order of precedence; exactly `cost` Stars is open), registry (`toDoors` marks locked and poor doors closed, `locked` only for the goal case), `CityView.test.ts` (`setDoors` called when the prop changes, not on mount), `App.test.ts`:

```ts
it('keeps a play building locked until two earning visits', ...)          // prompt data-state 'locked', speak 'Erst lernen, dann spielen!', onEnter does nothing
it('counts an earning visit only when it earned stars', ...)
it('celebrates when the goal is reached and opens the play door', ...)    // confetti, spoken line, doors passed to the town now open
it('says what is missing when there are too few stars', ...)              // 'Du brauchst drei Sterne.'
it('charges the cost once on entering and never twice', ...)              // onEnter twice → stars reduced by 3 once
it('gives no visit and no stars for a play building', ...)
it('locks the play door again on a new day', ...)                         // fake clock + visibilitychange
it('shows the goal slots filling', ...)
```

- [ ] **Step 2: Run** `npm test` — expected: FAIL.
- [ ] **Step 3: Implement.** In `world.ts` each door building keeps its frame, leaf and ring materials and gets `setState(open, locked)`; a locked sign shows 🔒 small in a corner. Give each door building its own colour from a palette by index.
- [ ] **Step 4: Run** `npm test && npm run lint && npm run build` — expected: pass.
- [ ] **Step 5: Commit** `feat: daily goal, door states and play buildings`

---

### Task 3: Number logic from Spielzeugkiste

**Files:**
- Create: `src/core/numbers.ts`, `src/core/numbers.test.ts`
- Modify: `src/App.vue` (use `numberWord`)

**Interfaces:**
- Produces (ported from `../kids-games/src/logic/numbers.js`, typed, unchanged behaviour unless noted):

```ts
export function seededRandom(seed: number): () => number
export function numberWord(n: number): string
export function answerChoices(answer: number, max: number, random?: () => number, min?: number): number[]
export function looseLayout(n: number, random?: () => number): { x: number; y: number }[]
export function dicePips(value: number): { x: number; y: number }[]
export interface Thing { emoji: string; one: string; many: string }
export type Task =
  | { type: 'count'; kind: number; amount: number; answer: number; choices: number[] }
  | { type: 'dice'; kind: number; dice: number[]; answer: number; choices: number[] }
  | { type: 'plus'; kind: number; a: number; b: number; answer: number; choices: number[] }
export const SESSION_LENGTH = 5
export function buildSession(kindCount: number, random?: () => number): Task[]
// NEW shape: a small count (1–5) first, then count, dice, plus, plus shuffled; amounts up to 9; one die
export function questionText(task: Task, thing: Thing): string
export function cheerText(answer: number): string
```

- Not ported: `tenFrameLayout`, `parseLevel`, the `build` and `listen` rounds.

- [ ] **Step 1: Port the tests** from `../kids-games/src/logic/numbers.test.js` for the functions kept, adapting the session test: 5 tasks, first is a count of 1–5, the rest are one count, one dice and two plus; every answer 0–9 (0 only for count); plus never exceeds 9; 3 distinct choices including the answer.
- [ ] **Step 2: Run** `npm test` — expected: FAIL (module missing).
- [ ] **Step 3: Port the code.**
- [ ] **Step 4: Run** `npm test && npm run lint` — expected: pass.
- [ ] **Step 5: Commit** `feat: number logic from Spielzeugkiste`

---

### Task 4: The School

**Files:**
- Create: `src/buildings/school/flow.ts`, `src/buildings/school/flow.test.ts`, `src/buildings/school/School.vue`, `src/buildings/school/School.test.ts`, `src/buildings/school/things.ts`
- Modify: `src/buildings/registry.ts`, `src/buildings/registry.test.ts`, `src/city/world.ts` (remove the two scenery houses at the far side)

**Interfaces:**
- Consumes: Task 3; `speak`, `playBeat`, `keyboardIntents`.
- Produces:

```ts
// school/things.ts
export const THINGS: Thing[]   // the six from the spec

// school/flow.ts — pure
export const STARS_PER_TASK = 1
export const SET_BONUS = 5
export interface SchoolState {
  index: number                 // current task, 0-based
  task: Task | null             // null when finished
  wrong: number[]               // choices already tried and faded
  counted: number               // objects marked by the child in this task
  solved: number                // tasks done
  stars: number
  phase: 'asking' | 'cheering' | 'recounting' | 'done'
}
export type SchoolEffect = { type: 'speak'; text: string } | { type: 'chime' } | { type: 'recount'; amount: number } | { type: 'confetti' }
export interface SchoolFlow {
  readonly state: SchoolState
  start(): SchoolEffect[]                      // speaks the first question
  touch(): SchoolEffect[]                      // child marks one more object: speaks its number
  answer(choice: number): SchoolEffect[]       // only acts in phase 'asking'
  recountDone(): SchoolEffect[]                // back to 'asking'
  next(): SchoolEffect[]                       // after the cheer: next question, or done (+5, confetti, 'Super gemacht!')
}
export function createSchoolFlow(tasks: Task[], things: Thing[]): SchoolFlow
```

- Lines: right → `cheerText(answer)`; wrong → `Hmm, zähl nochmal mit mir`; done → `Super gemacht!`.
- `School.vue`: optional prop `tasks` (default `buildSession(THINGS.length)`). Emits `finished` with `{ stars }` 3 s after done, or at once on Esc. Top: five stars filling (`data-test="progress-star"`, `data-done`). Middle: the task picture, objects are buttons (`data-test="thing"`, `data-counted`). Bottom: three answer buttons (`data-test="choice"`, `data-value`, `data-wrong`, `data-focus`) showing the digit. Keys: digit of a shown choice answers; Left/Right move the focus and say the number; Enter answers the focused one. The count-along lights one object every 700 ms saying its number, then calls `recountDone`. The cheer waits for its speech to end before `next()`. For dice, the pips are the countable objects; for plus, both groups.
- Registry: `{ id: 'school', spokenName: 'Schule', icon: '🔢', kind: 'earn', needs: [], door: { x: -11, z: -14 }, component: async School }`; yoga gets `kind: 'earn'`.

- [ ] **Step 1: Write the failing tests**

```ts
// flow.test.ts
it('asks the first question on start', ...)
it('counts along when the child touches objects, up to the amount', ...)      // 'eins', 'zwei'; no more than there are
it('cheers, gives one star and moves on after a right answer', ...)
it('fades a wrong answer, recounts and lets the child try again', ...)        // stars unchanged; wrong [n]; effect recount amount
it('gives the star for a corrected answer', ...)
it('ignores answers while cheering or recounting', ...)                       // no double star
it('ignores a choice that already faded', ...)
it('ends with 10 stars, confetti and Super gemacht after five tasks', ...)

// School.test.ts (tts and sound mocked, fake timers, fixed tasks)
it('shows the objects and three choices and speaks the question', ...)
it('answers with the digit key', ...)
it('moves the focus with the arrows, says the number, and answers with Enter', ...)
it('answers with a click', ...)
it('counts along after a wrong answer and then accepts the right one', ...)
it('does not award a task twice for a double key press', ...)
it('finishes with 10 stars after five right answers', ...)
it('leaves on Escape with the stars so far and stops all timers', ...)
```

- [ ] **Step 2: Run** `npm test` — expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run lint && npm run build` — expected: pass.
- [ ] **Step 5: Check in the browser:** walk to the School, solve a visit with the keyboard and one with the mouse, including a wrong answer; the first goal slot fills on return.
- [ ] **Step 6: Commit** `feat: school with counting and first sums`

---

### Task 5: The Arcade

**Files:**
- Create: `src/core/memory.ts`, `src/core/memory.test.ts`, `src/buildings/arcade/cards.ts`, `src/buildings/arcade/Arcade.vue`, `src/buildings/arcade/Arcade.test.ts`
- Modify: `src/buildings/registry.ts`, `src/buildings/registry.test.ts`, `README.md`

**Interfaces:**
- Produces:

```ts
// core/memory.ts
export interface Pair { id: string; emoji: string; say: string }
export interface Card extends Pair { key: string }
export function pickPairs(pairs: Pair[], count: number, random?: () => number): Pair[]   // ported
export function buildDeck(pairs: Pair[], random?: () => number): Card[]                   // ported; random injectable
export interface MemoryGame {
  readonly open: string[]        // keys face up and not yet matched (0–2)
  readonly matched: string[]     // keys of found pairs
  readonly done: boolean
  flip(key: string): 'ignored' | 'first' | 'match' | 'miss'   // ignored: already open/matched, or two misses still showing
  hideMisses(): void             // turn a missed pair back
}
export function createMemory(deck: Card[]): MemoryGame

// arcade/cards.ts
export const ANIMALS: Pair[]     // at least 12 animal emoji with German names ('der Löwe' style not needed: just 'Löwe')
export const PAIRS_PER_ROUND = 6
export const COLUMNS = 4
```

- `Arcade.vue`: optional prop `deck`. 4 × 3 cards (`data-test="card"`, `data-key`, `data-face` `up|down`, `data-matched`, `data-focus`). Click or tap flips; arrow keys move the focus (stopping at the edges), Enter flips. Flipping speaks the animal's name; a match plays the chime; a miss turns back after 1200 ms. All found: confetti, `Super gemacht!`, emits `finished` with `{ stars: 0 }` after 3 s. Esc emits at once. No timers left running after leaving.
- Registry: `{ id: 'arcade', spokenName: 'Spielhalle', icon: '🃏', kind: 'play', cost: 3, needs: [], door: { x: 11, z: -14 }, component: async Arcade }`.
- README: the new buildings, the daily goal, the controls inside them.

- [ ] **Step 1: Write the failing tests** — `memory.test.ts` (ported deck tests; `flip` results for first, match, miss, a third card while a miss shows, a card already open; `done` after all pairs), `Arcade.test.ts` (12 cards face down; click flips and speaks; match stays and chimes; miss turns back after 1200 ms; a third click during a miss is ignored; arrows + Enter; finishing emits `{ stars: 0 }` after confetti; Esc leaves and clears timers).
- [ ] **Step 2: Run** `npm test` — expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run lint && npm run build` — expected: pass.
- [ ] **Step 5: Walk through the whole loop in the browser:** fresh save → Arcade locked with its voice line → two School visits → confetti, door glows → enter, 3 Stars gone → finish a round → back on the square. Then set the clock one day ahead (or edit the saved day) and check the slots are empty and the door locked.
- [ ] **Step 6: Commit** `feat: arcade with memory`
