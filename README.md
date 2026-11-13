# Brightville

A small, friendly town for a kindergarten-age child: walk a wobbly character around, go into buildings, and earn Stars there by learning and moving.
Everything the child sees is pictures and a German voice; no reading is needed.

The town square (60 m across) has balls to push, three trampolines, a playground at the front (a staircase of blocks up to a platform, hurdles to hop over) and its buildings: learning at the back, making things and moving on the left, playing on the right, and the child's own house at the front.

| Building | What happens inside | Stars |
|---|---|---|
| 🔢 School | Five tasks: counting, a die, first sums up to 9 | +1 per task, +5 for all five |
| ✏️ Schreiben | Two letters or digits, each traced three times with less help (touch screen only) | +1 per tracing, +4 for all six |
| 🧘 Yoga Studio | The camera checks three poses | +3 per pose held |
| 🔍 Unterschiede | Ten differences between two pictures | +1 per difference found without the lamp |
| 📚 Bibliothek | A short story read aloud with pictures, then three picture questions | +3 per question |
| 🧪 Farblabor | Two paint pots: which colour do they make? Five mixes | +2 per mix |
| 🦘 Hüpfhalle | Three rounds of ten moves (jumping jacks, hops, squats, stretches) counted by the camera; the meter only fills | +3 per round |
| 🪩 Tanzsaal | Two little songs; copy the dancer's arm moves, each one caught lights a note | up to +5 per song |
| 🎨 Ausmalen | Twenty coloring pages: pick one, tap its parts to fill them | free |
| 🖌️ Malen | Free drawing; each child's paintings are kept on the server | free |
| 🃏 Arcade | Memory with six pairs of animals | costs 3 per round |
| 🐍 Schlange | The snake collects treasures until it bites itself | costs 3 per round |
| 🍬 Bonbonjagd | Collect every sweet in a maze; chasers wander, a power-up turns the tables | costs 3 per round |
| 🎬 Kino | One of the YouTube films the parents chose | costs 3 per film |
| 🏠 Mein Haus | The logbook (Tagebuch) and the sticker book (Stickerheft) | free |

**Free** buildings are always open: before the day's learning, with no Stars, and after the play time. They neither give nor cost Stars and don't count as play time.

**Learn first, play later:** the Arcade door stays locked until today's earning visits are done (any learning or moving building, in any mix; two unless a parent set another number). The slots next to the Star counter show how far the child is. A new day starts the slots over; Stars are kept.
When a parent has set a play time per day, the Arcade door shows a moon once it is used up.

**Each child has their own Stars**, kept by the game's server (`backend/`), so the laptop and the iPad show the same.
Who is playing comes from the family hub's login; a coloured circle with the first letter next to the Star counter shows who it is.
Parents get a gear next to the "?": their page shows every child's Stars and today's numbers, and sets the daily goal, the play time per day and the Stars. Below, they keep the Cinema's list of YouTube films (a link and a name each, at most 30, the same for every child). Each child's card has a folded "Tagebuch" with the last seven days as text and the stickers earned.

The idea behind the game is in [Learning City – Gameplay Design.md](Learning%20City%20%E2%80%93%20Gameplay%20Design.md).
How it is built and what comes next is in [docs/superpowers/specs/2026-11-12-brightville-stage1-design.md](docs/superpowers/specs/2026-11-12-brightville-stage1-design.md);
the plan for stage 1 is in [docs/superpowers/plans/2026-11-12-brightville-stage1.md](docs/superpowers/plans/2026-11-12-brightville-stage1.md).
Stage 2 (School, Arcade, daily goal) has its own [design](docs/superpowers/specs/2026-11-12-brightville-stage2-design.md) and [plan](docs/superpowers/plans/2026-11-12-brightville-stage2.md).
Stage 3 (iPad and NAS) has a [design](docs/superpowers/specs/2026-11-12-brightville-stage3-design.md) and a [plan for its first part](docs/superpowers/plans/2026-11-12-brightville-stage3-part1.md).
Stage 4 (family login, server, parents) has a [design](docs/superpowers/specs/2026-11-12-brightville-stage4-design.md).
Stage 5 (the rest of Spielzeugkiste) has a [design](docs/superpowers/specs/2026-11-12-brightville-stage5-design.md), and its third part (Cinema, paintings on the server, a bigger town) [another](docs/superpowers/specs/2026-11-12-brightville-stage5-part3-design.md).
Stage 6 (Hüpfhalle, Tanzsaal, the house, stickers) has a [design](docs/superpowers/specs/2026-11-13-brightville-stage6-design.md) and a [plan](docs/superpowers/plans/2026-11-13-brightville-stage6.md).

## Run it

Requires Node 22 or later and Python 3.14.

