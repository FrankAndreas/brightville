# Brightville – Stage 5 Design: More Buildings

Nov 12, 2026 · Andreas Frank

Stage 5 of the strategy in `2026-11-12-brightville-stage1-design.md`: the rest of Spielzeugkiste moves into the town.

Lines marked **(call)** are decisions made by Claude, not by Andreas.
Andreas asked to "continue with next stage" and did not review this design before it was built.

## Intent

Everything the child liked in Spielzeugkiste is a house in Brightville, so the old app is no longer needed on the iPad.
The rule of the town stays: learn first, then play.

## Goals

- Five new buildings, each ported from Spielzeugkiste with its rules and tests: Unterschiede, Ausmalen, Malen, Schlange and a maze game.
- The town has room for nine doors and still reads at a glance: learning at the back, making things on the left, playing on the right.
- A third kind of building, **free**, for making things: always open, no Stars either way.

## Non-goals

- **Cinema.** Spielzeugkiste has nothing to port, and what it should show (which videos, from where, chosen by whom) is for Andreas to decide. **(call: left for a later stage)**
- Käseklicker and Rate mal! from Spielzeugkiste: not in the strategy's list. Rate mal! needs two iPads. **(call)**
- Theme pickers. Brightville has no menus; a visit takes a theme at random, or the child picks a picture where picking is the game (Ausmalen). **(call)**
- Paintings on the server. They stay on the device, per child. **(call: images are large and the NAS backup should stay small)**
- Best scores. Spielzeugkiste kept them per device; the town's reward is Stars. **(call)**

## Anti-goals

- A building that earns Stars for tapping at random.
- A copy of a well-known arcade game. The maze game keeps the genre (collect sweets in a maze, chasers, a power-up that turns the tables) but gets its own name, its own mazes and Spielzeugkiste's emoji look. **(call)**

## The buildings

| Building | Icon | From | Kind | Stars | Needs |
|---|---|---|---|---|---|
| Unterschiede | 🔍 | differences | earn | 1 per difference found without the hint, at most 10 | — |
| Ausmalen | 🎨 | coloring | free | — | — |
| Malen | 🖌️ | malen | free | — | — |
| Spielhalle (Memory) | 🃏 | stage 2 | play | costs 3 | — |
| Schlange | 🐍 | snake | play | costs 3 | — |
| Bonbonjagd | 🍬 | pacman | play | costs 3 | — |

Spielhalle is the stage 2 Arcade, unchanged except where it stands.

### Free buildings **(call)**

- The door is open whenever the device can serve the building: before the daily goal, with no Stars, after the play time is used up.
- A visit earns nothing, costs nothing, does not count towards the daily goal and does not count as play time.
- The server learns of the kind from `shared/buildings.json` and refuses visits and rounds for it, like for any building of the wrong kind.

### Unterschiede

- Two pictures side by side; ten differences; a tap on either picture.
- A scene at random from the four, never the same scene twice in a row on this device. Within a scene, Spielzeugkiste's rule keeps two rounds apart.
- The lamp shows one difference; that one gives no Star when tapped. **(call)**
- Tapping at random: five misses within ten seconds make the pictures rest for three seconds, and the voice says "Schau genau hin!" **(call: Spielzeugkiste had no limit, and Stars make it worth tapping everywhere)**
- All ten found: confetti and back to the town with the Stars. Leaving early keeps the Stars found so far.

### Ausmalen

- A wall of all coloring pages (seven themes, about twenty pictures) as big picture buttons. One tap opens the page.
- A colour palette; a tap on a part of the picture fills it. As in Spielzeugkiste, pages are not saved.
- The leave button goes from a page back to the wall, and from the wall back to the town. Esc does the same.

### Malen

- Spielzeugkiste's free drawing: brush, pencil, eraser, shapes, three sizes, twelve colours, undo.
- A gallery of this child's paintings on this device (the newest 20), a new sheet, and painting further on an old one. Saved when the child leaves the sheet.
- A resting hand is ignored, with the pen rule from Schreiben.
- The mouse is allowed: drawing with a mouse is still drawing. **(call)**

### Schlange

- Spielzeugkiste's snake on its 15 × 15 field, with a random theme of the two.
- One round per payment: it ends when the snake runs into itself. Then the count of treasures is said, and the child is back in the town. **(call)**
- Arrows or WASD on the keyboard; swipe anywhere, or an on-screen arrow pad, with a finger.

### Bonbonjagd **(call: name)**

- Spielzeugkiste's maze rules (wandering chasers, five lives, a power-up that makes them scared, a tunnel at the sides), on new mazes drawn for Brightville. A visit takes one of them at random, with a random theme of the two.
- Always the slow speed. **(call: a five-year-old; no menu)**
- One round per payment: it ends when the lives are gone or every sweet is eaten.
- The same controls as Schlange.

Play time counts in Schlange and Bonbonjagd like in the Spielhalle; a round already started may be finished.

## The town

The square keeps its size. The doors stand on three sides **(call)**:

- **The back** (as now, facing the camera): School, Schreiben, Yoga, Unterschiede.
- **The left side**, facing the middle: Ausmalen, Malen.
- **The right side**, facing the middle: Spielhalle, Schlange, Bonbonjagd.

The camera always looks from behind, so a door on a side is seen from its edge. Side buildings therefore carry their sign as a hanging sign sticking out from the wall, facing the camera, like a shop sign in an old town. The sign hangs on the camera side of its door, so the next house's sign doesn't cover the picture. The glowing ring on the ground and the door prompt work as before.
Every door has at least 3 m to any other house, and the trampoline moved further from the doors, so nobody bounces away at a door. The scenery houses give way, except one in the near left corner.

## Found while building

- Two requests at the same moment (leaving a play building reports the play time and asks for the Stars at once) made the stage 4 server fail with an error 500: FastAPI may open a request's database connection in one thread and use it in another. Fixed in part 2.

## Delivered in two parts **(call)**

Each part is its own pull request and leaves a working game.

1. **The town and making things:** nine-door layout, the free kind (game and server), Ausmalen, Malen.
2. **Finding and playing:** Unterschiede, Schlange, Bonbonjagd, and the shared arrow controls.

Each part is built from this design without a separate written plan: every building plugs into the existing building contract. **(call)**

## How we know it works

- Every ported rule keeps its Spielzeugkiste tests, converted to TypeScript.
- Each building has component tests for entering, leaving early, finishing and the Stars it reports.
- Server tests for the free kind.
- Headless Chrome walks to every new door, goes in and comes out, with no console errors.
- Not possible here: a real iPad.

## Left to the builder

- Colours of the new houses, sizes of the hanging signs, positions along the sides.
- The look of the arrow pad.
- The new mazes, as long as every sweet can be reached and the chasers have room.
