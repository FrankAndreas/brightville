# Brightville

A small, friendly town for a kindergarten-age child: walk a wobbly character around, go into buildings, and earn Stars there by learning and moving.
Everything the child sees is pictures and a German voice; no reading is needed.

The town square (62 m across) has balls to push, three trampolines, a playground at the front (a staircase of blocks up to a platform, hurdles to hop over) and its buildings: learning at the back, making things and moving on the left, playing on the right, and the child's own house at the front.

| Building | What happens inside | Stars |
|---|---|---|
| 🔢 School | Five tasks: counting, a die, first sums up to 9 | +1 per task, +5 for all five |
| ✏️ Schreiben | Her own words and short sentences (from the parents), or today's two letters, each traced three times; less help for letters she knows (touch screen only) | +1 per letter, +4 for finishing |
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
| 🪽 Flatterflug | Her wobbly gets wings: tap to flap through the gaps between the clouds | costs 3 per round |
| 🎬 Kino | One of the YouTube films the parents chose | costs 3 per film |
| 🏠 Mein Haus | Her room: the logbook (Tagebuch), the sticker book (Stickerheft), her trophies, her wardrobe (Kleiderschrank) and her furniture | free |
| 👗 Kleiderladen | Add-ons for her character on three shelves; after today's learning, one purchase a day across both shops | 15–120 per add-on |
| 🛋️ Möbelhaus | Furniture for her room on three shelves; the same rules as the Kleiderladen | 15–120 per piece |

**Free** buildings are always open: before the day's learning, with no Stars, and after the play time. They neither give nor cost Stars and don't count as play time.

**Stars at a child's pace:** the server takes an earning visit only when enough time has passed since the one before for its Stars to be earned (`minSecondsPerStar` in `shared/buildings.json`, about half of the fastest real visit). A visit that comes too soon waits on the device and is sent again by itself, so nothing is lost; it only makes sending Stars by hand no faster than earning them.

**Learn first, play later:** the Arcade door stays locked until today's earning visits are done (any learning or moving building, in any mix; two unless a parent set another number). The slots next to the Star counter show how far the child is. A new day starts the slots over; Stars are kept.
When a parent has set a play time per day, the Arcade door shows a moon once it is used up.

**Each child has their own Stars**, kept by the game's server (`backend/`), so the laptop and the iPad show the same.
Who is playing comes from the family hub's login; a coloured circle with the first letter next to the Star counter shows who it is.
Parents get a gear next to the "?". It opens only when held for three seconds and then asked a multiplication (e.g. 7 × 8), so a child playing on a device logged in as a parent doesn't get in. Their page shows every child's Stars and today's numbers, and sets the daily goal, the play time per day and the Stars. Below, they keep the Cinema's list of YouTube films (a link and a name each, at most 30, the same for every child). Each child's card has a folded "Tagebuch" with the last seven days as text and the stickers earned.

The idea behind the game is in [Learning City – Gameplay Design.md](Learning%20City%20%E2%80%93%20Gameplay%20Design.md).
Where the project stands, what wasn't checked on real hardware and what is left to build: [docs/roadmap.md](docs/roadmap.md).
How it is built and what comes next is in [docs/superpowers/specs/2026-11-12-brightville-stage1-design.md](docs/superpowers/specs/2026-11-12-brightville-stage1-design.md);
the plan for stage 1 is in [docs/superpowers/plans/2026-11-12-brightville-stage1.md](docs/superpowers/plans/2026-11-12-brightville-stage1.md).
Stage 2 (School, Arcade, daily goal) has its own [design](docs/superpowers/specs/2026-11-12-brightville-stage2-design.md) and [plan](docs/superpowers/plans/2026-11-12-brightville-stage2.md).
Stage 3 (iPad and NAS) has a [design](docs/superpowers/specs/2026-11-12-brightville-stage3-design.md) and a [plan for its first part](docs/superpowers/plans/2026-11-12-brightville-stage3-part1.md).
Stage 4 (family login, server, parents) has a [design](docs/superpowers/specs/2026-11-12-brightville-stage4-design.md).
Stage 5 (the rest of Spielzeugkiste) has a [design](docs/superpowers/specs/2026-11-12-brightville-stage5-design.md), and its third part (Cinema, paintings on the server, a bigger town) [another](docs/superpowers/specs/2026-11-12-brightville-stage5-part3-design.md).
Stage 6 (Hüpfhalle, Tanzsaal, the house, stickers) has a [design](docs/superpowers/specs/2026-11-13-brightville-stage6-design.md) and a [plan](docs/superpowers/plans/2026-11-13-brightville-stage6.md).
Stage 7 (her own character, the Kleiderladen, the wardrobe) has a [design](docs/superpowers/specs/2026-11-13-brightville-stage7-design.md) and a [plan](docs/superpowers/plans/2026-11-13-brightville-stage7.md).
Stage 8 (her room: trophies, furniture, the Möbelhaus) has a [design](docs/superpowers/specs/2026-11-13-brightville-stage8-design.md) and a [plan](docs/superpowers/plans/2026-11-13-brightville-stage8.md).

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

