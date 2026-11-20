# Musterwerkstatt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new earning building, the Musterwerkstatt (continue rows, sort things into baskets), on a fourth Lehrplan ladder, Muster, shown in the parents' overview.

**Architecture:** `muster` joins the ladder machinery (server `school.py`, `src/core/ladders.ts`, `src/stores/school.ts`), whose by-name lists become loops. Rows and sorts are made in `src/core/patterns.ts`; a pure flow (`src/buildings/muster/flow.ts`) and a screen (`Musterwerkstatt.vue`) follow the Reimhaus's split, with one generic "say this while that lights up" effect.

**Tech Stack:** Vue 3 `<script setup>`, Pinia, Vitest; FastAPI, pydantic, SQLite, pytest.

**Spec:** `docs/superpowers/specs/2026-11-20-brightville-musterwerkstatt-design.md`

## Global Constraints

- Everything spoken; nothing to read. Pieces are SVG shapes in rot, blau, gelb, grün; Kreis, Dreieck, Quadrat; gross and klein (small ≈ 60 %).
- Never a buzz: a wrong choice fades, a thing in the wrong basket goes back; tried again until right.
- Muster: steps 1–5 and 6 = "fertig"; window **10**, misses **2**, start step 1.
- A visit: five tasks; Stars `STARS_PER_TASK` (1) per solved task + `SET_BONUS` (5), 10 at most; `minSecondsPerStar` 2.
- Building: id `muster`, spoken name `Musterwerkstatt`, icon `🧩`, kind `earn`, needs `[]`, door `{ x: 3.5, z: 51, side: 'right' }` (removed from `EMPTY_LOTS`; `DOG_GARDEN` becomes 1).
- Example at steps 1–5 while the window holds fewer than 10 answers; none at "fertig".
- Overall number = average of Zählen, Rechnen, Reimen, Muster, Buchstaben; `KG_TARGETS.muster = 0.6` → mark 48.
- Tags: `muster: { codes: ['MA.1.B', 'MA.3'], zugaenge: [5, 2] }`.
- Sorting: tap a thing, then a basket. A sort is right on the first try only if every thing went in right the first time.
- Repo checks: `npm test`, `npm run lint`, `npm run typecheck`; backend `pytest`, `black --check`, `flake8 --max-line-length=120 --extend-ignore=E203,W503`, `mypy`.

## Review Focus

1. Old data without `muster` (cached steps, a server answer during the update, waiting results) — expect Muster at step 1 and everything else unchanged. (Task 2 tests)
2. A sort where she taps a basket with nothing lifted, lifts one thing then another, or taps during the cheer — expect nothing counted wrongly and no thing lost. (Task 4 tests)
3. Generated rows that have two right answers, or a "two things" row where a wrong choice differs in both features — expect a data test to catch it. (Task 3 tests)
4. Leaving mid-sort or during the example — expect only solved tasks recorded at the visit's step for the child who started, Stars kept. (Task 5 test)
5. Twenty things on screen at 768×1024 (row of 8 + 3 choices; 2 baskets + 4 things) — expect no overflow. (Task 5 browser check)

---

### Task 1: Server — Muster as the fourth ladder

**Files:** Modify `backend/app/school.py`, `backend/app/main.py` (`SchoolResultsIn`); Test `tests/test_school.py`.

**Interfaces:** Produces `WINDOW["muster"] = 10`, `MISSES_ALLOWED["muster"] = 2`; `state()` includes `muster`; `SchoolResultsIn.muster: LadderResultIn | None = None`.

- [ ] **Step 1: Failing tests** — `state()` helper includes `muster`; `test_a_new_child_starts_muster_at_1`; `test_ten_muster_answers_with_two_misses_move_up` (two `send_only(..., muster=(1, [...5]))` with 2 misses → step 2); `test_a_result_with_only_muster_leaves_the_others`; `test_a_parent_sets_muster`.
- [ ] **Step 2: Run** `../brightville/venv/bin/pytest tests/test_school.py -q` — Expected: FAIL (KeyError `muster`).
- [ ] **Step 3: Implement**; docstring names the Musterwerkstatt.
- [ ] **Step 4: Run** pytest, black, flake8, mypy — Expected: PASS.
- [ ] **Step 5: Commit** `feat: Muster, a fourth Lehrplan ladder on the server`