```bash
npm install        # also copies the body-tracking files into public/mediapipe/ and enables the git hook
python3 -m venv venv && venv/bin/pip install -r backend/requirements.txt -r tests/requirements.txt black flake8 mypy

npm run dev        # the server on :8000 and the game on http://localhost:5173, without the family hub
npm test           # Vitest
npm run lint       # ESLint
npm run typecheck  # vue-tsc
npm run build      # type check, then static files in dist/
venv/bin/pytest    # the server's tests
```

**Trying it here, without the family hub:** `npm run dev` starts the server without `HUB_URL` and with `LOCAL_MODE=1`, so there is no login. The page asks who plays: big coloured circles for the people of `LOCAL_PEOPLE` (default "Kind" and "Eltern"). Tapping the circle in the town hands the game to someone else. Pick your own people:

```bash
LOCAL_PEOPLE="Mia:CHILD,Ben:CHILD,Papa:PARENT" npm run dev
```

Their Stars are kept in `backend/data/brightville.db`; delete it to start over. Anybody can pick a parent, so this mode is not for the NAS.

**With a family hub:** `HUB_URL=http://<NAS_IP>:8086 HUB_PUBLIC_URL=https://home.local.<domain> npm run dev`. The hub's login cookie only reaches pages under `local.<domain>`, so this works on `localhost` only with a `hub_session` token sent by hand (`Authorization: Bearer`). `npm run dev:web` starts the game page alone.

The pre-commit hook (`.githooks/pre-commit`, the same script as in the other family repos) runs lint and the type checks, and black, flake8 and mypy for the server, on commits that touch code.
CI (`.github/workflows/ci.yml`) runs the audit, the tests, lint and the build, the server's checks and tests, and builds the two container images; a push to `main` publishes them as `ghcr.io/frankandreas/brightville/frontend` and `.../backend`.

Running it on the NAS for the iPad: [docs/deploy-nas.md](docs/deploy-nas.md).

The camera only works on `localhost` or over HTTPS. On a plain `http://` address the doors of the Yoga Studio, the Hüpfhalle and the Tanzsaal stay closed.

## Controls

| Action | Keyboard | Touch screen |
|---|---|---|
| Walk | Arrow keys or W A S D (up always walks away from the camera) | Drag a finger anywhere in the left half of the screen |
| Turn the view | J and L while held; K turns around; I looks at the learning row again | Hold one of the round arrows above the jump button |
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

## Unterschiede

Tap a difference in either picture; the voice says what changed. The lamp 💡 circles one, which then gives no Star. Five misses within ten seconds let the pictures rest for three seconds ("Schau genau hin!"), so tapping everywhere doesn't pay. One of four scenes from Spielzeugkiste, never the same twice in a row.

## Schlange and Bonbonjagd

Arrow keys or WASD on the keyboard; a swipe anywhere or the arrow pad with a finger. The first direction starts the round.
Schlange ends when the snake bites itself; Bonbonjagd when the five lives are gone or every sweet is eaten. Then the game goes back to the town by itself. Each look (unicorn or princess) and each maze is picked at random. Before the start, Bonbonjagd offers three speeds (🐢 🐇 🐆); the child's last choice is remembered on the device. The mazes are Brightville's own.

## Kino

The door stays grey until a parent added films. Inside, a tap on a film's picture plays it full size in YouTube's privacy-enhanced player (`youtube-nocookie.com`); when it ends, the child is back in the town. One film per 3 Stars; the leave button stops it any time. The page's security rules allow exactly that player and the films' pictures (`i.ytimg.com`), nothing else from YouTube.

## Ausmalen

A tap on a picture opens it; pick a colour at the bottom, then tap a part of the picture. ↩️ takes the last fill back. Esc or the leave button goes from a picture back to the wall, and from the wall back to the town. The pages come from Spielzeugkiste and are not kept.

## Malen

➕ starts a new sheet; a tap on a painting paints further on it. Brush, pencil, eraser, six shapes (dragged from corner to corner), three sizes, twelve colours, ↩️ and 🗑.
Leaving the sheet (✅, Esc or the leave button) keeps it on the server, so the same gallery shows on the laptop and the iPad. Each child sees only their own paintings, the newest 30. When the server can't be reached, the painting waits in the browser (IndexedDB, shown with ⏳) and is sent the next time the gallery opens. A resting hand is ignored, as in Schreiben; the mouse works too.

## Schreiben

Capital letters, Ä Ö Ü and the digits in the Deutschschweizer Basisschrift, with the stroke order Swiss schools teach. The paths and the tracing rules come from Spielzeugkiste.

The child traces each stroke from the green dot with a finger or a pen; the traced part turns green. A resting hand is ignored: a touch much larger than the pen doesn't count.
Each letter comes three times: with the whole path and arrows, with dots only, then with just the start.
Lifting early starts that stroke again. Nothing is ever taken away.

The door is open only on a device with a touch screen.