In every building, next to the door button at the top left, a 🔊 button says the building's instruction again (the question in the School, the colours in the Farblabor, the letter in Schreiben …), for a child who missed it. The Bibliothek has its own 🔁 for the story.


| Action | Keyboard | Touch screen |
|---|---|---|
| Walk | Arrow keys or W A S D (up always walks away from the camera) | Drag a finger anywhere in the left half of the screen |
| Turn the view | J and L while held; K turns around; I looks at the learning row again | Hold one of the round arrows above the jump button |
| Jump | Space | The yellow arrow button, bottom right |
| Go into a building | Enter or E, in front of the glowing door | Tap the picture that appears at the door (a mouse click works too) |
| Leave a building | Esc | The door button, top left (also for the mouse) |
| Show the controls | H or F1 | The ? button |

Keys and fingers work at the same time. The stick and the jump button appear only on a device with a touch screen.

A new player (0 Stars) sees the controls as pictures at the start, read aloud one at a time while each picture lights up; any key or tap closes them. A device with touch and no mouse gets the finger pictures instead of the keys.

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

## Flatterflug

Her own wobbly, in her look and with what she wears (anything on its back makes room for a pair of feathered wings), flies through the sky. Each tap anywhere (or Space, ↑) makes it flap and rise a little; without flapping it sinks. Columns of clouds come from the right, each with a gap to fly through: 15 make a round, and the voice cheers at half. A cloud costs one of three hearts ("Hoppla!") and the wobbly blinks for a moment, flying on; the meadow below just bounces it up again, so falling never ends the round. Before the start she picks a speed (🐢 🐇 🐆: faster clouds, smaller gaps), remembered on the device. Upright, the wobbly flies further left, so the next gap is always seen two seconds ahead. The rules are in `src/core/flight.ts`, the flying wobbly in `src/city/flyer.ts`.

