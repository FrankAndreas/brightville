# Reimhaus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new earning building, the Reimhaus (rhymes, first sounds, syllables), on a third Lehrplan ladder, Reimen, shown in the parents' overview.

**Architecture:** The School's ladder machinery (server `school.py`, `src/core/ladders.ts`, `src/stores/school.ts`) gains a third ladder `reimen` with its own window (10) and misses allowed (2); each ladder in a result becomes optional. A word list and task maker (`src/core/rhymes.ts`), a pure flow (`src/buildings/reimhaus/flow.ts`) and a screen (`Reimhaus.vue`) follow the School's split. The parents' overview gets a Reimen row under Deutsch and a four-part overall number.

**Tech Stack:** Vue 3 `<script setup>`, Pinia, Vitest; FastAPI, pydantic, SQLite, pytest.

**Spec:** `docs/superpowers/specs/2026-11-20-brightville-reimhaus-design.md`

## Global Constraints

- Everything spoken; no letters or written words on the Reimhaus screen. Every word has an emoji picture.
- Never a buzz or red cross: a wrong answer fades / clears and is tried again; the task ends only when right.
- Reimen: steps 1–5 and 6 = "fertig"; moves up when, of the last **10** answers at the step, at most **2** were missed on the first try. Zählen 6/1 and Rechnen 4/1 stay.
- A visit: five tasks at her step; Stars `STARS_PER_TASK` (1) per solved task + `SET_BONUS` (5) at the end, 10 at most; `minSecondsPerStar` 2.
- Building: id `reimhaus`, spoken name `Reimhaus`, icon `👂`, kind `earn`, needs `[]`, door `{ x: 35.5, z: -16, side: 'right' }` (removed from `EMPTY_LOTS`; lots 0–2 keep their indexes).
- Example before the first task at steps 1–5 while the step's window holds fewer than 10 answers; none at "fertig".
- Overall number = average of Zählen, Rechnen, Reimen and Buchstaben shares; KG targets `{ zaehlen: 0.4, rechnen: 0.4, reimen: 1, letters: 0 }` → mark 45.
- Tags: `reimhaus: { codes: ['D.1.A.1'], zugaenge: [8, 2] }`.
- Endpoint, table and store names stay `school`; comments say they hold every ladder.
- Repo checks: `npm test`, `npm run lint`, `npm run typecheck`; backend `pytest`, `black --check`, `flake8 --max-line-length=120 --extend-ignore=E203,W503`, `mypy`.

## Review Focus

1. A device whose cached ladders or waiting results come from the page before Reimen (no `reimen` key) — expect the School to keep working, Reimen at step 1, and the old results to be sent and counted. (Task 2 test)
2. A parent changes the Reimen step while she is in the Reimhaus — expect the visit's answers to be recorded at the step the visit started with and ignored by the server. (Task 2 / Task 5 tests)
3. Taps during an example, a cheer, or the drum's replay — expect them to change nothing (no answer, no beat counted). (Task 4 tests)
4. Word data mistakes — a syllable split that doesn't join to the word, a distractor that rhymes or shares the first sound, the same picture twice in a task. Expect a data test to catch each. (Task 3 tests)
5. Leaving mid-visit (door button) during an example or the drum — expect only answered tasks recorded and the earned Stars kept. (Task 5 test)

---

### Task 1: Server — Reimen as a third ladder, each ladder optional in a result

**Files:**
- Modify: `backend/app/school.py`, `backend/app/main.py` (`SchoolResultsIn`)
- Test: `tests/test_school.py`

**Interfaces:**
- Produces: `WINDOW = {"zaehlen": 6, "rechnen": 4, "reimen": 10}`, `MISSES_ALLOWED = {"zaehlen": 1, "rechnen": 1, "reimen": 2}`; `apply(step, recent, results, size, misses) -> tuple[int, list[bool]]`; `state()` returns `reimen` too; `SchoolResultsIn.zaehlen/rechnen/reimen: LadderResultIn | None = None`.

- [ ] **Step 1: Write the failing tests** (the `send` helper gains `reimen=(1, [])`, sending only the ladders given as non-default; keep a default-ladders path so old tests still post both)

