# Kalender Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new earning building, the Kalender (order of a day, time of day, weekdays, yesterday/tomorrow from the real day, seasons, full and half hours), on a fifth Lehrplan ladder, Zeit.

**Architecture:** `zeit` joins the ladder machinery (server field + constants; the app already loops). Tasks are made in `src/core/kalender.ts` from the step and the real date; a pure flow (`src/buildings/kalender/flow.ts`) with the Musterwerkstatt's "say this while that lights up" effects; a screen (`Kalender.vue`) with drawn suns and clocks. A scenery house at (3.5, −24) becomes the building.

**Tech Stack:** Vue 3, Pinia, Vitest; FastAPI, pytest.

**Spec:** `docs/superpowers/specs/2026-11-20-brightville-kalender-design.md`

## Global Constraints

- Everything spoken; nothing to read. Day cards keep fixed colours (Montag … Sonntag); today's card in the week strip has a sun.
- "Heute" is the device's date, read once at the visit's start; seasons by month (Mar–May Frühling, Jun–Aug Sommer, Sep–Nov Herbst, Dec–Feb Winter).
- Every question has exactly one right answer.
- Zeit: steps 1–5 and 6 "fertig"; window 10, misses 2, start 1. Five tasks; 1 Star each + 5; `minSecondsPerStar` 2.
- Building: id `kalender`, spoken name `Kalender`, icon `🗓️`, kind `earn`, needs `[]`, door at the scenery house (3.5, −24, side right), removed from `SCENERY_HOUSES`.
- Overall number: six shares; `KG_TARGETS.zeit = 0.8` → mark 53. Tags `kalender: { codes: ['MA.3'], zugaenge: [3, 8] }`.
- Lessons from the last two reviews: lit reset per run; 🔊 (`askedAgain`) stops a run while asking; `forgetInstruction()` on a solve; `sync()` before returning on empty effects; whole German sentences.
- Repo checks as before (npm test/lint/typecheck; pytest, black, flake8 `--max-line-length=120 --extend-ignore=E203,W503`, mypy).

## Review Focus

1. Sunday/Monday wrap-around: "Was kommt nach Sonntag?" → Montag; "gestern" on a Monday → Sonntag. (Task 3 tests)
2. "halb eins" (12:30), "ein Uhr" (not "eins Uhr"), and an hour hand between the hours on a half hour. (Task 3 tests, Task 5 drawing)
3. A visit that starts before midnight and ends after keeps its "heute". (Task 5 test: date injected)
4. Order task: a wrong tap, a tap on a placed picture, taps during the cheer. (Task 4 tests)
5. Old data without `zeit`. (Task 2 tests)

---

### Task 1: Server — Zeit, the fifth ladder

**Files:** `backend/app/school.py` (`WINDOW`, `MISSES_ALLOWED`, docstring), `backend/app/main.py` (`zeit: LadderResultIn | None = None`), `tests/test_school.py`.

- [ ] Failing tests: `state()` helper includes `zeit`; a new child starts at 1; ten answers with two misses move up; only-Zeit result leaves the others; a parent sets Zeit. Run → FAIL. Implement. Run pytest/black/flake8/mypy → PASS. Commit `feat: Zeit, a fifth Lehrplan ladder on the server`.

### Task 2: App ladders

**Files:** `src/core/ladders.ts` (`'zeit'` in `Ladder`, `LADDERS`, `WINDOW` 10, `MISSES_ALLOWED` 2, `startLadders`, `SchoolLadder` excludes it), `src/core/lehrplan.ts` (`STEP_TEXT.zeit`: `Tagesablauf ordnen`, `Morgen, Mittag, Abend, Nacht`, `Wochentage`, `gestern, morgen, Jahreszeiten`, `volle und halbe Stunden`, `fertig (Ende 2. Klasse)`), fixtures; tests `ladders.test.ts`, `school.test.ts`.

- [ ] Failing tests: Zeit moves after 10 with 2 misses; `startLadders` includes it; a Kalender visit sends only Zeit; cached steps from before Zeit give step 1. Run → FAIL. Implement. `npm test`, typecheck, lint → PASS. Commit `feat: Zeit in the app's ladders`.

### Task 3: The Kalender's tasks

**Files:** Create `src/core/kalender.ts`, `src/core/kalender.test.ts`.

