# Brightville – Where It Stands and What Is Left

Nov 13, 2026. Read this first when picking the project up again.

## Done

The six stages of the roadmap in [the stage 1 design](superpowers/specs/2026-11-12-brightville-stage1-design.md) are built and merged (PRs #1–#11):

1. Tiny town, Yoga, Stars
2. School, Arcade, daily goal
3. iPad and NAS (touch controls, Schreiben, deployment, family-hub tile)
4. Family login, server with Stars per child, parent area
5. Spielzeugkiste's games as buildings (Ausmalen, Malen, Unterschiede, Schlange, Bonbonjagd), Bibliothek, Farblabor, Cinema, paintings on the server, turning (J K L I), playground, 60 m square
6. Hüpfhalle, Tanzsaal, Mein Haus with logbook and sticker book, stickers
7. Her own character (look on the first visit), the Kleiderladen (three shelves, one purchase a day, saved Stars count half), sticker gifts, the wardrobe in Mein Haus (PRs #18–#20)
8. Her room in Mein Haus: a trophy shelf, a proper wardrobe, furniture on seven spots, the Möbelhaus (one purchase a day across both shops) (PRs #22–#24)
9. The Flatterflug: her wobbly with wings, flying through the clouds (a play building)
10. Schreiben with her own words and sentences (Spielzeugkiste's name writing, grown into short sentences), a level per letter that sets the help, and new letters paced
11. A bigger town to walk and discover (part A: streets, hills, a lake with a jetty, the buildings mixed along the streets, a camera that keeps her in sight). Part B: detailed houses, trees, flowers, lamps and benches. Part C: townsfolk, ducks, boats, birds, a cat and a dog, see [the plan](superpowers/plans/2026-11-14-brightville-bigger-town.md)
12. Lehrplan 21 (#32, #33): the School climbs two ladders (Zählen, Rechnen) per child, and the parents see one overall number that opens into subjects, ladders and this week's practice, see [the design](superpowers/specs/2026-11-16-brightville-lehrplan-design.md). New buildings for the gaps are issues #34–#38
13. Reimhaus (#34): rhymes, first sounds and syllables on a third ladder, Reimen, shown under Deutsch in the parents' overview, see [the design](superpowers/specs/2026-11-20-brightville-reimhaus-design.md)
14. Musterwerkstatt (#35): rows to continue and things to sort on a fourth ladder, Muster, shown under Mathematik, see [the design](superpowers/specs/2026-11-20-brightville-musterwerkstatt-design.md)
15. Kalender (#36): the order of a day, morning to night, the week, yesterday and tomorrow from the real day, the seasons and the clock on a fifth ladder, Zeit, see [the design](superpowers/specs/2026-11-20-brightville-kalender-design.md). It took the plain house at (3.5, −24)
16. Spielwelt (#37): a wide 2D world for position words on a sixth ladder, Raum, with free play after the five tasks, see [the design](superpowers/specs/2026-11-20-brightville-spielwelt-design.md). It took the plain house at (−16, 35.5) by the playground
17. Trommelhaus (#38): rhythm by tapping or clapping (microphone), on a seventh ladder, Rhythmus, under Musik, see [the design](superpowers/specs/2026-11-20-brightville-trommelhaus-design.md). It took the plain house at (24, −3.5). All Lehrplan issues (#32–#38) are done

Each stage has its design in `docs/superpowers/specs/`; what the game does now is in the README.

## Not yet checked in real life

These were tested with automated tests and in a desktop browser, but not where they matter:

- **Hüpfhalle and Tanzsaal with a real child and camera.** The rules are tested against made-up bodies. A separate camera is planned because the laptop's built-in one needs too much distance. If moves count too easily or not at all, the thresholds are in `src/core/moves/reps.ts` (Hüpfhalle) and `src/core/moves/dance.ts` (Tanzsaal).
- **Everything on a real iPad:** turn buttons, swiping, drawing, Schreiben with the pen, the camera buildings, and the bigger town's speed (Chrome on a laptop's Intel graphics draws it at about 56 frames a second at double pixel density, dropping itself to 1.5).
- **A Cinema film played to its end** (only tested with the player's messages).
- **The DSM reverse proxy's upload limit** for paintings: if paintings keep showing ⏳ on the NAS, see the troubleshooting table in `docs/deploy-nas.md`.

## Reviews

**Architecture review (Nov 13, 2026): done.** The family-hub integration follows the hub's "For apps" rules. Its findings were fixed:

- A login that had access keeps it for an hour while the hub doesn't answer. This is in the hub's client package (family-hub PR #53), bumped in Brightville and in the other family apps.
- The parents' page asks the hub for its people at most once a minute.
- Migrations are split where SQLite says a statement ends.
- The database remembers whether it was made with the hub or with `LOCAL_MODE`, and the server refuses to start in the other mode.
- Only the MediaPipe WebAssembly build the game loads is copied.
- The backend's memory limit is now 192 MB. **The NAS's own `compose.yaml` isn't updated by the scripts:** change `mem_limit: 128m` there by hand.

**Code review of stages 5 and 6 (PRs #5–#11), Nov 13, 2026: done.** Its ten findings were fixed:

- Lowering the daily goal no longer makes old days count. Days from before `goal_days` was kept were written down once, with each child's goal at that update.
- A painting the server refuses for good no longer holds up the others. A sheet too large as PNG is saved as JPEG.
- A sticker seen in the album isn't celebrated again in the town.
- Answers that arrive after the device changed hands are dropped.
- Stickers are worked out without the write lock unless one is due. The logbook reads only the days it shows.
- The frame around the camera picture in the Hüpfhalle and Tanzsaal is green while the child is seen and orange while not. The music still waits 1.5 s before stopping.
- A visit to Malen or Ausmalen counts only with something made: at least ten strokes or fills and a minute inside.

**Security review (Nov 13, 2026): done.** Nothing critical or high. Fixed:

- The Cinema's player is sandboxed: YouTube's logo and title no longer lead to youtube.com or the YouTube app. Checked in Chrome that films still play; not yet on the iPad.
- The parents' gear must be held for three seconds, then asks a multiplication.
- A cool-down between earning visits (`minSecondsPerStar` per building): Stars can't be sent faster than a child earns them. A visit that comes too soon waits on the device and goes again by itself.
- A key from another day can no longer overwrite that day's entry.
- At most two paintings are read at once, so uploads can't exhaust the backend's memory.
- On the NAS, `ALLOWED_HOSTS` should name the game's address (see `docs/deploy-nas.md`).

**Security review of what came since (Nov 21, 2026): done.** The wardrobe and shop, her room, her words and letters, the seven ladders and the microphone. Nothing critical, high or medium: every route needs the login and the CSRF header, a child reaches only her own data, every query uses placeholders, a purchase or result sent twice counts once, and Stars are taken in the purchase's own transaction. No known vulnerabilities in the server's or the shipped page's packages. Fixed:

- The NAS's headers forbade the microphone (`microphone=()`): the Trommelhaus offered clapping and browsers that follow the header refused it (not yet tried on the iPad). Now `microphone=(self)`, like the camera, and a test reads the headers file.

Accepted: a logged-in child's page is trusted with her answers, so a hand-made request could move her own ladders up (not another child's; Stars stay under the cool-down). Result and letter keys are kept 60 days.

**UX review, walkthrough (Nov 13, 2026): done.** Every building and the town at iPad and laptop size, with screenshots and what the voice says. Fixed:

- The town's camera looks a few metres ahead of the character: the buildings and their signs sit in the middle of the picture instead of under the Star bar.
- A 🔊 button next to the door button in every building says its instruction again.
- The Arcade says what to do; the Bonbonjagd asks for the speed; Mein Haus says what to tap.
- The controls at the start are read one at a time, each picture lighting up.
- White paint in the Farblabor looks like paint; the empty Malen gallery has a big ➕ in the middle; one or two films in the Kino sit in the middle.
- The Arcade, Schlange and Bonbonjagd start below the two buttons in the corner.
- The parents' page: no daily goal or play time for a parent; removing a film asks first.

**Still open:** the second half of the UX review, from watching the child play stage 6: where she hesitates, what she ignores, what she keeps going back to.

**UX review of the learning buildings, walkthrough (Nov 21, 2026).** The Reimhaus, Musterwerkstatt, Kalender, Spielwelt and Trommelhaus played through at iPad size, both ways round, with every sentence of the voice logged. Fixed:

- The Trommelhaus offered clapping and showed its example only in tests: in the game both were always off (#60).
- The Spielwelt at steps 1–3 shows where the thing to find hides; before, the first task could hide it off the screen before she knew the world scrolls.
- The Reimhaus's syllable drum: after three wrong counts the house drums it for her once more and the visit goes on (the Star kept), as in the Trommelhaus.
- Tapping a day in the Kalender's week strip says its name (it looked tappable and did nothing).
- At the end of a learning visit the stars she earned show large in the middle of the empty card.
- The parents' overview says „Silben trommeln“, as she does in the Reimhaus.
- The Kalender clocks draw their numbers over the hands, so a hand on the 12 doesn't hide it.

Not checked this way: clapping into a real microphone, real speech timing, and whether she understands „Silben“ or the coloured day cards. That is for watching her play.

**Performance review (Nov 21, 2026).** The built game on the test server, in Chrome on a laptop's Intel UHD 620 (a weaker graphics chip than a recent iPad's), with the processor slowed 4–6 times and the network at 20 Mbit/s. Fixed:

- Every visit to Yoga, the Hüpfhalle or the Tanzsaal made a new pose landmarker, and closing one never gave its memory back: about 50 MB more each visit, and after about 16 camera visits the town lost its picture (only the sky left). Now one is made on the first visit and kept for the session; from the second visit on it is ready at once (the camera still has to open). It is made anew on the next visit when it could not be made, when it breaks, or when the iPad takes its canvas's graphics away. Measured: flat over 36 camera visits. Only measured in Chrome: on the iPad, check that the camera buildings still see her after the game sat in the background.

Measured and fine: the play button after 1.1–1.4 s and the town 0.3–0.8 s after the tap (1.9 MB compressed to download; of the main file's 5.2 MB uncompressed, 4.1 MB is the physics engine; split it out if start-up ever feels slow); the town at about 50 frames a second whatever the processor speed (the graphics chip sets the pace), with a few slow frames only in the first steps while the graphics card prepares what it sees for the first time; the Spielwelt at 60 frames a second while dragging, even 6 times slower (276 drawn things); 66 visits to every building leave no camera, microphone, timer, sound or 3D picture running.

**Performance after the town grew (checkpoint 1, Nov 21, 2026).** Same laptop and method, with the nature and workshop districts joined on, the processor at normal speed. A walk from the plaza up the back avenue, through the nature gate into the farm (standing 10 s looking at the pens), into the forest, then round to the workshop, two runs each, frames a second on average and the slowest 5 % of frames:

- town 59 / 49 fps (p95 17 / 33 ms), gate 60 / 54 (17 / 33), farm 59 / 59 (17 / 17), standing at the pens 60 / 60 (17 / 17), forest 59 / 56 (17 / 33), workshop 60 / 59 (17 / 17); at most 2 frames over 50 ms in any part.
- The usual 25-second walk in the old town: 46, 48, 56 and 48 fps (p95 33 ms); the town without the districts measured the same day: 54 and 53.
- The picture gets less sharp on its own when frames are slow (it settled at pixel ratio 1–1.5 within the first minute), which is why the districts run near 60. Held at full sharpness, every part is slower and the old streets the slowest: town 34 fps (37 without the districts), gate 37, forest 40, farm 44, workshop 45, standing at the pens 50.

So the joined districts stay: no part is below 45 fps or above 34 ms, and nothing was simplified. The old town lost a few frames a second (about 10 % at full sharpness) from drawing the districts behind it; if a later stage adds more, hiding a district's drawing when she is far from it is the first thing to try.

## Calls made without asking, which may be worth revisiting

- The Cinema costs 3 Stars per film, not per minute; one film list for all children.
- The Hüpfhalle pays 3 Stars per round (at most 9), not the gameplay document's 5.
- No version without a camera for the Hüpfhalle and Tanzsaal: their doors stay closed on a device without one, like Yoga's.
- Stickers: the list of 17 in `shared/stickers.json`. Days from before goal days were kept count as "goal reached" against each child's goal at the update that wrote them down.
- The cool-down's seconds per Star are guesses: about half of the fastest real visit (school 2, Schreiben 1.5, Yoga 1.5, Unterschiede 1, Bibliothek 2, Farblabor 1, Hüpfhalle 2, Tanzsaal 4). If a fast child's visits ever arrive late, lower them in `shared/buildings.json`.
- A visit to Malen or Ausmalen counts with at least ten strokes or fills and a minute inside, the same for every child (not a parent setting): the bar only keeps walking in and out from counting. A five-year-old typically stays with one activity for about 10–15 minutes, far above it.
- A visit to Malen or Ausmalen made while the server can't be reached isn't kept for later.
- Reimhaus: the word list and its pictures (emoji), the first sounds worked out from the spelling (Sch its own; St, Sp, Ei, Au and vowels other than A not asked), and the lot at (35.5, −16) (the one by the Bibliothek is the cat's garden). The end-of-Kindergarten line moved from 27 % to 45 % because Reimen counts as a Kindergarten goal; every child's number shifted once.
- Musterwerkstatt: rows where two things change have colour and shape change together, each wrong choice right in one of them; size rows offer two choices (there are only two sizes); a size sort uses one picture big and small; a gap inside a row is hummed ("hm"); the end-of-Kindergarten line moved to 48 % (Muster step 4 counts as Kindergarten). The building took the last free lot at (3.5, 51): #36 Kalender and #38 Rhythm need a new place in the town.
- Kalender: the order of a day uses six things with one place in a day (aufstehen, frühstücken, zu Mittag essen, zu Abend essen, schlafen; no anziehen, Zähne putzen, spielen or baden); the seasons change around the 21st; questions with two fair answers are left out; step 4 asks two day and three season questions; clock distractors are the other half and the hour ±1; the end-of-Kindergarten line moved to 53 % (Zeit steps 1–4 count as Kindergarten, the clock as 1st grade).
- Spielwelt: the world wraps around; vor/hinter are two ground lanes (behind: see-through and smaller); step 5's two clues are 'vor/hinter one object' + 'links/rechts neben its neighbour'; the car is never part of a task; only a release near the task's object is judged; the voice says 'ist' for every thing; the arrangement is kept per child on the device only; free play doesn't count against the daily play time; the end-of-Kindergarten line moved to 54 % (Raum up to zwischen is Kindergarten). Not yet checked on the iPad: dragging with a finger, and how smoothly the wide world scrolls.
- Trommelhaus: tolerances (±200 ms, six of eight beats; gaps within 35 %; loud claps 1.5 × the quiet ones) are first guesses; three tries then shown and on (the Star kept); tapping and clapping feed the same ladder; the microphone stream stays open during the visit and is only read while she answers (if the iPad's voice gets quiet with it open, close it between answers: one switch); the end-of-Kindergarten line moved to 55 %. To check on the iPad: clapping with the microphone, its delay, and whether the speaker stays loud.

- Stage 7, saved Stars: the Stars at the update count half in the shop; any spending (the Arcade, a parent lowering the count) takes new Stars first, so the savings last longer at half value. A single leftover saved Star counts like a new one.
- Stage 7: the Kleiderladen stands at the front left next to Mein Haus, not with the play buildings (no room there), and its closed door says "Erst lernen, dann einkaufen!".
- Stage 7: add-on prices, the look's colours and the 3D models are first guesses; the shelves' prices are in `shared/outfits.json`.
- Stage 8: no spot near Mein Haus had room for the Möbelhaus, so it stands at the front right, past the playground, and the square grew by a metre to 62 m for it (`HALF_SIZE` 31).
- Stage 8: the furniture, its prices and spots, and the room's drawing are first guesses (`shared/furniture.json`, `src/buildings/haus/RoomPicture.vue`). The trophies are the stickers, not something new to earn.
- Flatterflug: 15 gates a round, three hearts, the meadow never ends the round, gap sizes and cloud speeds are first guesses for a five-year-old (`SPEEDS` in `src/core/flight.ts`). Its door is at the front (the right side is full), and the playground's staircase was turned to climb towards the front edge for it.
- Schreiben: three in a row up or down and the pacing (two new letters a day, one from three letters at level 1, none from five) are Andreas's; that a text's letters are introduced first, that a known letter shows its start dot after a miss, and the limits (30 characters, 20 texts) are first guesses. **Next:** lowercase letters, once she knows the capitals (the paths need generating with Spielzeugkiste's `scripts/letters/generate.py`).
- The path to the Kleiderladen runs over the big trampoline at (−14, 18) (since stage 7): she may bounce on the way. Left as it is: moving the trampoline is a playground change of its own.

## Left from the gameplay document

Not planned as stages yet. Roughly by how much they would add for a five-year-old:

1. ~~Dressing up the character~~: done in stage 7.
2. ~~Decorating the house~~: done in stage 8.
3. **Harder tasks as she grows:** done for the School (Zählen, Rechnen), the Reimhaus (Reimen), the Musterwerkstatt (Muster), the Kalender (Zeit), the Spielwelt (Raum) and the Trommelhaus (Rhythmus) as Lehrplan 21 ladders that move up by themselves and that parents can set (#32, #34). Still open for the other buildings: age tiers, and difficulty that adapts (three right in a row step up, two misses step down). The hub knows no age or birthday: the child's age (or tier) becomes a per-child setting in Brightville's parent area, next to the daily goal, not a field in the hub (decided in the architecture review).
4. **More learning buildings:** Language Café (first English words), World Tower (flags, animals of the world), Building Yard (physics blocks to stack and knock over), Code Workshop (for older children).
5. **For parents:** a weekly report, playing hours (e.g. not after 19:30), the camera on or off per child.
6. **Polish:** day and night in the town, background music; in the town, carrying things (Q), a map (M), a quest board.

Suggested order: let the child play stage 6 first (especially the camera buildings with the new camera), fix what that turns up, then the character's outfits.

## Architecture review (Nov 20, 2026)

A second architecture review after the Lehrplan work. Fixed so far:

- The ladder rules (window, misses) live in `shared/ladders.json`, read by the server and the page alike (#50).
- Building colours and house shapes are looked up by building id, not by the position in the registry (#51).
- One ladder table (`LADDER_DEFS` in `src/core/lehrplan.ts`): name, subject, step texts and where Kindergarten ends. The parents' page shows **one bar per subject** instead of a single overall number (the parent's choice), so a new ladder no longer moves every child's number. The server's results model is made from the shared file and refuses an unknown ladder (a newer page's results wait instead of being lost).
- The learning buildings share their visit lifecycle (`src/buildings/visit.ts`: timers, numbered runs, leaving, the ladder snapshot, scoring; `ProgressStars.vue`); each keeps its own effects (#53–#58).
- Small things: the app's ladder store is `useLaddersStore` (`src/stores/ladders.ts`; the API path, the tables and the device keys still say "school"), `pick`/`shuffle` live once in `src/core/random.ts`, stale comments and README lines fixed, the School's random screen test is seeded.

Left for later: the two offline queues (merge them when a third is needed), a growth plan for the town (no free lots). The Spielwelt's triple drawing was measured in the performance review and is fine. The cool-down guesses for the new buildings: Reimhaus, Musterwerkstatt, Kalender and Spielwelt 2 s per Star, Trommelhaus 3.

