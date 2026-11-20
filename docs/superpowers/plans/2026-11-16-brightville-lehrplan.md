# Lehrplan 21: School Ladders and Parents' Overview – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The School climbs two Lehrplan 21 ladders (Zählen, Rechnen) per child, and the parents' page shows one overall Lehrplan number that opens into subjects, ladders and this week's practice (issues #32, #33).

**Architecture:** One rule module per side (`backend/app/school.py`, `src/core/ladders.ts`) with the same move-up rule; the server is the truth and the device keeps a copy to go on offline, like Schreiben's letters. Task generators per step extend `src/core/numbers.ts`. The overview is pure functions in `src/core/lehrplan.ts` over data the parents' page already loads (diary, writing) plus the new ladder endpoint.

**Tech Stack:** Vue 3 + Pinia + Vitest (frontend), FastAPI + SQLite + pytest (backend).

**Spec:** `docs/superpowers/specs/2026-11-16-brightville-lehrplan-design.md`

## Global Constraints

- The child never sees a step, a percentage or a grade; the School never buzzes.
- A School visit stays five tasks (three Zählen, two Rechnen), at most 10 Stars (`STARS_PER_TASK` 1, `SET_BONUS` 5 unchanged).
- Ladders: `zaehlen` and `rechnen`, steps 1–5 plus 6 = "fertig" (asks step-5 tasks). Share = (step − 1) / 5.
- Move up: of the last N answered tasks at the current step (zaehlen N = 6, rechnen N = 4), at most one missed on the first try; fewer than N answered → no move. Window empties on a move up and on a parent's change. Never down by itself.
- Start: zaehlen 1; rechnen 2 if the child has any `events` row with building `school`, else 1.
- Overall = round(mean(zaehlen share, rechnen share, letters share) × 100). Letters share = letters A–Z, Ä, Ö, Ü (29) at Schreiben level 4 / 29; digits don't count.
- Kindergarten mark: targets zaehlen 0.4, rechnen 0.4, letters 0 → mean ≈ 27 %; constants in `src/core/lehrplan.ts`.
- "Diese Woche" = today and the six calendar days before (device day); Zugänge 4 and 9 not listed.
- Codes are the template's (v-fe.lehrplan.ch); tags live only in the app.
- Spoken German as now; numbers above 20 are shown as tens bars and ones, not as digits alone (answer buttons keep digits, as now).
- Repo conventions: TDD; Conventional Commit messages; commits end with the Co-Authored-By / Claude-Session lines; check servers on 8019/5188 only.

## Review Focus

1. A result sent twice (lost answer, resent on next load) is counted once — key per visit result (Task 1, Task 5 tests).
2. A result made at a step the parent has changed since (or another device moved up) is ignored, not applied to the new step (Task 1 test `test_result_at_an_old_step_is_ignored`).
3. The device hands over to another child mid-visit: the result goes to the child who played (Task 5 test `sends the result for the child who played`).
4. Step 6 ("fertig") and every step generate valid tasks: answer in choices, no negative numbers, choices within the step's range (Task 3 property test over all steps and 200 seeds).
5. Answers above 9 can be given without a pointer: arrow keys + Enter reach every choice (Task 4 test).

---

### Task 1: Server keeps the ladders

**Files:**
- Modify: `backend/app/db.py` (append a migration)
- Create: `backend/app/school.py`
- Modify: `backend/app/main.py` (routes)
- Test: `tests/test_school.py`

**Interfaces:**
- Produces (HTTP):
  - `GET /api/school` → `{"zaehlen": {"step": int, "window": [bool]}, "rechnen": {...}}` (current person)
  - `POST /api/school/results` body `{"key": str, "zaehlen": {"step": int, "results": [bool]}, "rechnen": {"step": int, "results": [bool]}}` → same shape as GET. `results`: first-try right per answered task, in order.
  - `GET /api/players/{id}/school` (parent) → same shape; `PUT /api/players/{id}/school` (parent) body `{"ladder": "zaehlen"|"rechnen", "step": 1..6}` → same shape; 422 `unknown`/`bad_step`, 404 `unknown_person`.