### Task 2: App ladders and store, by loop

**Files:** Modify `src/core/ladders.ts`, `src/stores/school.ts`, `src/core/lehrplan.ts` (`STEP_TEXT.muster`, needed for types); Test `src/core/ladders.test.ts`, `src/stores/school.test.ts`; fix fixtures that spell out all ladders.

**Interfaces:** `Ladder` adds `'muster'`; `LADDERS` adds it; `SchoolLadder = Exclude<Ladder, 'reimen' | 'muster'>`; `WINDOW.muster = 10`, `MISSES_ALLOWED.muster = 2`; `startLadders` adds `muster: { step: 1, window: [] }`. Store `readKnown` and `take` build the ladders with a loop over `LADDERS`, each missing or broken ladder falling back to `startLadders(false)[ladder]` (Zählen and Rechnen still required in a cached record, as now). `STEP_TEXT.muster` = [`Reihen mit zwei Farben`, `Reihen mit drei Farben`, `Reihen mit Formen und Grössen`, `Sortieren nach Farbe und Art`, `Lücken, Grösse, zwei Merkmale`, `fertig (Ende 2. Klasse)`].

- [ ] **Step 1: Failing tests** — ladders: Muster moves after 10 with 2 misses, stays with 3; `startLadders` includes `muster`. Store: `sends a Musterwerkstatt visit with only Muster`; `takes cached steps from before Muster` (cache with three ladders → `muster` step 1, others kept); `keeps Muster at step 1 when a server from before Muster answers`.
- [ ] **Step 2: Run** `npx vitest run src/core/ladders.test.ts src/stores/school.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`, typecheck, lint — Expected: PASS.
- [ ] **Step 5: Commit** `feat: Muster in the app's ladders; the store reads every ladder the same way`

### Task 3: Rows and sorts

**Files:** Create `src/core/patterns.ts`, `src/core/patterns.test.ts`.

**Interfaces:**
```ts
export type Colour = 'rot' | 'blau' | 'gelb' | 'gruen'
export type Shape = 'kreis' | 'dreieck' | 'quadrat'
export interface Piece { colour: Colour; shape: Shape; big: boolean }
export type Feature = 'colour' | 'shape' | 'size' | 'both'
export interface SortThing { id: string; say: string; emoji?: string; piece?: Piece; big?: boolean; basket: 0 | 1 }
export type MusterTask =
  | { type: 'row'; feature: Feature; pieces: Piece[]; gap: number; choices: Piece[]; answer: number }  // answer: index in choices
  | { type: 'sort'; by: 'colour' | 'kind' | 'size'; baskets: [string, string]; examples: [SortThing, SortThing]; things: SortThing[] }
export interface MusterExample { kind: 'row' | 'gap' | 'sort'; task: MusterTask }
export const TASKS_PER_VISIT = 5
export function pieceName(p: Piece, feature: Feature): string   // 'rot' | 'Kreis' | 'gross' | 'roter Kreis', 'blaues Dreieck', 'grünes Quadrat'
export function buildMusterSession(step: number, random?: () => number): MusterTask[]
export function exampleFor(step: number, windowLength: number): MusterExample | null
export const samePiece: (a: Piece, b: Piece) => boolean
```
`baskets` are what the voice calls each basket's group ("Tiere", "Obst"; "Rote", "Blaue"; "Grosse", "Kleine"). Rows: units AB, ABC, AAB, ABB repeated to 4–8 pieces; `gap` is the last index except at gap tasks (an index inside, never 0). Step contents exactly as the spec's table and its step 5 / fertig lines. Sorting by kind: groups Tiere, Obst, Fahrzeuge (≥ 4 emoji each, one obvious name); by size: one emoji, two big and two small, examples one of each.

