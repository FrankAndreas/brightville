# Brightville Stage 2 – School, Arcade and the Daily Goal

Nov 12, 2026 · Andreas Frank

Stage 2 of the strategy in `2026-11-12-brightville-stage1-design.md`: the first two games absorbed from Spielzeugkiste and the full loop "learn first, play later".
Andreas asked to continue with the plan; every decision below that the strategy did not already fix is marked **(call)** and is Claude's.

## Intent

After stage 1 the child can earn Stars but has nothing to do with them.
Stage 2 gives Stars a purpose: a second place to earn them (the School, counting and first sums) and a place to spend them (the Arcade, Memory), which only opens once today's learning is done.

## Goals

- The School: Zahlen from Spielzeugkiste as a building. Usable with keyboard, mouse or touch, so it also works without a camera.
- The Arcade: Memory from Spielzeugkiste as a building that costs Stars.
- A daily goal the child can see filling up, and an Arcade door that opens when it is full.
- Still no reading needed anywhere.

## Non-goals

- Parent settings for the goal, the costs or a screen-time cap (stage 4).
- Zahlen's "Mengen legen" and "Hören" rounds, the level up to 20, themes, finger pictures **(call: later)**.
- Memory themes with drawn pictures, several players, grid sizes **(call: later)**.
- Touch controls for walking (stage 3).

## Anti-goals

- The child feels punished: a wrong answer never costs Stars, never buzzes, never shows a red cross.
- Stars disappear without the child having chosen it.
- The Arcade can be reached without learning first.

## The School 🔢

One visit is **5 tasks**: a small count (1–5) first, then count, dice, plus and plus in random order, all with amounts up to 9 **(call)**.

| Round | Shown | Asked aloud |
|---|---|---|
| Zählen | 0–9 objects spread loosely | "Wie viele Äpfel?" |
| Würfel | one die face | "Wie viele Punkte?" |
| Plus | two groups with a + between | "Zwei Äpfel und drei Äpfel. Wie viele zusammen?" |

- Objects are emoji with German singular and plural, as in Spielzeugkiste: 🍎 ein Apfel/Äpfel, 🦄 ein Einhorn/Einhörner, ⭐ ein Stern/Sterne, 🚒 ein Feuerwehrauto/Feuerwehrautos, 🧁 ein Törtchen/Törtchen, 🎈 ein Ballon/Ballone **(call)**.
- Clicking or tapping an object marks it and says the next number, like pointing with a finger.
- Three big answer buttons: the right number and two near ones. Choosing: click or tap, the digit key of the number, or Left/Right to move and Enter to choose **(call)**. Moving onto a button says its number.
- **Right:** "Super! Fünf!", one of five stars at the top fills, next task.
- **Wrong:** the button fades, the voice says "Hmm, zähl nochmal mit mir", every object is counted aloud while it lights up, then the child picks again. The task ends only when it is right; a corrected answer counts too.
- **Stars:** 1 per task, plus 5 for finishing all five: 10 per full visit. Leaving early with Esc keeps the Stars of the tasks done.
- The game logic (`numbers.js`) and its tests are ported from Spielzeugkiste.

## The Arcade 🃏

- Memory for one player: 6 pairs on a 4 × 3 grid, animal emoji with spoken names **(call)**.
- Turning a card: click or tap, or move a highlight with the arrow keys and press Enter.
- Two different cards turn back after a moment; a pair stays open and its name is said.
- All pairs found: confetti, "Super gemacht!", back to the square.
- **Cost:** 3 Stars per round, taken on entering. Esc leaves; the Stars are not given back **(call)**.
- The deck logic (`memory.js`) and its tests are ported from Spielzeugkiste.

## The daily goal

- The goal is **2 earning visits today** **(call)**. A visit counts when it earned at least one Star, in any earning building (School or Yoga Studio, the same one twice is fine).
- "Today" is the calendar day of the device. A new day starts at 0 again; Stars are kept.
- Next to the Star counter: two slots that fill with a tick, then an Arcade picture that lights up.
- When the second slot fills: confetti over the town and the voice says "Geschafft! Die Spielhalle ist offen!"

### The Arcade door

| Situation | Door | In front of it |
|---|---|---|
| Goal not reached | grey, a lock on the sign | lock picture and the goal slots; voice "Erst lernen, dann spielen!" |
| Goal reached, fewer than 3 Stars | grey | a star with a 3; voice "Du brauchst drei Sterne." |
| Goal reached, 3 Stars or more | glowing | Arcade picture, a star with a 3 and the Enter key; voice "Spielhalle. Das kostet drei Sterne." |

The door changes in the town the moment its situation changes.

## The town

The School stands left of the Yoga Studio and the Arcade right of it, on the far side of the square, each with its own colour and sign; they replace the two scenery houses there **(call)**.

## How it fits the code

- `BuildingDef` gains `kind: 'earn' | 'play'` and, for play buildings, `cost`.
- The save format becomes version 2: Stars, the day, and the earning visits of that day. A version 1 save is carried over with its Stars.
- All goal and door rules are pure functions in `src/core`.
- The town learns to change a door after it was built.
- Both new buildings follow the existing contract: a component that emits `finished` with `{ stars }`.

## How we know it works

- Unit tests for the ported logic, the goal rules, the save migration, both building screens and the door flow.
- A walk-through in the browser: School visit → slot fills; second visit → Arcade opens; Memory round → 3 Stars gone; next day → slots empty.
- Andreas's child plays it.
