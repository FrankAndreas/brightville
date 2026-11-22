# Oberstufe Movement Coach (Yoga, Hüpfhalle, Tanzsaal) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At Oberstufe, Yoga, the Hüpfhalle and the Tanzsaal keep their movement detection but take their instructions from a coach in English or French: poses described in words, a counted workout, and "Simon says" / "Jacques a dit".

**Architecture:** One words module (`src/core/coach/words.ts`) holds every coach line in both languages. Yoga reuses its flow with the coach's words; the Hüpfhalle gets a workout flow (rounds of ten split into numbered parts); the Tanzsaal's Oberstufe side is a new "Simon says" flow and screen on the shared `useCameraLoop`. Each building's Oberstufe side is a small wrapper: `LanguagePick`, then the building in that language.

**Tech Stack:** Vue 3 `<script setup>` + Pinia + Vitest (jsdom); MediaPipe pose tracking through `src/services/poseTracker` and `src/core/pose`, `src/core/moves`.

**Spec:** `docs/superpowers/specs/2026-11-22-brightville-oberstufe-coach-design.md` (PR 2 of 2: Yoga, Hüpfhalle, Tanzsaal and their doors)

## Global Constraints

- Never mix languages in what the coach says: instructions, counting and praise in the visit's language (`en-GB` / `fr-FR` voice), written on screen too; the **camera setup lines stay German** (no camera, step into the picture, "I can't see you"); buttons German.
- Kindergarten unchanged: her Yoga, Hüpfhalle and Tanzsaal (flows, German, dancer, songs) exactly as now.
- `yoga`, `huepfhalle`, `tanzsaal` get `"oberstufe": { "maxStars": 9 | 9 | 10 }`; needs stay `camera`.
- Nothing childish at Oberstufe: no animal names for poses, no children's songs, no dancer to copy.
- "Left" and "right" are his own (MediaPipe's left landmarks = the person's left; a mirrored body must not count as the other side).
- Spoken when the device has a voice, always written; a coach 🔊 repeats the current instruction in the language; the first instruction of a visit also shows "Mach, was der Coach sagt".
- Yoga: the same poses, number and hold times; each pose described ("Stand on one leg. Put your hands together above your head."), a neutral title; the pose picture appears as a hint after 6 s on a pose. Stars as now (3 per pose, cap 9).
- Hüpfhalle: three rounds of ten, each round split into parts of 3–7 that add up to ten, the move may change between parts ("Do four squats!" then "Do six jumping jacks!"); the coach counts every rep in the language; Stars 3 per round (cap 9).
- Tanzsaal: 15 commands from: both arms up, arms out to the side, hands on hips, hands on head, clap, left arm up, right arm up (no waving); 10 with "Simon says" / "Jacques a dit" (do it within 4 s), 5 without (don't do it during 4 s; "Simon didn't say so!" / "Jacques n'a pas dit!" when he does); one point each; Stars = ceil(10 × points / 15) (cap 10); a beat in the background, no dancer.
- Commits end with the two attribution lines. Tests: `npx vitest run <path>`; whole: `npm test`, `npm run lint`, `npx vue-tsc --noEmit`, `venv/bin/pytest -q`.

## Review Focus

1. Left and right: "left arm up" counts only his own left, and a body seen mirrored (as on the screen) doesn't turn it into a right. (Task 3)
2. A trap command while he is still holding the previous move (e.g. arms still up from "Simon says arms up", then trap "arms up"): he must lower and stay still; holding on is following it. Decide and test. (Task 3)
3. Losing sight of him mid-command (he walks out of the picture): the command waits, he isn't punished for a trap he "stayed still" in by being gone, and the German "I can't see you" comes. (Task 3)
4. The Kindergarten child's three buildings: unchanged German, dancer and songs. (Tasks 5, 6)
5. The town's German 🔊 never repeats a coach line, and the coach 🔊 never speaks German. (Tasks 5, 6)

---

### Task 1: The doors

**Files:** Modify `shared/buildings.json`, `src/buildings/registry.ts` (`yoga.oberstufe`, `huepfhalle.oberstufe`, `tanzsaal.oberstufe` with placeholders `src/buildings/coach/CoachYoga.vue`, `CoachWorkout.vue`, `CoachSimon.vue`), `src/core/access.test.ts`, `src/buildings/registry.test.ts`; Test `tests/test_level.py`
- [ ] **Step 1: Failing tests:** `test_level.py::test_movement_buildings_open_at_oberstufe` (yoga 20 → 9, huepfhalle 20 → 9, tanzsaal 20 → 10); the access list adds them; registry: their Oberstufe sides exist and still need the camera.
- [ ] **Step 2–4:** red, implement, green. **Step 5:** Commit `feat: Yoga, the Hüpfhalle and the Tanzsaal open at Oberstufe`

### Task 2: The coach's words

**Files:** Create `src/core/coach/words.ts`, `words.test.ts`
- Produces: `CoachWords = { poseTitle(id: PoseId): string; poseSay(id: PoseId): string; workout(move: MoveId, n: number): string; number(n: number): string /* 1..10 */; simon(move: SimonMove, said: boolean): string; trap: string; great: string; done: string }`; `coachWords(lang: Lang): CoachWords`; `SimonMove = 'bothUp' | 'armsOut' | 'hips' | 'head' | 'clap' | 'leftUp' | 'rightUp'`; `COACH_HINT = 'Mach, was der Coach sagt'`.
- [ ] **Step 1: Failing tests:** every pose and move has an EN and FR title/sentence; `coachWords('en').workout('kniebeuge', 4)` = "Do four squats!", `('fr', 'hampelmann', 6)` = "Fais six sauts en étoile!"; numbers EN one…ten, FR un…dix; `simon('leftUp', true)` EN "Simon says: raise your left arm!", FR "Jacques a dit: lève le bras gauche!"; `simon('clap', false)` EN "Clap your hands!"; no pose line contains an animal word (frog, Frosch, grenouille, plane, avion, Flieger); EN lines without French letters.
- [ ] **Step 2–4:** red, write (first drafts, plain A2), green. **Step 5:** Commit `feat: the coach's words in English and French`

### Task 3: "Simon says": detection and flow

**Files:** Create `src/core/coach/simon.ts`, `simon.test.ts`
- Consumes: `matchDance`, `armUp`, `armDown`, fixtures (`src/core/moves`), `createSight`, Task 2.
- Produces: `matchSimon(move: SimonMove, body: Body, unit: number): boolean` (`leftUp`: his left arm up and the right down; `rightUp` the other way; the rest through `matchDance`); `pickCommands(rand): { move: SimonMove; said: boolean }[]` (15, 10 said, 5 not, never the same move twice in a row, the first one said); `createSimonFlow(commands, words: CoachWords)` with phases `starting | noCamera | settling | command | done`, events as the Tanzsaal (`cameraReady`, `cameraFailed`, `frame`), effects `speak` (with `ask` for a command; `coach: true` for coach lines, German setup lines without), `hit`, `miss`, `beat`, `chime`, `confetti`; `earned()`.
- Rules: a command lasts `REACT_MS = 4000` of time **while he is seen** (not seen: the clock waits). Said: matched for `HOLD_MS = 300` within it → a point and `hit`; else `miss`. Not said: he must be still for the whole time and **not in that move at any moment after the first 600 ms** (time to lower from the last one); in it → `trap` line and `miss`; else a point. A beat every 600 ms while commanding. After the 15th: `done`, confetti, `great`/`done` line.
- [ ] **Step 1: Failing tests:** `matchSimon('leftUp', LEFT_ARM_UP)` true, `('rightUp', LEFT_ARM_UP)` false, `('leftUp', mirrored(LEFT_ARM_UP))` false; `pickCommands` has 15, 10 said, no repeats in a row, first said; said command matched → point; said not matched in 4 s → miss; trap held after 600 ms → trap line, miss; trap with arms still up from the last command lowered within 600 ms → point; not seen → the 4 s don't run, no point lost; Stars ceil(10·points/15); a full run of 15 points → 10 Stars, done; the setup lines are German, the commands in the language.
- [ ] **Step 2–4:** red, implement (a `LEFT_ARM_UP` fixture added to `src/core/moves/fixtures.ts`), green. **Step 5:** Commit `feat: Simon says, in English and French`

### Task 4: The workout flow

**Files:** Create `src/core/coach/workout.ts`, `workout.test.ts`
- Consumes: `createReps`, `MOVES`, `createSight` (`src/core/moves`), Task 2.
- Produces: `splitTen(rand): number[]` (parts of 3–7 adding up to 10); `pickWorkout(rand): { move: MoveId; n: number }[][]` (3 rounds; the moves of a round's parts differ from the part before); `createWorkoutFlow(rounds, words)` with the Hüpfhalle's phases and events; effects `speak` (`ask` for an instruction, `coach: true` for coach lines), `beat`, `chime`, `confetti`.
- Rules: each part says `words.workout(move, n)`; every counted rep says `words.number(count)` (count within the part); a part done → `great` and the next part's instruction; a round done → chime, +3 Stars, the Hüpfhalle's break; after three rounds → done, confetti, `done` line.
- [ ] **Step 1: Failing tests:** `splitTen` always sums to 10 with parts 3–7 (1000 draws); a round of [4 squats, 6 hops]: says "Do four squats!", counts "one"…"four", then "Great!" and "Do six hops!", after six a chime and 3 Stars; three rounds → 9 Stars, done; lost and seen again keeps the count; setup lines German.
- [ ] **Step 2–4:** red, implement, green. **Step 5:** Commit `feat: a counted workout in English and French`

### Task 5: Yoga with the coach

**Files:** Modify `src/buildings/yoga/flow.ts` (a `words` parameter: the pose line and `done` from the coach when given, German as now when not), `YogaStudio.vue` (prop `lang?: Lang`), `src/buildings/coach/CoachYoga.vue` (LanguagePick, then `YogaStudio :lang`), tests
- `YogaStudio` with `lang`: the coach lines spoken in the language's voice and written (`data-test="coach-say"`, title above it), coach 🔊 (`data-test="coach-again"`), the town's 🔊 forgotten when the first coach line comes; the teacher's pose picture hidden until 6 s on a pose (`data-test="pose-hint"` appears then); setup lines German as now. Without `lang` exactly as now.
- [ ] **Step 1: Failing tests:** flow with coach words says `poseSay` with `coach: true`; German flow unchanged (existing tests green); YogaStudio with `lang: 'fr'`: the written line in French, spoken in `fr-FR`, no picture before 6 s, the picture after; leaving keeps the Stars.
- [ ] **Step 2–4:** red, implement, green. **Step 5:** Commit `feat: Yoga with an English or French coach`

### Task 6: The Hüpfhalle and the Tanzsaal with the coach

**Files:** Modify `src/buildings/huepfhalle/Huepfhalle.vue` (prop `lang?: Lang`: the workout flow, written line, coach 🔊); Create `src/buildings/coach/CoachWorkout.vue` (LanguagePick → `Huepfhalle :lang`), `src/buildings/coach/CoachSimon.vue` (LanguagePick → the Simon screen on `useCameraLoop`: the command written large, points as 15 dots, a beat, coach 🔊), tests
- [ ] **Step 1: Failing tests:** Hüpfhalle with `lang: 'en'` writes and speaks "Do … !" in `en-GB` and counts in English; without `lang` the Kindergarten flow (existing tests green); CoachSimon: commands written and spoken in the language, a trap answered with the trap line, 15 commands → Stars as the rule, leaving keeps the points so far; the dancer and songs are not there.
- [ ] **Step 2–4:** red, implement, green (lint, types). **Step 5:** Commit `feat: the Hüpfhalle and the Tanzsaal with an English or French coach`

### Task 7: Docs and browser check

**Files:** Modify `README.md`, `docs/roadmap.md`
- [ ] **Step 1:** README (Oberstufe: the three buildings), roadmap (piece 4 done; to try on the iPad: left/right, the trap timing, the 6 s hint, reps counted aloud).
- [ ] **Step 2:** Browser check on 5188 (the harness's pose tracker is a stub: check that each Oberstufe side opens, picks the language, writes and speaks its first instruction, and shows no console errors).
- [ ] **Step 3:** `npm test && npm run lint && npx vue-tsc --noEmit && venv/bin/pytest -q` → clean. Commit `docs: README and roadmap for the movement coach`