- Python: `school.state(db, person_id) -> dict`, `school.record(db, person_id, key, results: dict) -> None`, `school.set_step(db, person_id, ladder, step) -> None`, `school.apply(step, window, results, size) -> tuple[int, list[bool]]`.

Migration (append to `MIGRATIONS`):

```sql
CREATE TABLE school_ladders (
    person_id INTEGER NOT NULL,
    ladder TEXT NOT NULL,
    step INTEGER NOT NULL,
    window TEXT NOT NULL DEFAULT '[]',
    PRIMARY KEY (person_id, ladder)
);
CREATE TABLE school_keys (
    person_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    day TEXT NOT NULL,
    PRIMARY KEY (person_id, key)
);
```

A child without a row reads the start steps (Global Constraints); the row is written on the first result or parent change. Keys older than 60 days are deleted on each record (as `writing.record`).

- [ ] **Step 1: Write the failing tests** in `tests/test_school.py` (fixtures `mia`, parent browser and `set_time` as in `tests/test_writing.py`):
  - `test_a_new_child_starts_at_zaehlen_1_rechnen_1` → `{"zaehlen": {"step": 1, "window": []}, "rechnen": {"step": 1, "window": []}}`
  - `test_a_child_who_used_the_school_starts_rechnen_at_2` (insert an `events` row for `school`)
  - `test_six_answers_with_one_miss_move_zaehlen_up`: two posts of `[True, True, False]` / `[True, True, True]` → zaehlen step 2, window `[]`
  - `test_two_misses_in_six_dont_move` → step 1, window keeps the last 6
  - `test_fewer_than_six_answers_dont_move` (`[True]*5`) → step 1
  - `test_rechnen_needs_four` (`[True, True]` twice → step 2)
  - `test_the_same_key_counts_once`
  - `test_result_at_an_old_step_is_ignored` (post `step: 1` after parent set 3 → unchanged)
  - `test_step_6_stays_6`
  - `test_a_parent_sets_a_step_and_the_window_empties`; `test_a_child_cannot_set_a_step` (403); `test_bad_step_is_refused` (0 and 7 → 422 `bad_step`); unknown ladder → 422 `unknown`.