**The pen.** The rules were tuned in Spielzeugkiste with a children's stylus (Edurino) on the iPad. Its recorded tries (`../kids-games/traces/`) show that Safari reports that pen as an ordinary touch of 41.6 px, the same as a fingertip, so pen and finger are treated alike. A resting hand is told apart by comparing each touch with the smallest one seen in the visit, not by a fixed size. An Apple Pencil has not been tried.

## Yoga Studio

1. The browser asks for the camera. Without one, a crossed-out camera is shown and Enter leads back.
2. Stand so that head to knees are in the picture; the outline turns green.
3. The teacher shows a pose and names it. Hold it until the ring is full (5 seconds). A wobble only drains the ring slowly.
4. After 30 seconds without success the teacher moves on, with no Stars and no comment.

The five poses are Stern, Riese, Baum, Frosch and Flieger. Their rules are in `src/core/pose/poses.ts`.

## Hüpfhalle and Tanzsaal

Both need only the head and shoulders in the picture, so the child can stand closer to the camera than for Yoga. A raised hand that leaves the top of the picture still counts as "up" by its elbow.
Progress only goes up: a move done stays done.
When the camera loses the child for 1.5 seconds, an 👀 covers the picture and the voice asks them to step in front of the camera again; the meter waits, and in the Tanzsaal the music stops until the child is back.

- **Hüpfhalle:** a figure shows the move, and every one the child does fills the meter by a step with a rising note. Ten fill a round; the voice counts along from seven. Moves: Hampelmann, Hüpfen, Kniebeuge, Strecken (rules in `src/core/moves/reps.ts`).
- **Tanzsaal:** two of three little tunes (`src/core/moves/tunes.ts`, played with Web Audio). A dancer shows an arm move each bar: arms up, arms out, hands on the hips, hands on the head, waving, clapping (`src/core/moves/dance.ts`). A move counts if the child is in it at any moment of its bar or half a beat later. Missed moves just stay dark. Leaving during a song pays for the moves caught so far.

Camera pictures are analysed in the page and thrown away. Nothing is recorded or sent anywhere.
The tracking model (`public/mediapipe/pose_landmarker_lite.task`, from Google's MediaPipe) is part of the repo, so the game works offline.

## Mein Haus, the logbook and stickers

The house at the front of the square holds two things to tap:

- **Tagebuch:** one page per day the child did something, newest first. It shows the icon of each building visited with the Stars earned (green) or spent (grey), a sun when the daily goal was reached, the stickers earned and the paintings made that day. The voice reads the date, and tapping an entry says it ("Schule, sieben Sterne."). It is built from what the server has recorded since stage 4; visits to Malen and Ausmalen are recorded from stage 6 on.
- **Stickerheft:** a space for each of the 17 stickers, earned ones in colour, the rest as grey outlines. Tapping one says what it is for.

**Stickers** are rare milestones, never spent: ten visits to a building, six different learning buildings, the daily goal 3, 7 or 14 days in a row or on 10 or 30 days, 100 or 500 Stars. The list is `shared/stickers.json`, read by the page and the server; the server decides (`backend/app/stickers.py`), after each visit and when the page loads, so earlier history counts. A new sticker is celebrated in the town (at most three in a row; any more wait in the album, which glows).

## How the code is organised

| Folder | What it holds |
|---|---|
| `src/core` | Pure logic with tests and no browser code: door rules, counting tasks, Memory, letters and tracing, pose rules |
| `src/input` | Turns the keyboard and the on-screen stick and buttons into intents (move, jump, go in, leave), merged into one source for the town |
| `src/city` | The 3D town: Three.js for drawing, Rapier for physics |
| `src/buildings` | One folder per building, plus the list of buildings in `registry.ts` |
| `src/services` | Voice, sound, camera, body tracking, device detection, and `api.ts` for the server (`fakeApi.ts` stands in for it in tests) |
| `src/stores` | Who plays (`session.ts`) and their Stars and today's numbers (`player.ts`); an earned visit the server didn't get waits in the browser and is sent again |
| `backend/` | The server: FastAPI and SQLite. The family hub's login (`hub.py`, `auth.py`) or the no-hub picking (`local.py`), the rules that touch Stars (`game.py`), the people (`people.py`). Tests in `tests/` |
| `shared/buildings.json` | What each building is (earns or costs, how much), read by the server; a test checks the town agrees |

A building is a Vue component that emits `finished` with `{ stars }`. To add one, write the component and add an entry to `src/buildings/registry.ts` with its door position, picture, spoken name, whether it earns Stars, costs them or is free (`kind`, `cost`), which side of the square it stands on (`door.side`) and what it needs from the device (camera, touch, keyboard). The town shows a door as closed when the device can't serve it. A building also tells `src/buildings/leave.ts` how it is left (`onLeaveRequest(leave)`), so the on-screen leave button works in it.

In development mode, pressing L in the Yoga Studio prints the tracked body to the browser console, which is how real poses can be turned into test data.