- [ ] **Step 1: Failing tests** (one `it` each, over 300 seeded sessions with `seededRandom`):
  - five tasks per step, of the step's kinds and counts (step 1 colour AB rows; 2 colour ABC/AAB/ABB; 3 shape AB/ABC or size AB/AAB/ABB; 4 sorts by colour or kind; 5 two gap rows + one `both` row + two size sorts; 6 one row, one gap row, one `both` row, one colour/kind sort, one size sort);
  - every row's answer completes the repeating unit, and exactly one choice does (`samePiece`);
  - in a `both` row each wrong choice matches the answer in exactly one of colour and shape;
  - only the row's feature varies (a colour row: one shape, one size);
  - a gap is never at 0 and, at gap tasks, never last;
  - a sort has four things, two per basket, things and examples distinct; a size sort uses one emoji;
  - the right choice lands in each of the three places across sessions; no row twice in a visit;
  - `pieceName`: `rot`, `Kreis`, `gross`, `klein`, `roter Kreis`, `blaues Dreieck`, `grünes Quadrat`;
  - `exampleFor`: kinds row (1–3), sort (4), gap (5); null at 6 or window ≥ 10.
- [ ] **Step 2: Run** `npx vitest run src/core/patterns.test.ts` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat: the Musterwerkstatt's rows and sorts`

### Task 4: The flow

**Files:** Create `src/buildings/muster/flow.ts`, `flow.test.ts`.

**Interfaces:**
```ts
export type MusterEffect =
  /** Said while `light` is lit ('piece-<i>', 'gap', 'choice-<i>', 'basket-<0|1>', 'thing-<id>'); `ask`: kept for 🔊 as `again ?? text` */
  | { type: 'speak'; text: string; light?: string; ask?: boolean; again?: string }
  | { type: 'chime' } | { type: 'drop' } | { type: 'back' } | { type: 'confetti' }
export interface MusterState {
  index: number; task: MusterTask | null; wrong: number[]; lifted: string | null; placed: Record<string, 0 | 1>
  missed: boolean; solved: number; stars: number; results: { ladder: 'muster'; firstTry: boolean }[]
  /** The example's answer is shown in its gap */
  filled: boolean
  phase: 'example' | 'asking' | 'cheering' | 'done'
}
export interface MusterFlow {
  readonly state: MusterState
  start(): MusterEffect[]; exampleDone(): MusterEffect[]
  choose(i: number): MusterEffect[]          // a row's choice
  lift(thingId: string): MusterEffect[]      // a sort: tap a thing
  drop(basket: 0 | 1): MusterEffect[]        // a sort: tap a basket
  next(): MusterEffect[]
}
export function createMusterFlow(tasks: MusterTask[], example: MusterExample | null): MusterFlow
```
Texts (exact): a row is said piece by piece (`light: 'piece-<i>'`, the gap as `…` with `light: 'gap'`), then ask `Was kommt jetzt?` (end gap) or `Was fehlt?` (inner gap) with `again` = the whole row and the question; right: chime, the full row said again, `Super!`; wrong: choice faded, `Hör nochmal:`, the row, the ask again. A sort asks `${baskets[0]} kommen hierhin` (`light: 'basket-0'`), `${baskets[1]} dorthin` (`basket-1`), `Tippe ein Ding an und dann seinen Korb.` (ask, `again` = all three); lift says the thing's name (`thing-<id>`); right basket: `drop`, and when all four are in: chime + `Super!`; wrong: `back`, `${say} gehört in den anderen Korb. Schau nochmal.`, missed. End: confetti + `Super gemacht!`. Examples: row — `Schau:`, the row, `Was kommt jetzt?`, the answer's name with `light: 'gap'` (sets `filled`), the full row; gap — the same with `Was fehlt?`; sort — `Die ${baskets[0]} kommen in diesen Korb` (`basket-0`), `die ${baskets[1]} in den anderen` (`basket-1`), `${example0.say} gehört hierhin!` (`basket-0`). All example lines are `ask` so 🔊 repeats them.