```python
def test_a_new_child_starts_reimen_at_1(mia):
    assert mia.get("/api/school").json()["reimen"] == {"step": 1, "window": []}

def test_ten_reimen_answers_with_two_misses_move_up(mia):
    send_only(mia, "a", reimen=(1, [True, False, True, True, True]))
    answer = send_only(mia, "b", reimen=(1, [True, True, False, True, True])).json()
    assert answer["reimen"] == {"step": 2, "window": []}

def test_three_misses_in_ten_dont_move_reimen(mia):
    send_only(mia, "a", reimen=(1, [False, False, True, True, True]))
    send_only(mia, "b", reimen=(1, [False, True, True, True, True]))
    assert state(mia)["reimen"]["step"] == 1

def test_a_result_with_only_reimen_leaves_the_others(mia):
    send_only(mia, "a", reimen=(1, [True]))
    assert state(mia)["zaehlen"] == {"step": 1, "window": []}

def test_an_old_result_without_reimen_still_counts(mia):
    send(mia, "a", rechnen=(1, [True, True]))  # the old body: zaehlen and rechnen only
    assert state(mia)["rechnen"]["window"] == [True, True]

def test_a_parent_sets_reimen(papa, mia):
    assert set_step(papa, "reimen", 4).json()["reimen"] == {"step": 4, "window": []}
```

`state()` in the test file returns all three ladders. `send_only(browser, key, **ladders)` posts only the given ladders.