**Interfaces:**
```ts
export const DAYS: string[]                         // 'Montag' … 'Sonntag' (index 0 = Monday)
export const DAY_COLOURS: string[]                  // seven fixed colours
export type TimeOfDay = 'morgen' | 'mittag' | 'abend' | 'nacht'
export type Season = 'fruehling' | 'sommer' | 'herbst' | 'winter'
export interface ClockTime { hour: number; half: boolean }   // hour 1–12
export interface Activity { id: string; say: string; emoji: string }
export type Choice = { id: string; say: string } & (
  | { kind: 'sun'; time: TimeOfDay } | { kind: 'day'; day: number } | { kind: 'season'; season: Season; emoji: string }
  | { kind: 'clock'; clock: ClockTime })
export type ZeitTask =
  | { type: 'order'; items: Activity[]; shown: Activity[] }          // items in the right order, shown shuffled
  | { type: 'pick'; topic: 'time' | 'day' | 'season' | 'clock'; question: string; choices: Choice[]; answer: string }
export interface ExampleLine { text: string; light?: string; place?: string; clock?: ClockTime }
export interface ZeitExample { task: ZeitTask; lines: ExampleLine[] }
export const TASKS_PER_VISIT = 5
export function weekdayOf(date: Date): number      // Monday 0 … Sunday 6
export function seasonOf(date: Date): Season
export function clockName(t: ClockTime): string    // 'drei Uhr', 'ein Uhr', 'zwölf Uhr', 'halb vier', 'halb eins'
export function buildZeitSession(step: number, today: Date, random?: () => number): ZeitTask[]
export function exampleFor(step: number, windowLength: number, today: Date): ZeitExample | null
```
Content per the spec's table and its mix line. Step 2 questions with one answer only: `Wann frühstückst du?` (morgen), `Wann geht die Sonne auf?` (morgen), `Wann isst du zu Mittag?` (mittag), `Wann steht die Sonne ganz hoch?` (mittag), `Wann geht die Sonne unter?` (abend), `Wann isst du zu Abend?` (abend), `Wann scheint der Mond?` (nacht), `Wann schlafen alle tief?` (nacht). Step 3: `Was kommt nach ${day}?` / `Was kommt vor ${day}?` (wrap around). Step 4: `Heute ist ${today}. Was war gestern?` / `Was ist morgen?`; seasons `Wann fällt Schnee?` (winter), `Wann blühen die ersten Blumen?` (frühling), `Wann ist es am heissesten?` (sommer), `Wann fallen die Blätter?` (herbst), `Welche Jahreszeit ist jetzt?` (`seasonOf(today)`). Step 5: `Wo ist es ${clockName}?` with three clocks: right, one wrong of (hour ±1 same half) or (hands swapped, for a full hour whose swap is a valid time), one with half flipped. Time and season tasks offer all four choices; day and clock three. Order sets of four from: aufstehen 🛏️, anziehen 👕, frühstücken 🥣, Zähne putzen 🪥, Mittagessen 🍝, spielen 🧸, Abendessen 🍲, baden 🛁, schlafen 🌙 (sets keep real order; e.g. aufstehen–frühstücken–Mittagessen–schlafen; aufstehen–anziehen–frühstücken–spielen; Abendessen–baden–Zähne putzen–schlafen). Example lines exactly as the spec's "Showing before asking", with `light` ('item-<id>', 'sun-<time>', 'strip-<day>', 'choice-<id>'), `place` for step 1, `clock` for step 5.

- [ ] Failing tests (seeded, 300 sessions over steps 1–6 and a range of dates): five tasks of the step's kinds; every pick has exactly one choice whose id is `answer`, choices distinct, answer in varying places; day tasks wrap (after Sonntag → Montag; gestern on a Monday → Sonntag); "Heute ist …" uses the given date's weekday; season of 2026-11-20 is herbst, of 2026-01-10 winter, of 2026-03-01 frühling, of 2026-08-31 sommer; `clockName({hour:1,half:false})` = 'ein Uhr', `{hour:12,half:true}` = 'halb eins', `{hour:3,half:true}` = 'halb vier'; clock distractors never equal the answer; order items in real order and `shown` a different order; no question twice in a visit; `exampleFor` null at 6 or window ≥ 10, step 4's example names the given date's today/yesterday/tomorrow.
- [ ] Run → FAIL; implement; run → PASS. Commit `feat: the Kalender's tasks`.

