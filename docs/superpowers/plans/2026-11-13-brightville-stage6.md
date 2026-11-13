# Stage 6 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hüpfhalle and Tanzsaal (camera, progress only upward), then Mein Haus with a logbook and stickers.

**Architecture:** Move rules are pure logic in `src/core/moves/`, driven frame by frame like Yoga's `createHold`. Each building has a pure flow (`flow.ts`) that turns camera/frame events into state and effects; the Vue screen only plays effects. Stickers and the logbook are computed on the server from `events`; the page shows them.

**Tech Stack:** Vue 3, Pinia, TypeScript, Vitest; FastAPI with sqlite3, pytest.

**Spec:** `docs/superpowers/specs/2026-11-13-brightville-stage6-design.md`

## Global Constraints

- German for the child, English in code. Mistakes and tracking loss never take anything away.
- Yoga does not change.
- New tables only through a new step in `MIGRATIONS`.
- `npm test`, `npm run lint`, `npm run typecheck`, `pytest`, `black --check backend tests` all green before each PR.

## Review Focus

1. Raised hands leaving the top of the picture must still count as "up".
2. Tracking lost mid-move: the count pauses and never drops; the dance song does not advance while she is unseen.
3. Noise flickering across a threshold must not count extra moves.
4. A sticker must be given once, even when two visits arrive at the same time or are sent twice.
5. The logbook must group events by local day (the server clock's day), not by UTC.

---

## PR A: branch `stage6-moves`

### Task 1: Sight and arms (`src/core/moves/sight.ts`, `arms.ts`)
- `upperBodySeen(b)`: nose and both shoulders seen.
- `createSight()` → `update(body, dtMs)` returns `{ seen, ready, lost, sayLost, standY, unit }`: ready after 1000 ms seen (baseline averaged then), lost after 1500 ms unseen (ready resets, baseline relearnt), `sayLost` true on the frame it becomes lost and then every 8000 ms while lost. Baseline drifts slowly only while within 0.15 units of it.
- `armUp(b, side, unit)`, `armDown(b, side, unit)`: wrist rules, elbow stands in when the wrist is out of the picture.
- Tests: fixtures in `src/core/moves/fixtures.ts`; lost/again timing; arms up with wrists missing.

### Task 2: Rep counter (`src/core/moves/reps.ts`)
- `MoveId = 'hampelmann' | 'huepfen' | 'kniebeuge' | 'strecken'`, `createReps(move)` → `update(body, sight, dtMs): boolean` true once per a→b→a; each phase must hold 60 ms (no flicker counts).
- Tests per move: a full rep counts once, flicker doesn't count, a rep with a frame of `null` in the middle still counts.

### Task 3: Hüpfhalle flow and screen (`src/buildings/huepfhalle/`)
- `createJumpFlow(moves)`: 3 rounds × 10 reps, 3 Stars each; effects speak/beat/chime/confetti; counts aloud 7…10; says lost.
- Shared camera loop `src/buildings/cameraLoop.ts` and `NoCamera.vue`, `MoveFigure.vue` (a body drawn as in `YogaTeacher.vue`).
- Component test like `YogaStudio.test.ts`.

### Task 4: Dance poses, tunes and Tanzsaal (`src/core/moves/dance.ts`, `tunes.ts`, `src/buildings/tanzsaal/`)
- `DanceMove` six arm poses, `matchDance(move, b, unit)`.
- Three tunes of 64 beats at 100 bpm; `playNote(freq)` in `sound.ts`.
- `createDanceFlow(songs)`: count-in, one move per bar, hit window bar + half a beat, time stops while lost, Stars per song `ceil(5 × hits / 16)`.

### Task 5: Town
- Registry `huepfhalle` 🦘 "Hüpfhalle" (-23, 8, left) and `tanzsaal` 🪩 "Tanzsaal" (-23, 18, left), both `needs: ['camera']`; `shared/buildings.json` maxStars 9 and 10; layout tests pass; README.

## PR B: branch `stage6-house`

### Task 6: Server
- Migration: `stickers(person_id, sticker_id, earned_at, seen)`, `goal_days(person_id, day, goal)`.
- `shared/stickers.json` catalogue; `backend/app/stickers.py` `award(db, person_id) -> list[str]` from events + goal_days; idempotent under the primary key.
- `POST /api/visits` answers `stickers: [...]`; `POST /api/free-visits`; `GET /api/stickers`; `POST /api/stickers/seen`; `GET /api/logbook?before=&days=`; parent `GET /api/players/{id}/logbook`.

### Task 7: Page
- `api.ts`, `fakeApi.ts`, player store (stickers, unseen queue), free visits recorded for Malen/Ausmalen.
- `src/buildings/haus/` (room, Tagebuch, Stickerheft), door `side: 'front'`.
- Sticker celebration in the town (at most three), parent area logbook section; README.