It is a play building like Schlange (3 Stars a round, after today's learning). The right side of the square is full, so its door is at the front, between the playground and the Möbelhaus; the playground's staircase now climbs towards the front edge, between the paths to Mein Haus and the Flatterflug (no step or platform stands on a path to a door: a test keeps it so).

## Kino

The door stays grey until a parent added films. Inside, a tap on a film's picture plays it full size in YouTube's privacy-enhanced player (`youtube-nocookie.com`); when it ends, the child is back in the town. One film per 3 Stars; the leave button stops it any time. The page's security rules allow exactly that player and the films' pictures (`i.ytimg.com`), nothing else from YouTube. The player runs in a sandbox without new windows or leaving the page, so YouTube's logo and the film's title lead nowhere: no way from here to youtube.com or the YouTube app.

## Ausmalen

A tap on a picture opens it; pick a colour at the bottom, then tap a part of the picture. ↩️ takes the last fill back. Esc or the leave button goes from a picture back to the wall, and from the wall back to the town. The pages come from Spielzeugkiste and are not kept.

## Malen

➕ starts a new sheet; a tap on a painting paints further on it. Brush, pencil, eraser, six shapes (dragged from corner to corner), three sizes, twelve colours, ↩️ and 🗑.
Leaving the sheet (✅, Esc or the leave button) keeps it on the server, so the same gallery shows on the laptop and the iPad. Each child sees only their own paintings, the newest 30. When the server can't be reached, the painting waits in the browser (IndexedDB, shown with ⏳) and is sent the next time the gallery opens. A resting hand is ignored, as in Schreiben; the mouse works too.

## Schreiben

Capital letters, Ä Ö Ü and the digits in the Deutschschweizer Basisschrift, with the stroke order Swiss schools teach. The paths and the tracing rules come from Spielzeugkiste.

The child traces each stroke from the green dot with a finger or a pen; the traced part turns green. A resting hand is ignored: a touch much larger than the pen doesn't count.
Lifting early starts that stroke again. Nothing is ever taken away.

**Choosing.** Inside, her words and sentences stand as big cards, with a 🎲 for today's letters. Without any words the 🎲 round starts at once. The parents write the list on the parents' page (each child's card, "Schreiben"): capitals, Ä Ö Ü, digits and spaces, at most 30 characters a text and 20 texts; typed lowercase becomes capitals, ß and punctuation are refused. Lowercase letters come later, once she knows the capitals.

**A word or sentence** is written letter by letter. Along the top, each letter she finished shows in her own lines, with a gap between words. The voice says what she writes ("Wir schreiben: Ich mag dich Lena!"), names each new word and each letter, and reads the whole text at the end. One Star per letter, +4 for finishing (the server caps a visit at 10).

**How well she knows each letter.** Every letter and digit has a level per child, kept on the server, which sets the help wherever the letter comes:

| Level | On the board |
|---|---|
| new | not met yet; in a word the whole letter, and the write doesn't count |
| 1 | the whole path with arrows |
| 2 | dots along the path |
| 3 | only the green start dot |
| learned | only the lines; after a wrong start the start dot appears |

A write is *bumpy* when she started at the wrong place or the wrong end, or lifted early in a real try; otherwise it is *clean*. Three clean writes in a row move a letter up a level, three bumpy ones down (never below 1). The parents' page shows the levels as a coloured grid.

**Today's letters (🎲).** Two letters, each written three times. New letters come first, at most two a day: one while she has three or more letters at level 1, none while five or more (counting the letters she met before today, so the first new letter of the day never takes the second one's place). A new letter is written with the whole path, then dots, then the start dot; it counts as met after the third. The letters of her own words come first, then the other letters, then the digits. The other places go to her weakest letters (lowest level, then the longest unpractised). Writes and new letters wait on the device while the server is away.

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
The frame around the camera picture is green while the camera sees the child and orange at once when it doesn't. When the camera loses the child for 1.5 seconds, an 👀 covers the picture and the voice asks them to step in front of the camera again; the meter waits, and in the Tanzsaal the music stops until the child is back.

- **Hüpfhalle:** a figure shows the move, and every one the child does fills the meter by a step with a rising note. Ten fill a round; the voice counts along from seven. Moves: Hampelmann, Hüpfen, Kniebeuge, Strecken (rules in `src/core/moves/reps.ts`).
- **Tanzsaal:** two of three little tunes (`src/core/moves/tunes.ts`, played with Web Audio). A dancer shows an arm move each bar: arms up, arms out, hands on the hips, hands on the head, waving, clapping (`src/core/moves/dance.ts`). A move counts if the child is in it at any moment of its bar or half a beat later. Missed moves just stay dark. Leaving during a song pays for the moves caught so far.

Camera pictures are analysed in the page and thrown away. Nothing is recorded or sent anywhere.
The tracking model (`public/mediapipe/pose_landmarker_lite.task`, from Google's MediaPipe) is part of the repo, so the game works offline.

## Mein Haus, the logbook and stickers

The house at the front of the square is her room: a wall with a window, a floor, a table with the logbook and the sticker book, a trophy shelf, her wardrobe and seven spots for furniture.

- **Tagebuch:** one page per day the child did something, newest first. It shows the icon of each building visited with the Stars earned (green) or spent (grey), a sun when the daily goal was reached, the stickers earned and the paintings made that day. The voice reads the date, and tapping an entry says it ("Schule, sieben Sterne."). It is built from what the server has recorded since stage 4; visits to Malen and Ausmalen are recorded from stage 6 on, and only those in which something was made: at least ten strokes or fills and a minute inside (`src/buildings/effort.ts`).
- **Stickerheft:** a space for each of the 17 stickers, earned ones in colour, the rest as grey outlines. Tapping one says what it is for.
- **Trophies:** the shelf next to the album holds all 17 stickers as trophies: earned ones in their colour, the others as faint outlines of what is still to get. Tapping an earned one says its name and what it is for; any other, what it is for.
- **Kleiderschrank (wardrobe):** a big wooden wardrobe; inside, everything she owns, to put on and take off as often as she likes; ✏️ changes her look. Empty, it points to the Kleiderladen.
- **Her furniture:** seven fixed spots (picture, curtain, lamp, bed, rug, plant, toy), dashed while empty. Tapping a spot shows the pieces she owns for it and 🚫; a tap puts one there or takes it away, as often as she likes. Pieces she swapped out stay hers.

**Stickers** are rare milestones, never spent: ten visits to a building, six different learning buildings, the daily goal 3, 7 or 14 days in a row or on 10 or 30 days, 100 or 500 Stars. The list is `shared/stickers.json`, read by the page and the server; the server decides (`backend/app/stickers.py`), after each visit and when the page loads, so earlier history counts. A new sticker is celebrated in the town (at most three in a row; any more wait in the album, which glows).

## Her character, the Kleiderladen and the wardrobe

**Her look:** on her first visit, before the town, each player designs her wobbly character, for free: a body colour (8), hair (none, spiky, ponytail, buns, curly), a hair colour (6) and glasses (none, round, star, heart). 🎲 picks one for her. She can change it in the wardrobe; the same character walks in the town, with what she wears.

**The Kleiderladen** (👗, at the front next to Mein Haus) sells add-ons for her character, one per place (head, neck, body, back), on three shelves: 15–25 ⭐ (about a day), 40–60 ⭐ and 90–120 ⭐ (about a week). A shelf opens once she owns two add-ons from the one above. Tapping an add-on tries it on and says its price; ✔️ buys it, and she wears it at once.

- **Learn first:** the door opens only once today's learning visits are done, but play time used up doesn't close it.
- **One purchase a day.**
- **Saved Stars count half:** the Stars she had when the shop came (and still has) pay two for one there, so a full savings account can't empty the shelves at once. Everywhere else they count as before; the parents' page shows them ("davon gespart").
- **Sticker gifts:** four add-ons are never sold but come with a sticker (Sternensammler, Yoga-Meister, Tanzstern, Eine ganze Woche), also for stickers earned before.

The catalogue is `shared/outfits.json`, read by the page and the server; never rename or remove an add-on's id, as owned ones are kept by id.

## The Möbelhaus

**The Möbelhaus** (🛋️, at the front right, past the playground) sells furniture for her room: 18 pieces on three shelves, 15–25 ⭐, 40–60 ⭐ and 90–120 ⭐, each for one of the seven spots. It follows the Kleiderladen's rules: learn first, open after the play time, two pieces from a shelf open the one below, saved Stars count half, and **one purchase a day across both shops** (a Schal today means no bed until tomorrow). Tapping a piece shows it on its spot in a small picture of her room, with what else stands there; ✔️ buys it and puts it there at once. What stood on that spot stays hers, to put back in her room.

Both shops share their code (`src/buildings/shop/`) and, on the server, their rules (`backend/app/shop.py`). The catalogue is `shared/furniture.json`; never rename or remove a piece's id, and no piece may share an id with an add-on. The logbook shows a furniture purchase like a clothes purchase, and the parents' page shows her furniture under her clothes.

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
