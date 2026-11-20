# Trommelhaus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new earning building, the Trommelhaus: rhythm tasks answered by tapping drums or clapping (microphone), chosen at the door, on a seventh Lehrplan ladder, Rhythmus.

**Architecture:** `rhythmus` joins the ladders (server field + constants; app loops; overview under Musik). A pure module `src/core/rhythm.ts` makes tasks and judges hits; `src/services/microphone.ts` opens the mic and reports loudness levels (fakeable); a pure flow `src/buildings/trommelhaus/flow.ts`; the screen `Trommelhaus.vue` plays beats on a timer clock, shows the light and figure, collects taps or claps.

**Spec:** `docs/superpowers/specs/2026-11-20-brightville-trommelhaus-design.md`

## Global Constraints

- Rhythmus: window 10, misses 2, start 1. Five tasks; 1 Star each + 5; `minSecondsPerStar` 3. Three tries a task, then shown and moved on (missed, Star kept).
- Never listens while the house plays or speaks. In clapping mode the beat is light-only after the two listening beats.
- Tolerances: keep ±200 ms, ≥ 6 of 8; copy: same count, each gap within 35 %; clap loud ≥ 1.5 × quiet (mean peak); 6 s to start, two silences = one try.
- Mic refused/missing → tapping with "Das Mikrofon hört gerade nicht zu. Dann tippen wir!"; two tasks running with nothing heard → tapping with "Ich höre dich nicht. Tipp einfach auf die Trommel!".
- Building: id `trommelhaus`, spoken name `Trommelhaus`, icon `🥁`, kind `earn`, needs `[]`, a scenery house near the Tanzsaal.
- Overall: eight shares; `KG_TARGETS.rhythmus = 0.6` → 55. Tags `trommelhaus: { codes: ['MU'], zugaenge: [1, 2] }`. Step texts: `Takt halten`, `schnell und langsam`, `laut und leise`, `Rhythmen nachklatschen`, `längere Rhythmen`, `fertig (Ende 2. Klasse)`.

## Review Focus

1. The house's own drum heard by the mic (clap mode): the listening window never overlaps a sound. (Task 5 test)
2. A visit with a dead mic never stalls. (Task 4/5 tests)
3. Judging at the tolerance edges (199 vs 201 ms; 35 % gaps; 5 vs 6 of 8). (Task 3 tests)
4. Leaving mid-listening closes the mic. (Task 5 test)
5. Old data without `rhythmus`. (Task 2 test)

### Task 1: Server — Rhythmus (as Raum)
### Task 2: App ladders, overview under Musik, number and tags (as Raum)
### Task 3: `src/core/rhythm.ts` — tasks, texts, judging, onsets
```ts
export type Mode = 'tap' | 'clap'
export type Dyn = 'laut' | 'leise'
export type RhythmTask =
  | { type: 'keep'; bpm: number; speed?: 'schnell' | 'langsam' }        // 2 lead-in + 8 beats
  | { type: 'dynamics'; order: Dyn[] }
  | { type: 'copy'; gaps: number[] }                                      // ms between beats
export interface Hit { t: number; big?: boolean; peak?: number }          // ms from the listening start
export const LEAD_IN = 2, KEEP_BEATS = 8, TOLERANCE_MS = 200
export function beatTimes(task: RhythmTask): number[]                     // the house's beats, ms from the start of playing
export function buildRhythmSession(step: number, random?: () => number): RhythmTask[]
export function taskText(task: RhythmTask, mode: Mode): string
export function judge(task: RhythmTask, hits: Hit[], mode: Mode): boolean // hits relative to the first judged beat (keep) or free (others)
export function findOnsets(levels: { t: number; level: number }[], floor: number): Hit[]
export function exampleFor(step: number, windowLength: number): boolean   // whether to show the task once first
```
### Task 4: `src/services/microphone.ts` + `src/buildings/trommelhaus/flow.ts`
Flow phases `choosing | example | playing | listening | cheering | done`; effects `speak`, `play { task; listen: boolean }`, `listen`, `chime`, `confetti`, `mode { mode }`; methods `choose(mode)`, `start()`, `played()`, `answered(hits)`, `silent()`, `micFailed()`, `next()`.
### Task 5: Screen + town (door choice, drums, light, figure, timing, mic open/close)
### Task 6: Docs
Each task: failing tests first, then code, all checks green, commit.