### Task 4: The flow

**Files:** Create `src/buildings/kalender/flow.ts`, `flow.test.ts`.

**Interfaces:**
```ts
export type ZeitEffect =
  | { type: 'speak'; text: string; light?: string; ask?: boolean; again?: string }
  | { type: 'place'; id: string }          // an order item moves into the next place
  | { type: 'clock'; clock: ClockTime }    // the example's clock shows this time
  | { type: 'wiggle'; id: string } | { type: 'chime' } | { type: 'confetti' }
export interface ZeitState {
  index: number; task: ZeitTask | null; wrong: string[]; placed: string[]; missed: boolean
  solved: number; stars: number; results: { ladder: 'zeit'; firstTry: boolean }[]
  phase: 'example' | 'asking' | 'cheering' | 'done'
}
export function createZeitFlow(tasks: ZeitTask[], example: ZeitExample | null): {
  readonly state: ZeitState; start(); exampleDone(); choose(id: string); tap(itemId: string); next()  // each returns ZeitEffect[]
}
```
Texts: order ask `Was machst du zuerst? Tippe die Bilder der Reihe nach an.` (ask); a right tap: `place`, its name said; wrong tap: `wiggle`, `Hmm, was machst du davor?`, missed; all four: chime, `Zuerst ${a}, dann ${b}, dann ${c}, dann ${d}.` , `Super!`. Pick ask: the question (ask, `again` = question + names when named), then for topic ≠ clock each choice named with `light: 'choice-<id>'`; right: chime, `${say}! Super!` (clock: `Super!`); wrong: faded, `Hör nochmal gut zu.`, question and names again (only what is left). Example: its lines as speak/place/clock effects, first line ask with `again` = all lines. End: confetti + `Super gemacht!`.

- [ ] Failing tests: example first, then ask; order right taps place in order, wrong tap wiggles and counts missed, tap on placed or unknown does nothing, all four → solved with the whole order said; pick right/wrong/faded, named choices except clocks; taps during example and cheer do nothing; 10 Stars after five. Run → FAIL; implement; PASS. Commit `feat: the Kalender's flow`.

### Task 5: Screen and town

**Files:** Create `src/buildings/kalender/Kalender.vue`, `Kalender.test.ts`, `ClockFace.vue`, `SunSky.vue`; modify `registry.ts` (+test), `shared/buildings.json`, `src/city/map.ts` (remove scenery house at (3.5, −24)), `src/city/world.ts` (21st colour pair), `src/core/lehrplan.ts` (`TAGS.kalender`).

**Interfaces:** props `{ tasks?: ZeitTask[]; example?: ZeitExample | null; today?: Date }` (today defaults to `new Date()` read once); snapshot step and player; leave → `school.record(results, { zeit: step }, player)`. Week strip: seven cards (`strip-<i>`, `data-today`), shown on day tasks. Test ids: `item-<id>` (`data-placed`, `data-wiggle`), `slot-<n>`, `choice-<id>` (`data-faded`, `data-lit`), `example`.

- [ ] Failing tests: an order task — taps in order fill the slots; a wrong one wiggles; a day pick shows the strip with today's sun from the `today` prop and three named cards; a clock pick shows three clocks; leaving records solved tasks at the visit's step for the starting child; no `tasks` → built at the store's Zeit step; registry entry, buildings.json, scenery house gone. Run → FAIL; implement; `npm test`, lint, typecheck, pytest → PASS. Browser check at 1180×820, 1024×768, 768×1024 (harness on 5188, removed after). Commit `feat: the Kalender, a building for time`.

### Task 6: Parents' overview

- [ ] Failing tests: `overall` over six shares (`ladders(3,2,4,3,2)` with MIAPLENO); `kgMark()` 53; overview has `ladder-zeit` under Mathematik and sets it; percent in the existing test becomes `(0.4+0.2+0+0+0+3/29)/6` → 12 %. Implement (`KG_TARGETS.zeit = 0.8`, Mathematik gets Zeit). PASS. Commit `feat: Zeit in the parents' Lehrplan overview`.

### Task 7: README and roadmap

- [ ] README row + section, parents' paragraph (six parts, about 53 %); roadmap item 15, the calls. Commit `docs: the Kalender in the README and roadmap`.
