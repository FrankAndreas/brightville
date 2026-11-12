# Brightville

A small, friendly town for a kindergarten-age child: walk a wobbly character around, go into buildings, and earn Stars there by learning and moving.
Everything the child sees is pictures and a German voice; no reading is needed.

The town square has a trampoline, balls to push and three buildings:

| Building | What happens inside | Stars |
|---|---|---|
| 🔢 School | Five tasks: counting, a die, first sums up to 9 | +1 per task, +5 for all five |
| 🧘 Yoga Studio | The camera checks three poses | +3 per pose held |
| 🃏 Arcade | Memory with six pairs of animals | costs 3 per round |

**Learn first, play later:** the Arcade door stays locked until two earning visits are done today (School or Yoga, in any mix). The slots next to the Star counter show how far the child is. A new day starts the slots over; Stars are kept.
Stars and today's visits are saved in the browser.

The idea behind the game is in [Learning City – Gameplay Design.md](Learning%20City%20%E2%80%93%20Gameplay%20Design.md).
How it is built and what comes next is in [docs/superpowers/specs/2026-11-12-brightville-stage1-design.md](docs/superpowers/specs/2026-11-12-brightville-stage1-design.md);
the plan for stage 1 is in [docs/superpowers/plans/2026-11-12-brightville-stage1.md](docs/superpowers/plans/2026-11-12-brightville-stage1.md).
Stage 2 (School, Arcade, daily goal) has its own [design](docs/superpowers/specs/2026-11-12-brightville-stage2-design.md) and [plan](docs/superpowers/plans/2026-11-12-brightville-stage2.md).

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
CI (`.github/workflows/ci.yml`) runs the audit, the tests, lint and the build on every push to `main` and on pull requests.

The camera only works on `localhost` or over HTTPS. On a plain `http://` address the Yoga Studio door stays closed.

## Controls

| Action | Keyboard |
|---|---|
| Walk | Arrow keys or W A S D |
| Jump | Space |
| Go into a building | Enter or E, in front of the glowing door |
| Leave a building | Esc |
| Show the controls | H or F1, or the ? button |

A new player (0 Stars) sees the controls as pictures at the start, read aloud; any key closes them.

The trampoline bounces by itself. A long fall makes the character tumble for a moment; nothing is ever lost.

## School

The question is asked aloud. Pointing at an object (click or tap) counts it aloud.
Answer with the digit key, with Left/Right and Enter, or by clicking a button.
A wrong answer only fades its button and the objects are counted together; the task ends when it is right.

## Arcade

Turn cards by clicking, or with the arrow keys and Enter. Esc leaves; the 3 Stars are not given back.

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
| `src/core` | Pure logic with tests and no browser code: saving, the daily goal, door rules, counting tasks, Memory, pose rules |
| `src/input` | Turns the keyboard into intents (move, jump, go in, leave); touch comes later |
| `src/city` | The 3D town: Three.js for drawing, Rapier for physics |
| `src/buildings` | One folder per building, plus the list of buildings in `registry.ts` |
| `src/services` | Voice, sound, camera, body tracking, storage, device detection |

A building is a Vue component that emits `finished` with `{ stars }`. To add one, write the component and add an entry to `src/buildings/registry.ts` with its door position, picture, spoken name, whether it earns or costs Stars (`kind`, `cost`) and what it needs from the device (camera, touch, keyboard). The town shows a door as closed when the device can't serve it.

In development mode, pressing L in the Yoga Studio prints the tracked body to the browser console, which is how real poses can be turned into test data.