- [ ] **Step 2: Run** `venv/bin/pytest tests/test_school.py -q` — Expected: FAIL (404 on `/api/school`).
- [ ] **Step 3: Implement** migration, `school.py` (constants `WINDOW = {"zaehlen": 6, "rechnen": 4}`, `LAST_STEP = 6`, `apply` = append results, keep last N, move up if `len >= N and misses <= 1`), and the routes (parent routes copy `player_writing`'s checks; bodies as pydantic models with `results` at most 10 items).
- [ ] **Step 4: Run** `venv/bin/pytest -q` — Expected: all pass (incl. `test_db.py` migration tests).
- [ ] **Step 5: Commit** `feat: the server keeps each child's School ladders`

### Task 2: The same rule on the device

**Files:**
- Create: `src/core/ladders.ts`, `src/core/ladders.test.ts`

**Interfaces:**
- Produces: `type Ladder = 'zaehlen' | 'rechnen'`; `interface LadderState { step: number; window: boolean[] }`; `type Ladders = Record<Ladder, LadderState>`; `const WINDOW: Record<Ladder, number>` (6, 4); `const LAST_STEP = 6`; `applyResults(s: LadderState, results: boolean[], ladder: Ladder): LadderState`; `startLadders(usedSchool: boolean): Ladders`; `share(step: number): number` ((step − 1) / 5).

- [ ] **Step 1: Write the failing tests**: the same cases as Task 1's rule tests (one miss in 6 moves; two don't; 5 answers don't; rechnen 4; step 6 stays; window empties on move), plus `share(1) === 0`, `share(6) === 1`.
- [ ] **Step 2: Run** `npx vitest run src/core/ladders.test.ts` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same — Expected: PASS.
- [ ] **Step 5: Commit** `feat: the ladders' move-up rule on the device`

### Task 3: Tasks per step

**Files:**
- Modify: `src/core/numbers.ts`, `src/core/numbers.test.ts`

**Interfaces:**
- Consumes: `Ladder`, `Ladders` from Task 2.
- Produces:
  - `numberWord(n)` for 0–100 ("einundzwanzig", "dreißig", "hundert").
  - `Task` gains `ladder: Ladder` on every task and new variants:
    `{ type: 'next'; from: number; by: number; shown: number[] }` ("Zähl weiter/rückwärts: … und dann?", `by` ∈ ±1, ±2, ±5, ±10; `shown` the three numbers said before),
    `{ type: 'flash'; amount: number }` (dots shown briefly, 1–5),
    `{ type: 'bars'; amount: number }` (21–100 as tens and ones),
    `{ type: 'minus'; a: number; b: number }`.
    `plus` gains optional `bars?: boolean` (tens sums at Rechnen 5).
  - `buildLadderSession(steps: { zaehlen: number; rechnen: number }, kindCount: number, random?: () => number): Task[]` — three zaehlen tasks then two rechnen tasks, shuffled within each ladder; steps ≥ 6 use step 5.
  - `stepRange(ladder: Ladder, step: number): number` — the largest number a step asks for (zaehlen 10/20/20/100/100, rechnen 5/10/10/20/100), used for choices.

Per step (spec tables): Zählen 1 = count ≤10, die; 2 = count ≤20, die, next +1 ≤20; 3 = next ±1/+2 ≤20, flash ≤5; 4 = bars, next +1/+2/+5/+10 ≤100; 5 = next ±1 ≤100 and ±2/±5/±10 from tens. Rechnen 1 = plus ≤5; 2 = plus ≤10; 3 = plus/minus ≤10, doubles; 4 = plus/minus ≤20; 5 = tens plus/minus ≤100 without carrying (`bars: true`).

- [ ] **Step 1: Write the failing tests**:
  - `numberWord` 21 → "einundzwanzig", 30 → "dreißig", 99 → "neunundneunzig", 100 → "hundert".
  - `buildLadderSession` gives 3 `zaehlen` then 2 `rechnen` tasks.
  - Property test: for every ladder step 1–6 and seeds 0–199, every task has `answer` in `choices`, 3 distinct choices, all ≥ 0 and ≤ `stepRange`, minus never negative, step-5 tens sums without carrying (ones of a + ones of b ≤ 9), `flash.amount` 1–5, `bars.amount` 21–100.
  - Step 1 Zählen never asks above 10; Rechnen 2 never above 10.
  - `questionText` for `next` with by −1 from 7: "Sieben, sechs, fünf … und dann?" (exact form free, test the numbers said); for `minus`: contains "weg".
- [ ] **Step 2: Run** `npx vitest run src/core/numbers.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement**, keeping `buildSession` until Task 5 switches the School over.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat: School tasks for every step of the two ladders`

### Task 4: The School shows and scores the new tasks

**Files:**
- Modify: `src/buildings/school/flow.ts`, `flow.test.ts`, `School.vue`, `School.test.ts`, `testTasks.ts`

**Interfaces:**
- Consumes: Task 3's `Task` variants.
- Produces: `SchoolState.results: { ladder: Ladder; firstTry: boolean }[]` (one per solved task, in order); `BuildingResult` unchanged.

- [ ] **Step 1: Write the failing tests**:
  - flow: a task answered right first → `{ firstTry: true }`; wrong then right → `false`; leaving mid-task adds nothing for that task.
  - flow: `countable` for `bars` and big sums is recounted by tens then ones (recount effect gives `{ type: 'recount', amount, tens: true }` when amount > 20).
  - School.vue: a `flash` task shows its dots, then hides them after `FLASH_MS` (1500) with fake timers; a `bars` task shows `amount / 10 | 0` bars and the ones; a `minus` task shows `b` things crossed out; `next` speaks the shown numbers.
  - School.vue: ArrowRight then Enter answers a choice of 45 (Review Focus 5).
- [ ] **Step 2: Run** `npx vitest run src/buildings/school` — Expected: FAIL.
- [ ] **Step 3: Implement.** Bars: a column of ten blocks per ten, single blocks for ones, both touchable to count along. Enter answers the focused choice (add if missing).
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat: the School shows counting on, quick looks, tens bars and taking away`

### Task 5: The School asks at her steps and sends her results

**Files:**
- Create: `src/stores/school.ts`, `src/stores/school.test.ts`
- Modify: `src/services/api.ts`, `src/services/fakeApi.ts`, `src/App.vue` (init), `src/buildings/school/School.vue`

**Interfaces:**
- Consumes: Task 1 HTTP, Task 2 `applyResults`, Task 3 `buildLadderSession`, Task 4 `state.results`.
- Produces:
  - Api: `school(): Promise<Ladders>`, `schoolResults(body: SchoolResultsIn): Promise<Ladders>`, `playerSchool(personId): Promise<Ladders>`, `setPlayerStep(personId, ladder, step): Promise<Ladders>`; `interface SchoolResultsIn { key: string; zaehlen: { step: number; results: boolean[] }; rechnen: { step: number; results: boolean[] } }`.
  - `useSchoolStore()`: `init(api, personId, storage?)`, `load(): Promise<void>`, `ladders: Ref<Ladders>`, `record(results: SchoolState['results'], steps: { zaehlen: number; rechnen: number }): void`.

Model it on `src/stores/writing.ts`, simpler: one waiting list of `SchoolResultsIn` in storage under `brightville.school.<personId>`; `record` applies `applyResults` locally at once, stores the item, sends it; on success removes it; `load` fetches, then sends what waits. Before the first load answers, the steps are `startLadders(false)`. School.vue reads the steps when it opens (`buildLadderSession`) and calls `record` in `leave()` before emitting, when any task was answered.

- [ ] **Step 1: Write the failing tests** (`school.test.ts` with `fakeApi` and a fake Storage):
  - `record` moves the step locally at once and sends one POST with a key.
  - A failed POST keeps the result; the next `load` sends it again with the same key.
  - `sends the result for the child who played`: `record` for child 2, then `init` for child 3 before the answer → the stored item stays under child 2's key and child 3's ladders are untouched.
  - School.vue test: with ladders zaehlen 3, the visit's Zählen tasks come from step 3 (e.g. no task above 20, a `next` or `flash` among them over seeds); leaving after two tasks records two results.
- [ ] **Step 2: Run** `npx vitest run src/stores/school.test.ts src/buildings/school` — Expected: FAIL.
- [ ] **Step 3: Implement**, and drop `buildSession`/`LATER_ROUNDS` if nothing else uses them.
- [ ] **Step 4: Run** `npm test` — Expected: all pass.
- [ ] **Step 5: Commit** `feat: the School asks at her steps and keeps her results on the server`

### Task 6: Tags and the overview's numbers

**Files:**
- Create: `src/core/lehrplan.ts`, `src/core/lehrplan.test.ts`

**Interfaces:**
- Consumes: `Ladders`, `share` (Task 2); `Letters` (`src/core/writing/levels.ts`); `LETTERS` (`src/core/writing/letters.ts`); `LogDay` (`src/core/diary.ts`).
- Produces:
  - `ZUGAENGE: Record<1..9, string>` (spec's names); `FACHBEREICHE: Record<string, string>` (`MA` Mathematik, `D` Deutsch, `BG` Bildnerisches Gestalten, `BS` Bewegung und Sport, `MU` Musik); `TAGS: Record<buildingId, { codes: string[]; zugaenge: number[] }>` (spec table).
  - `STEP_TEXT: Record<Ladder, string[]>` — six short German texts (step 1–5, "fertig").
  - `KG_TARGETS = { zaehlen: 0.4, rechnen: 0.4, letters: 0 }`; `kgMark(): number` (27).
  - `lettersShare(letters: Letters): number` (level 4 among the 29 `LETTERS` / 29).
  - `overall(ladders: Ladders, letters: Letters): number` (whole percent).
  - `weekDays(today: string): string[]` (7 days, today first).
  - `practice(days: LogDay[], today: string): { zugang: number; name: string; visits: { building: string; times: number }[]; hasBuilding: boolean }[]` — Zugänge 1–3, 5–8 in order; counts `visit` and `free` entries within `weekDays(today)`.
  - `subjects(days: LogDay[], today: string): { code: string; name: string; visits: { building: string; times: number }[] }[]` — every Fachbereich in `TAGS`, with this week's visits.

- [ ] **Step 1: Write the failing tests**:
  - every building id in `src/buildings/registry.ts` has a `TAGS` entry (play buildings with empty lists); every Zugang in TAGS is 1–9.
  - `overall` of zaehlen 1, rechnen 1, no letters → 0; zaehlen 6, rechnen 6, all 29 letters at 4 → 100; zaehlen 3, rechnen 2, 8 letters known → round(((0.4 + 0.2 + 8/29) / 3) × 100) = 29.
  - digits at level 4 don't count in `lettersShare`.
  - `kgMark()` → 27.
  - `practice` with a Yoga visit 3 days ago and one 9 days ago → Zugang 1 lists yoga × 1; Zugang 3 `hasBuilding: false`; Zugang 4 and 9 absent; a `play` entry isn't counted.
  - `subjects` lists `BG` with Malen × 2 for two free Malen visits this week.
- [ ] **Step 2: Run** `npx vitest run src/core/lehrplan.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat: Lehrplan 21 tags and the overview's numbers`

### Task 7: The parents' Lehrplan section

**Files:**
- Create: `src/components/LehrplanOverview.vue`, `LehrplanOverview.test.ts`
- Modify: `src/components/ParentArea.vue` (child cards, after the diary)

**Interfaces:**
- Consumes: Task 5 Api methods `playerSchool`, `setPlayerStep`; existing `playerWriting`, `diary`; Task 6 functions.
- Produces: `<LehrplanOverview :api :person-id />`, a `<details data-test="lehrplan">`.

Layout as the spec's sketch: summary line with bar (`data-test="lehrplan-bar"`, width = overall %, a mark at `kgMark()` labelled "Ende Kindergarten") and the percent; inside, Mathematik (Zählen and Rechnen rows: "Stufe n von 5" or "fertig", the step text, a `<select data-test="step-zaehlen">` 1–6), Deutsch ("Buchstaben n von 29 gelernt"), the other subjects with this week's visits, then "Diese Woche geübt" by Zugang ("✓ name (Yoga ×2)", or "– name (noch kein Haus)", or "– name").

- [ ] **Step 1: Write the failing tests** (pattern of `WritingSettings.test.ts`):
  - loads nothing until opened; then calls `playerSchool`, `playerWriting`, `diary` once each.
  - shows the overall percent and step texts from the fake data.
  - changing the Zählen select calls `setPlayerStep(2, 'zaehlen', 4)` and shows the answer's step; a failed call shows "Konnte nicht speichern. Nochmal versuchen?" and the old step.
  - a Zugang with no building shows "noch kein Haus".
  - ParentArea: a child's card has the section, a parent's doesn't.
- [ ] **Step 2: Run** `npx vitest run src/components/LehrplanOverview.test.ts src/components/ParentArea.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test && npm run lint && npm run typecheck` — Expected: all pass.
- [ ] **Step 5: Commit** `feat: the parents see each child's Lehrplan 21 progress`

### Task 8: Docs

**Files:** `README.md` (School row, parents' paragraph), `docs/roadmap.md` (Done list item 12).

- [ ] **Step 1:** School row: "Five tasks at her step on two Lehrplan 21 ladders, Zählen and Rechnen; moves up by itself"; parents' paragraph: one sentence on the Lehrplan section.
- [ ] **Step 2: Run** `npm test && venv/bin/pytest -q` — Expected: all pass.
- [ ] **Step 3: Commit** `docs: the School's ladders and the Lehrplan overview`