- [ ] **Step 2: Run** `cd backend && pytest ../tests/test_school.py -q` (or the repo's usual pytest invocation) — Expected: the new tests FAIL (KeyError `reimen` / 422 for a missing `zaehlen`).
- [ ] **Step 3: Implement** — per-ladder misses in `apply`, loop over `WINDOW` everywhere, optional fields in `SchoolResultsIn`; module docstring says it holds every Lehrplan ladder.
- [ ] **Step 4: Run** the whole backend suite plus black, flake8, mypy — Expected: all PASS.
- [ ] **Step 5: Commit** `feat: Reimen, a third Lehrplan ladder on the server`

### Task 2: App ladders, API, fake API and store with Reimen

**Files:**
- Modify: `src/core/ladders.ts`, `src/services/api.ts`, `src/services/fakeApi.ts`, `src/stores/school.ts`, `src/buildings/school/School.vue` (steps passed as before)
- Test: `src/core/ladders.test.ts`, `src/stores/school.test.ts`

**Interfaces:**
- Consumes: Task 1's API shape.
- Produces: `type Ladder = 'zaehlen' | 'rechnen' | 'reimen'`; `LADDERS: Ladder[]` exported from `ladders.ts`; `WINDOW.reimen = 10`; `MISSES_ALLOWED: Record<Ladder, number>`; `startLadders(usedSchool)` includes `reimen: { step: 1, window: [] }`; `SchoolResultsIn = { key: string } & Partial<Record<Ladder, { step: number; results: boolean[] }>>`; store `record(results: VisitResults, steps: Partial<Record<Ladder, number>>, personId?)` — the item carries exactly the ladders named in `steps`.

- [ ] **Step 1: Write the failing tests**

```ts
// ladders.test.ts
it('moves Reimen up after ten answers with two misses', () => {
  const s = applyResults({ step: 1, window: [] }, [true, false, true, true, true, true, true, false, true, true], 'reimen')
  expect(s).toEqual({ step: 2, window: [] })
})
it('keeps Reimen with three misses in ten', () => {
  expect(applyResults({ step: 1, window: [] }, [false, false, false, true, true, true, true, true, true, true], 'reimen').step).toBe(1)
})

// school.test.ts
it('sends a Reimhaus visit with only Reimen', async () => {
  const school = await open()
  school.record(Array(5).fill({ ladder: 'reimen', firstTry: true }), { reimen: 1 })
  await flushPromises()
  expect(api.school_.reimen.window).toHaveLength(5)
  expect(api.school_.zaehlen).toEqual({ step: 1, window: [] })
})
it('takes cached steps and waiting results from before Reimen', async () => {
  storage.setItem('brightville.school.2.ladders', JSON.stringify({ zaehlen: { step: 3, window: [] }, rechnen: { step: 2, window: [] } }))
  storage.setItem('brightville.school.2', JSON.stringify([{ key: 'old', zaehlen: { step: 1, results: [] }, rechnen: { step: 1, results: [true] } }]))
  api.offline = true
  const school = await open()
  expect(school.ladders.zaehlen.step).toBe(3)
  expect(school.ladders.reimen).toEqual({ step: 1, window: [] })
  api.offline = false
  await school.load()
  expect(api.school_.rechnen.window).toEqual([true])
})
```

- [ ] **Step 2: Run** `npx vitest run src/core/ladders.test.ts src/stores/school.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** — `readKnown` fills a missing `reimen` with step 1; `readWaiting` accepts items with at least one valid ladder and no broken one; `lay` and the fake API loop over the ladders present. School.vue keeps passing `{ zaehlen, rechnen }`.
- [ ] **Step 4: Run** `npm test`, `npm run typecheck`, `npm run lint` — Expected: PASS (fix the `ladders()` helpers in other tests to include `reimen`).
- [ ] **Step 5: Commit** `feat: Reimen in the app's ladders and their store`

### Task 3: Words and the visit's tasks

**Files:**
- Create: `src/core/rhymes.ts`, `src/core/rhymes.test.ts`

**Interfaces:**
- Produces:
```ts
export interface Word { id: string; say: string; emoji: string; syllables: string[]; rhyme?: string; sound?: string }
export const WORDS: Word[]
export type RhymeTask =
  | { type: 'rhyme' | 'sound'; word: Word; choices: Word[]; answer: string }   // answer: a Word id
  | { type: 'syllables'; word: Word; answer: number }
export interface Example { kind: RhymeTask['type']; words: Word[]; text: string; beats?: number }
export const TASKS_PER_VISIT = 5
export function buildRhymeSession(step: number, random?: () => number): RhymeTask[]
export function exampleFor(step: number, windowLength: number): Example | null
```
`rhyme` groups words that rhyme (same value); `sound` is the first sound ('S', 'M', 'B', …; no Sch/St/Sp under 'S').

Step contents (spec table): 1 — 5 rhyme tasks, 2 choices; 2 — 5 rhyme, 3 choices; 3 — 5 sound, 3 choices; 4 — 5 syllables, words of 1–3; 5 — 3 syllables of 1–4 (at least one of 4) + 2 sound; 6 — 2 rhyme (3 choices), 1 sound, 2 syllables (1–4).

Example texts (exact): rhyme — `Maus – Haus. Hör mal: Maus, Haus. Das klingt am Ende gleich. Das reimt sich!`; sound — `Sonne – Sofa. Sonne, Sofa: die fangen gleich an!`; syllables — `Ba – na – ne. Hör mal: Ba – na – ne. Drei Silben. Ich trommle mit: bum, bum, bum.` (beats 3); step 5's example uses a four-syllable word the same way (`Vier Silben`, beats 4). `exampleFor` returns null at step 6 or when `windowLength >= 10`; steps 1–2 rhyme, 3 sound, 4–5 syllables.

- [ ] **Step 1: Write the failing tests**

```ts
it('splits every word into syllables that join to it', () => {
  for (const w of WORDS) expect(w.syllables.join('').toLowerCase(), w.id).toBe(w.say.toLowerCase())
})
it('has at least 12 rhyme groups of two, three words per first sound, four words per syllable count', ...)
it('uses each emoji for one word only', ...)
it('asks five tasks at each step, of the step\'s kinds', () => {
  for (let step = 1; step <= 6; step++) expect(buildRhymeSession(step, seededRandom(step))).toHaveLength(5)
  expect(buildRhymeSession(1).every(t => t.type === 'rhyme' && t.choices.length === 2)).toBe(true)
  expect(buildRhymeSession(5).filter(t => t.type === 'sound')).toHaveLength(2)
  expect(buildRhymeSession(5).some(t => t.type === 'syllables' && t.answer === 4)).toBe(true)
})
it('gives exactly one right picture: the others share neither rhyme nor first sound', () => {
  for (let seed = 0; seed < 200; seed++) for (const t of buildRhymeSession(1 + (seed % 6), seededRandom(seed))) {
    if (t.type === 'syllables') continue
    const right = t.choices.filter(c => t.type === 'rhyme' ? c.rhyme === t.word.rhyme : c.sound === t.word.sound)
    expect(right.map(c => c.id)).toEqual([t.answer])
    expect(t.choices.filter(c => c.rhyme && c.rhyme === t.word.rhyme || c.sound === t.word.sound).map(c => c.id)).toEqual([t.answer])
    expect(new Set([t.word.id, ...t.choices.map(c => c.id)]).size).toBe(t.choices.length + 1)
  }
})
it('asks no word twice in a visit', ...)
it('shows an example until two visits are done at the step, never at fertig', () => {
  expect(exampleFor(1, 0)?.kind).toBe('rhyme')
  expect(exampleFor(3, 5)?.kind).toBe('sound')
  expect(exampleFor(5, 0)?.beats).toBe(4)
  expect(exampleFor(2, 10)).toBeNull()
  expect(exampleFor(6, 0)).toBeNull()
})
```
(`seededRandom` from `@/core/numbers`.) Fill in the `...` tests with the counts above.

- [ ] **Step 2: Run** `npx vitest run src/core/rhymes.test.ts` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the word list (spec's examples; drop any word whose emoji is unclear) and the makers.
- [ ] **Step 4: Run** it again — Expected: PASS.
- [ ] **Step 5: Commit** `feat: the Reimhaus's words and tasks`

### Task 4: The Reimhaus flow

**Files:**
- Create: `src/buildings/reimhaus/flow.ts`, `src/buildings/reimhaus/flow.test.ts`

**Interfaces:**
- Consumes: Task 3's `RhymeTask`, `Example`; `STARS_PER_TASK`, `SET_BONUS` from `src/buildings/school/flow.ts`.
- Produces:
```ts
export type RhymeEffect =
  | { type: 'speak'; text: string; ask?: boolean }
  | { type: 'name'; ids: string[] }              // say each word in turn, lighting its picture
  | { type: 'drum'; syllables: string[] }         // say the syllables, lighting the drum once each
  | { type: 'chime' } | { type: 'beat' } | { type: 'confetti' }
export interface RhymeState {
  index: number; task: RhymeTask | null; wrong: string[]; beats: number; solved: number; stars: number
  results: { ladder: 'reimen'; firstTry: boolean }[]; missed: boolean
  phase: 'example' | 'asking' | 'cheering' | 'replaying' | 'done'
}
export interface RhymeFlow {
  readonly state: RhymeState
  start(): RhymeEffect[]            // the example (phase 'example') or the first question
  exampleDone(): RhymeEffect[]      // after the example's speech: the first question
  pick(id: string): RhymeEffect[]   // a picture
  tap(): RhymeEffect[]              // the drum: one beat
  clear(): RhymeEffect[]            // ↺
  done(): RhymeEffect[]             // ✓ (only with at least one beat)
  replayDone(): RhymeEffect[]       // after a wrong count's replay: try again
  next(): RhymeEffect[]
}
export function createRhymeFlow(tasks: RhymeTask[], example: Example | null): RhymeFlow
```

Texts (exact): ask rhyme `Was reimt sich auf ${say}?`; ask sound `Was fängt an wie ${say}?`; ask syllables `Wie viele Silben hat ${say}? Trommle mit!`; every picture ask is followed by `{ type: 'name', ids: [word, ...choices] }`; right picture: chime + `${word.say} – ${picked.say}! Super!`; wrong picture: `${word.say} … ${picked.say}. Hör nochmal gut zu.` then `name` of the word and the choices not yet faded; right count: chime + drum effect + `Super!`; wrong count: `Hör nochmal gut zu:` + drum effect, phase `replaying`, beats reset; end: confetti + `Super gemacht!`.

- [ ] **Step 1: Write the failing tests** — one `it` each:
  - starts with the example when given, then asks after `exampleDone`; starts asking at once without one;
  - a right pick: chime, `Maus – Haus! Super!`, first-try result `true`, one Star, phase `cheering`;
  - a wrong pick fades it, says `Maus … Ball. Hör nochmal gut zu.`, names the rest; the later right pick records `false`;
  - a faded picture or a second pick during the cheer changes nothing;
  - `tap` counts beats and returns `{ type: 'beat' }`; `done` with 0 beats does nothing; `clear` empties beats;
  - the right count: chime, drum with the syllables, result `true`; a wrong count: replaying, beats 0, `replayDone` → asking, the later right count records `false`;
  - `tap`, `pick` and `done` do nothing during `example`, `cheering` and `replaying`;
  - five solved tasks give 10 Stars (5 + bonus), confetti and `Super gemacht!` after the last `next`.
- [ ] **Step 2: Run** `npx vitest run src/buildings/reimhaus/flow.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** `createRhymeFlow`.
- [ ] **Step 4: Run** it — Expected: PASS.
- [ ] **Step 5: Commit** `feat: the Reimhaus's flow`

### Task 5: The Reimhaus screen and its place in the town

**Files:**
- Create: `src/buildings/reimhaus/Reimhaus.vue`, `src/buildings/reimhaus/Reimhaus.test.ts`
- Modify: `src/buildings/registry.ts`, `shared/buildings.json`, `src/city/map.ts` (drop the last `EMPTY_LOTS` entry, update its comment), whatever dresses a building's house in `src/city/world.ts` if it needs an entry, tests that list every building.

**Interfaces:**
- Consumes: Tasks 2–4. Props `{ tasks?: RhymeTask[]; example?: Example | null }` (built from the store's Reimen step and window when not given). Snapshot `step = school.ladders.reimen.step` and `player = school.who` at the start; on leave `school.record(flow.state.results, { reimen: step }, player)` and `emit('finished', { stars })`.

Screen: the asked word's picture large at the top; picture tasks — the answer pictures in a row of big buttons (`data-test="pick-<id>"`, faded ones `data-faded`); syllable tasks — the drum (`data-test="drum"`, lit while the drum effect plays), a row of dots (`data-test="beat"`), ✓ (`data-test="done"`, shown after the first beat) and ↺ (`data-test="clear"`). Pictures light (`data-lit`) while named. Effects carried out as in `School.vue` (`instruct` for `ask`, `speak`, `playBeat('chime')`, `playBeat('drum')` per beat and per lit syllable, confetti then leave). Fits 1180×820, 1024×768, 768×1024. Door button and 🔊 as in the School (`onLeaveRequest`).

- [ ] **Step 1: Write the failing tests** (pinia + fakeApi store as in `School.test.ts`):
  - shows the pictures of a rhyme task and answers a tap (`flow` effects visible: faded on a wrong pick);
  - drum taps add dots, ✓ appears after the first, a right count goes on to the next task;
  - leaving mid-visit records only the answered tasks for the child who started at the visit's step and emits the Stars;
  - with no `tasks` prop it builds them at the store's Reimen step (store at step 3 → a sound task);
  - registry: `reimhaus` is an earn building with door (35.5, −16) and `shared/buildings.json` has it with `maxStars` 10 and `minSecondsPerStar` 2; `EMPTY_LOTS` has three lots.
- [ ] **Step 2: Run** `npx vitest run src/buildings/reimhaus src/buildings/registry.test.ts src/city` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test`, typecheck, lint, and the backend suite (buildings.json is shared) — Expected: PASS. Check the screen at the three sizes in a browser (temporary harness on port 5188, never 5173/8000).
- [ ] **Step 5: Commit** `feat: the Reimhaus, a building for rhymes, first sounds and syllables`

### Task 6: Parents' overview — Reimen under Deutsch, four-part number

**Files:**
- Modify: `src/core/lehrplan.ts`, `src/components/LehrplanOverview.vue`
- Test: `src/core/lehrplan.test.ts`, `src/components/LehrplanOverview.test.ts`

**Interfaces:**
- Consumes: `Ladders` with `reimen` (Task 2).
- Produces: `STEP_TEXT.reimen` = [`reimt sich? aus zwei Bildern`, `reimt sich? aus drei Bildern`, `Anlaute: was fängt gleich an`, `Silben klatschen bis 3`, `Silben bis 4 und Anlaute gemischt`, `fertig (Ende Kindergarten)`]; `KG_TARGETS.reimen = 1`; `overall` averages four shares; `TAGS.reimhaus`.

- [ ] **Step 1: Write the failing tests**

```ts
it('makes one number from the four ladders', () => {
  expect(overall(ladders(1, 1, 1), {})).toBe(0)
  expect(overall(ladders(3, 2, 4), known('MIAPLENO'))).toBe(Math.round(((0.4 + 0.2 + 0.6 + 8 / 29) / 4) * 100))
})
it('marks the end of Kindergarten', () => expect(kgMark()).toBe(45))
// LehrplanOverview: a Reimen row under Deutsch with its step and a select that sets it
expect(w.find('[data-test="ladder-reimen"]').text()).toContain('Stufe 2 von 5')
await w.find('[data-test="step-reimen"]').setValue('5')
expect(api.calls).toContain('setPlayerStep 2 reimen 5')
```
Update the existing percent expectation in `LehrplanOverview.test.ts` (fake `reimen` at step 1: `(0.4 + 0.2 + 0 + 3/29) / 4` → 18 %).

- [ ] **Step 2: Run** the two test files — Expected: FAIL.
- [ ] **Step 3: Implement**; the hint line under the bar stays as it is.
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: Reimen in the parents' Lehrplan overview`

### Task 7: README and roadmap

**Files:** Modify `README.md`, `docs/roadmap.md`.

- [ ] **Step 1:** README: a Reimhaus row in the buildings table; the parents' paragraph names Reimen and the four-part number. Roadmap: item 13 (Reimhaus, #34); "Harder tasks as she grows" noted as done for the School and the Reimhaus; the design's calls under "Calls made without asking".
- [ ] **Step 2:** `npm test` still green (README isn't tested; just run once). Commit `docs: the Reimhaus in the README and roadmap`.
