# Brightville – Stage 6 Design: Hüpfhalle, Tanzsaal, Stickers and the House

Nov 13, 2026 · Andreas Frank

Stage 6 of the roadmap in `2026-11-12-brightville-stage1-design.md`: "More movement and rewards. Jump Arena, Dance Hall, stickers, the house."
Lines marked **(call)** are decisions made by Claude, not by Andreas. Everything else comes from Andreas, from the gameplay document or from earlier stages.

## Intent

Two more ways to earn Stars by moving, and a place in town that shows the child what she has done.

What we learnt from Yoga, in Andreas' words: the child loved doing poses and watching the progress fill, and was disappointed when the camera lost her, because she lost the pose or because she stood too far away in front of a busy background.
The laptop's built-in camera needs a lot of distance to see the whole body and sits at an awkward angle; Andreas will try a separate camera.
So the new movement buildings must be forgiving: a tracking hiccup never takes away what she already did.

The house is hers. It holds a logbook of what she did, day by day, and a sticker book.
Stickers are rare milestones she works toward, not something she gets every day.

## Goals

- **Hüpfhalle** (Jump Arena) and **Tanzsaal** (Dance Hall) earn Stars with the camera. Their progress only ever goes up.
- Both work with the upper body in view, so she can stand closer than in Yoga.
- When the camera can't see her, the voice says so and the game waits. Nothing is lost.
- **Mein Haus**: a free building with a logbook (Tagebuch) and a sticker book (Stickerheft), both usable without reading.
- Stickers for rare milestones, stored on the server, so laptop and iPad show the same book.
- Parents see each child's logbook as text, and their stickers, in the parent area.

## Non-goals

- Yoga does not change. Its draining ring stays (Andreas: "draining is fine – at least for yoga").
- No version without a camera for the two new buildings. Like Yoga, their doors are closed on a device without a camera. **(call)** The iPad and the laptop both have one; a rhythm game for keys can come later if it is missed.
- No furniture, decorating, outfits or trophies in the house yet. The gameplay document has them; Andreas asked for the logbook and the sticker page.
- Stickers are never spent and never unlock play time or Stars.
- Parents cannot give or take away stickers.
- No recorded music. **(call)**

## Anti-goals

- Progress in Hüpfhalle or Tanzsaal that goes backwards, or a round that fails.
- A sticker that feels like a daily handout. If she gets one most days, the milestones are too easy.
- A silent stall: the camera not seeing her while the screen looks as if it is waiting for her to move.
- A logbook or sticker book that needs reading.

## Constraints

- Everything from earlier stages holds: German voice and pictures for the child, English code, no CDN, works offline once loaded (except the Cinema), camera images never leave the device and are never stored.
- The pose tracker, camera service and pose geometry of Yoga (`src/services/poseTracker.ts`, `src/services/camera.ts`, `src/core/pose/*`) are reused. The rules for counting moves are new pure logic in `src/core/`, unit-tested without a browser, like `createHold`.
- New buildings follow the building contract: a Vue component that reports `{ stars }` when finished, listed in `src/buildings/registry.ts` and `shared/buildings.json`.
- The server gains tables only through a new step in `MIGRATIONS` in `backend/app/db.py`.

## Part A: the two movement buildings

### Shared: the move counter **(call)**

One piece of logic used by both buildings: it watches the body frame by frame and recognises when a move has been done. It is pure logic in `src/core/moves/`.

- **Needed in view:** the nose and both shoulders. The shoulder width is the ruler for every distance, as in Yoga.
- **Arms leaving the top of the picture count as "up".** When she stands close, raised hands leave the picture. If a wrist is not seen but its elbow is above its shoulder, that arm counts as up.
- **The standing height** of the shoulders is learnt during the first second in view and updated slowly while she stands still, so hopping and squatting are measured from her own standing height.
- **No timeouts and no failures.** A move not done yet just isn't counted yet.
- **Lost from view:** after 1.5 s without nose and shoulders, the voice says "Ich sehe dich nicht. Stell dich vor die Kamera." and repeats it at most every 8 s. The camera picture stays on screen so she can see herself step back in. Counting pauses. When she is back, it goes on where it stopped. Before she has been seen at all, the first reminder waits 8 s, so the instruction to step in is heard out. **(call, made while building)**

### Hüpfhalle 🦘 (Jump Arena)

