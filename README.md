# Brightville

A small, friendly town for a kindergarten-age child: walk a wobbly character around, go into buildings, and earn Stars there by learning and moving.
Everything the child sees is pictures and a German voice; no reading is needed.

The town square has a trampoline, balls to push and four buildings:

| Building | What happens inside | Stars |
|---|---|---|
| 🔢 School | Five tasks: counting, a die, first sums up to 9 | +1 per task, +5 for all five |
| ✏️ Schreiben | Two letters or digits, each traced three times with less help (touch screen only) | +1 per tracing, +4 for all six |
| 🧘 Yoga Studio | The camera checks three poses | +3 per pose held |
| 🃏 Arcade | Memory with six pairs of animals | costs 3 per round |

**Learn first, play later:** the Arcade door stays locked until two earning visits are done today (School, Schreiben or Yoga, in any mix). The slots next to the Star counter show how far the child is. A new day starts the slots over; Stars are kept.
Stars and today's visits are saved in the browser.

The idea behind the game is in [Learning City – Gameplay Design.md](Learning%20City%20%E2%80%93%20Gameplay%20Design.md).
How it is built and what comes next is in [docs/superpowers/specs/2026-11-12-brightville-stage1-design.md](docs/superpowers/specs/2026-11-12-brightville-stage1-design.md);
the plan for stage 1 is in [docs/superpowers/plans/2026-11-12-brightville-stage1.md](docs/superpowers/plans/2026-11-12-brightville-stage1.md).
Stage 2 (School, Arcade, daily goal) has its own [design](docs/superpowers/specs/2026-11-12-brightville-stage2-design.md) and [plan](docs/superpowers/plans/2026-11-12-brightville-stage2.md).
Stage 3 (iPad and NAS) has a [design](docs/superpowers/specs/2026-11-12-brightville-stage3-design.md) and a [plan for its first part](docs/superpowers/plans/2026-11-12-brightville-stage3-part1.md).

## Run it

Requires Node 22 or later.

```bash
npm install        # also copies the body-tracking files into public/mediapipe/ and enables the git hook
npm run dev        # http://localhost:5173
npm test           # Vitest
npm run lint       # ESLint
npm run typecheck  # vue-tsc
npm run build      # type check, then static files in dist/
```

The pre-commit hook (`.githooks/pre-commit`, the same script as in the other family repos) runs lint and the type check on commits that touch code.
CI (`.github/workflows/ci.yml`) runs the audit, the tests, lint and the build on every push to `main` and on pull requests, and builds the container image; a push to `main` publishes it as `ghcr.io/frankandreas/brightville:latest`.

Running it on the NAS for the iPad: [docs/deploy-nas.md](docs/deploy-nas.md).

The camera only works on `localhost` or over HTTPS. On a plain `http://` address the Yoga Studio door stays closed.

## Controls

| Action | Keyboard | Touch screen |
|---|---|---|
| Walk | Arrow keys or W A S D | Drag a finger anywhere in the left half of the screen |
| Jump | Space | The yellow arrow button, bottom right |
| Go into a building | Enter or E, in front of the glowing door | Tap the picture that appears at the door (a mouse click works too) |
| Leave a building | Esc | The door button, top left (also for the mouse) |
| Show the controls | H or F1 | The ? button |

Keys and fingers work at the same time. The stick and the jump button appear only on a device with a touch screen.

A new player (0 Stars) sees the controls as pictures at the start, read aloud; any key or tap closes them. A device with touch and no mouse gets the finger pictures instead of the keys.

The trampoline bounces by itself. A long fall makes the character tumble for a moment; nothing is ever lost.

## School

The question is asked aloud. Pointing at an object (click or tap) counts it aloud.
Answer with the digit key, with Left/Right and Enter, or by clicking a button.
A wrong answer only fades its button and the objects are counted together; the task ends when it is right.

## Arcade

Turn cards by clicking, or with the arrow keys and Enter. Esc leaves; the 3 Stars are not given back.

## Schreiben

Capital letters, Ä Ö Ü and the digits in the Deutschschweizer Basisschrift, with the stroke order Swiss schools teach. The paths and the tracing rules come from Spielzeugkiste.

The child traces each stroke from the green dot with a finger or a pen; the traced part turns green. A resting hand is ignored: a touch much larger than the pen doesn't count.
Each letter comes three times: with the whole path and arrows, with dots only, then with just the start.
Lifting early starts that stroke again. Nothing is ever taken away.

The door is open only on a device with a touch screen.

## Yoga Studio

1. The browser asks for the camera. Without one, a crossed-out camera is shown and Enter leads back.
2. Stand so that head to knees are in the picture; the outline turns green.
3. The teacher shows a pose and names it. Hold it until the ring is full (5 seconds). A wobble only drains the ring slowly.
4. After 30 seconds without success the teacher moves on, with no Stars and no comment.

The five poses are Stern, Riese, Baum, Frosch and Flieger. Their rules are in `src/core/pose/poses.ts`.

Camera pictures are analysed in the page and thrown away. Nothing is recorded or sent anywhere.
The tracking model (`public/mediapipe/pose_landmarker_lite.task`, from Google's MediaPipe) is part of the repo, so the game works offline.

## How the code is organised

| Folder | What it holds |
|---|---|
| `src/core` | Pure logic with tests and no browser code: saving, the daily goal, door rules, counting tasks, Memory, letters and tracing, pose rules |
| `src/input` | Turns the keyboard and the on-screen stick and buttons into intents (move, jump, go in, leave), merged into one source for the town |
| `src/city` | The 3D town: Three.js for drawing, Rapier for physics |
| `src/buildings` | One folder per building, plus the list of buildings in `registry.ts` |
| `src/services` | Voice, sound, camera, body tracking, storage, device detection |

A building is a Vue component that emits `finished` with `{ stars }`. To add one, write the component and add an entry to `src/buildings/registry.ts` with its door position, picture, spoken name, whether it earns or costs Stars (`kind`, `cost`) and what it needs from the device (camera, touch, keyboard). The town shows a door as closed when the device can't serve it. A building also tells `src/buildings/leave.ts` how it is left (`onLeaveRequest(leave)`), so the on-screen leave button works in it.

In development mode, pressing L in the Yoga Studio prints the tracked body to the browser console, which is how real poses can be turned into test data.
