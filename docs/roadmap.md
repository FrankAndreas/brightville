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

Each stage has its design in `docs/superpowers/specs/`; what the game does now is in the README.

## Not yet checked in real life

These were tested with automated tests and in a desktop browser, but not where they matter:

- **Hüpfhalle and Tanzsaal with a real child and camera.** The rules are tested against made-up bodies. A separate camera is planned because the laptop's built-in one needs too much distance. If moves count too easily or not at all, the thresholds are in `src/core/moves/reps.ts` (Hüpfhalle) and `src/core/moves/dance.ts` (Tanzsaal).
- **Everything on a real iPad:** turn buttons, swiping, drawing, Schreiben with the pen, the camera buildings.
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

## Calls made without asking, which may be worth revisiting

- The Cinema costs 3 Stars per film, not per minute; one film list for all children.
- The Hüpfhalle pays 3 Stars per round (at most 9), not the gameplay document's 5.
- No version without a camera for the Hüpfhalle and Tanzsaal: their doors stay closed on a device without one, like Yoga's.
- Stickers: the list of 17 in `shared/stickers.json`. Days from before goal days were kept count as "goal reached" against each child's goal at the update that wrote them down.
- The cool-down's seconds per Star are guesses: about half of the fastest real visit (school 2, Schreiben 1.5, Yoga 1.5, Unterschiede 1, Bibliothek 2, Farblabor 1, Hüpfhalle 2, Tanzsaal 4). If a fast child's visits ever arrive late, lower them in `shared/buildings.json`.
- A visit to Malen or Ausmalen counts with at least ten strokes or fills and a minute inside, the same for every child (not a parent setting): the bar only keeps walking in and out from counting. A five-year-old typically stays with one activity for about 10–15 minutes, far above it.
- A visit to Malen or Ausmalen made while the server can't be reached isn't kept for later.

## Left from the gameplay document

Not planned as stages yet. Roughly by how much they would add for a five-year-old:

1. **Dressing up the character:** colours, hats, outfits, some unlocked by stickers. Gives the stickers a use.
2. **Decorating the house:** furniture and a trophy shelf.
3. **Harder tasks as she grows:** age tiers, and difficulty that adapts (three right in a row step up, two misses step down). The hub knows no age or birthday: the child's age (or tier) becomes a per-child setting in Brightville's parent area, next to the daily goal, not a field in the hub (decided in the architecture review).
4. **More learning buildings:** Language Café (first English words), World Tower (flags, animals of the world), Building Yard (physics blocks to stack and knock over), Code Workshop (for older children).
5. **For parents:** a weekly report, playing hours (e.g. not after 19:30), the camera on or off per child.
6. **Polish:** day and night in the town, background music; in the town, carrying things (Q), a map (M), a quest board.

Suggested order: let the child play stage 6 first (especially the camera buildings with the new camera), fix what that turns up, then the character's outfits.