- [ ] **Step 1: Failing tests** — example first then ask; a row's effects in order with lights; right choice (Star, result true, cheering); wrong choice fades and repeats, later right counts false; faded or unknown choice and taps during the cheer do nothing; lift/drop right, wrong (back, missed, nothing placed), drop with nothing lifted does nothing, lifting another thing switches, a placed thing can't be lifted; all four placed → solved (first try only without a miss); 10 Stars after five; `filled` set by the example's gap line.
- [ ] **Step 2: Run** `npx vitest run src/buildings/muster/flow.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat: the Musterwerkstatt's flow`

### Task 5: The screen and its place in the town

**Files:** Create `src/buildings/muster/Musterwerkstatt.vue`, `Musterwerkstatt.test.ts`, `PieceView.vue` (one SVG piece); Modify `src/buildings/registry.ts` (+ test), `shared/buildings.json`, `src/city/map.ts` (drop lot 1, comment), `src/city/animals.ts` (`DOG_GARDEN = 1`, comment), `src/city/world.ts` (20th colour pair), `src/core/lehrplan.ts` (`TAGS.muster`).

**Interfaces:** Props `{ tasks?: MusterTask[]; example?: MusterExample | null }`; snapshot `step = school.ladders.muster.step`, `player = school.who`; leave → `school.record(results, { muster: step }, player)`, emit `{ stars }`. Effects carried out as in `Reimhaus.vue` (numbered runs, lit target reset per run, `askedAgain` stops a run while asking, `instruct` for `ask` with `instruction.value = again`, `playBeat('chime')`, `playBeat('drum')` softly for `drop`, nothing for `back` but the move). Test ids: `piece-<i>`, `gap`, `choice-<i>` (`data-faded`), `basket-<0|1>`, `thing-<id>` (`data-lifted`, `data-placed`), `example`, `data-lit` on each.

- [ ] **Step 1: Failing tests** — a row shows its pieces, gap and three choices and says them lit in turn; a wrong choice fades, the right one fills the gap and goes on; a sort: tap thing → lifted, tap right basket → placed inside, wrong → back; leaving mid-visit records solved tasks at the visit's step for the starting child (spy on `record`); no `tasks` prop → built at the store's Muster step (step 4 → sorts); the example shows first; registry: `muster` entry, `shared/buildings.json` `{ id: 'muster', kind: 'earn', maxStars: 10, minSecondsPerStar: 2 }`, `EMPTY_LOTS` has two lots.
- [ ] **Step 2: Run** `npx vitest run src/buildings/muster src/buildings/registry.test.ts src/city` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`, typecheck, lint, backend suite — Expected: PASS. Browser check at 1180×820, 1024×768, 768×1024 (temporary harness, port 5188, removed after).
- [ ] **Step 5: Commit** `feat: the Musterwerkstatt, a building for patterns and sorting`

### Task 6: Parents' overview

**Files:** Modify `src/core/lehrplan.ts`, `src/components/LehrplanOverview.vue`; Test both test files.

**Interfaces:** `KG_TARGETS.muster = 0.6`; `overall` averages five shares; Mathematik lists Zählen, Rechnen, Muster.

- [ ] **Step 1: Failing tests** — `overall(ladders(3, 2, 4, 3), MIAPLENO) = round((0.4 + 0.2 + 0.6 + 0.4 + 8/29) / 5 * 100)`; `kgMark() = 48`; overview: `ladder-muster` inside `[data-test="mathe"]` with its step, the select sets it (`setPlayerStep 2 muster 5`); existing percent becomes `(0.4 + 0.2 + 0 + 0 + 3/29) / 5` → 14 %.
- [ ] **Step 2: Run** — Expected: FAIL.
- [ ] **Step 3: Implement** (`overall` sums `share()` over the ladders in `KG_TARGETS` order plus letters, so a sixth ladder is one line).
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: Muster in the parents' Lehrplan overview`

### Task 7: README and roadmap

- [ ] README: a Musterwerkstatt row and section; the parents' paragraph names Muster and the five-part number (about 48 %). Roadmap: item 14 (#35); "Harder tasks" names the Musterwerkstatt; the calls (two-thing rows, size sorts with one emoji, the lot, 48 %, no lot left) under "Calls made without asking". Commit `docs: the Musterwerkstatt in the README and roadmap`.