- **What she sees:** her mirrored camera picture, a cheerful figure that shows the move in a loop (built like `YogaTeacher.vue`), and a big power meter beside it that fills one step per counted move. Each step pops and plays a soft beat.
- **Three rounds per visit, one move each, picked from:**
  - *Hampelmann*: arms from down (wrists below the shoulders) to up (over the head) and down again.
  - *Hüpfen*: the shoulders rise clearly above her standing height and come back down.
  - *Kniebeuge*: the shoulders drop clearly below her standing height and come back up.
  - *Strecken*: arms up high, then hands down to the knees (wrists below the hips, or out of the bottom of the picture).
- A round is **10 moves**. When the meter is full: chime, "Super!", 3 Stars. **(call: 3 per round, at most 9 per visit, like Yoga; the gameplay document's +5 per round would make it the best-paying building)**
- She can leave any time and keeps the Stars of the rounds she finished.
- The voice names the move at the start of each round, and counts out loud from 7 to 10 ("sieben, acht, neun, zehn!").

### Tanzsaal 🪩 (Dance Hall)

- **What she sees:** her mirrored camera picture, a dancer figure on a little stage who does one move per bar, and a row of 16 notes along the bottom that light up one by one as she hits them.
- **The song:** a happy tune of about 40 seconds, played with Web Audio tones like the existing sound service, at about 100 beats per minute. **(call)** There are three tunes; each visit plays two different ones.
- **Moves:** arm moves only, held for a moment: *Arme hoch*, *Arme zur Seite* (a T), *Hände auf die Hüften*, *Hände auf den Kopf*, *Winken* (one hand up high, moving side to side), *Klatschen* (wrists together in front of the chest).
- **How a hit is counted:** a move is shown for one bar. If she is in that pose at any moment during the bar or the half beat after it, the note lights up. A missed move just stays dark: no sound, no voice, nothing taken away.
- **Lost from view:** the song pauses after 1.5 s and the voice says she isn't seen; it goes on when she is back. **(call)** That way a camera hiccup doesn't make her miss moves.
- **Stars per song:** 5 × hits ÷ 16, rounded up, so any hit gives at least 1. Two songs per visit, so at most 10. **(call)**
- **Leaving during a song** pays for the moves already caught in it, by the same rule. **(call, made while building)**

### In town

- Both are earning buildings with `needs: ['camera']`, counting toward the daily goal like the others.
- `shared/buildings.json`: `huepfhalle` maxStars 9, `tanzsaal` maxStars 10.
- They stand on the left side of the square, at z 8 and z 18, below Malen. **(call)** The registry's layout tests (3 m in front of every door, trampolines at least 4 m from every door, the playground clear) must still pass; if they don't, the builder moves them and says where.

## Part B: the house, the logbook and stickers

### Mein Haus 🏠

- A free building like Malen: always open, no Stars either way, not counted as play time.
- It gets the one door on the front side of the square, next to the playground, facing the learning row. **(call)** This needs `side: 'front'` in `doors.ts`. If the front row has no room that passes the layout tests, the house goes on the left side instead and the builder says so.
- Inside: a cosy room drawn in 2D with two big things to tap: a book on the table (📖 Tagebuch) and an album on the shelf (⭐ Stickerheft). A new sticker that hasn't been looked at yet makes the album glow.

### The logbook (Tagebuch)

- **One page per day**, newest first. A page shows only days on which she did something.
- **On a page:**
  - the day, said aloud when the page opens ("Dienstag, zwölfter November"), and printed small for grown-ups;
  - the icon of each building she went into, in order, with the Stars beside it: green "+7" for earning, grey "−3" for playing, nothing for free buildings;
  - a sun at the top when the daily goal was reached that day;
  - small pictures of the paintings she made that day, from Malen.
- **Tapping an entry** has the voice say it: "Schule, sieben Sterne." Tapping a sticker earned that day says the sticker's name.
- Big arrows flip to older and newer days.
- **History:** built from the `events` table, which has every earning visit and every round bought since stage 4 went live. So the logbook starts with real history. Visits to the free buildings were not recorded until now (the Cinema is a play building, so its films are); from this stage on a visit to Malen or Ausmalen is recorded as an event of kind `free` with 0 Stars. Mein Haus is not recorded. **(call)**

### Stickers

- **The catalogue** lives in `shared/stickers.json`, read by both the server and the page, like `shared/buildings.json`. Each sticker has an id, a picture (an emoji on a round coloured badge **(call)**), a German name for the voice, and a rule.
- **Rules (call: the list below, tuned so that a child who reaches her goal most days earns roughly one sticker a week in the first month, then fewer):**

| Sticker | Picture | Earned for |
|---|---|---|
| Rechenprofi | 🧮 | 10 visits to the Schule |
| Schreibprofi | ✍️ | 10 visits to Schreiben |
| Yoga-Meister | 🧘 | 10 visits to Yoga |
| Adlerauge | 🦅 | 10 visits to Unterschiede |
| Bücherwurm | 🐛 | 10 visits to the Bibliothek |
| Farbzauber | 🌈 | 10 visits to the Farblabor |
| Springfloh | 🦘 | 10 visits to the Hüpfhalle |
| Tanzstern | 💃 | 10 visits to the Tanzsaal |
| Kunstwerk | 🖼️ | 10 visits to Malen or Ausmalen |
| Entdecker | 🗺️ | 6 different earning buildings visited (not "all": Schreiben needs a touch screen and the camera buildings a camera) |
| Drei am Stück | 🔥 | Daily goal reached 3 days in a row |
| Eine ganze Woche | 🏅 | Daily goal reached 7 days in a row |
| Zwei Wochen | 🏆 | Daily goal reached 14 days in a row |
| Fleißige Biene | 🐝 | Daily goal reached on 10 days |
| Superfleißig | 👑 | Daily goal reached on 30 days |
| Sternensammler | ⭐ | 100 Stars earned in all |
| Sternenhimmel | 🌌 | 500 Stars earned in all |

- **A "day with the goal reached"** is a day whose number of earning visits reached the daily goal. For days before this stage the current goal is used, since earlier goals weren't kept. **(call)** From now on the server stores the day with the goal that applied when it was reached.
- **Visits** in the rules are earning visits with Stars (the ones the server already counts), or `free` events for Kunstwerk.
- **The server decides** which stickers are earned, after every visit and once when the page loads, and keeps them in a new `stickers` table: person, sticker id, when earned, and whether the child has seen it yet. Earned stickers are never taken back, even if the catalogue changes.
- **Earlier history counts.** On the first day of this stage, stickers already earned by her history since stage 4 are given at once. **(call)**
- **The celebration:** when she comes back into the town and has a sticker she hasn't seen, the sticker grows big in the middle of the screen with confetti, the voice says "Ein neuer Sticker: Bücherwurm!", and it flies off toward the house. With several at once, they come one after another, at most three; the rest wait in the album as new. Seeing the celebration marks them seen.
- **The sticker book:** pages of 9 spaces. Earned stickers are in colour, the others are grey outlines of the same shape, so she sees what's still to get. Tapping an earned sticker says its name and what it was for ("Bücherwurm. Für zehn Besuche in der Bibliothek."). Tapping a grey one says what it will be for.

### Server

- New tables in one migration step: `stickers` (person, sticker id, earned at, seen) and `goal_days` (person, day, goal). The `events` table gets `free` as a kind.
- New routes for the logged-in person: the logbook a few days at a time, the earned stickers, and marking stickers as seen; plus a way to record a free visit.
- `POST /api/visits` answers with any stickers this visit earned, so the page can celebrate without another request.
- The parent list of players (`GET /api/players`) does not grow; the parent area fetches a child's logbook and stickers when its card is opened.

### Parent area

- Each child's card gets a "Tagebuch" section, folded shut at first: the last 7 days as text, one line per day ("Di 12.11.: Schule +7, Bibliothek +9, Spielhalle −3. Tagesziel erreicht."), and a line with the stickers earned so far and their dates.

## What is left to the builder

- The exact thresholds of each move (how far up, down, apart) and the dancer's and figure's drawings. They are tuned against recorded fixtures like Yoga's `fixtures.ts`, then in a browser with a real camera.
- The three tunes.
- How the logbook is paged on the server (by days, a week at a time is fine).
- The room's drawing and the sticker badge colours.
- Order of work: Part A and Part B are independent and can be two pull requests, A first.

## Not verifiable here

- Whether the moves are recognised well with a real child at a real distance and with the separate camera Andreas is getting. The fixtures prove the rules, not the camera.
