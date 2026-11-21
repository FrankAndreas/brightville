# Brightville – The Town Grows: Nature and Workshop Districts, the Map and the Bicycle (Design)

Status: draft, Nov 21, 2026.

## Intent

No lot is left for a new building. The next ones are already wanted:

- an NMG house (Natur, Mensch, Gesellschaft), the biggest Kindergarten subject the game doesn't touch yet;
- a Bee-Bot-style house where she programs a little vehicle with arrows (Medien und Informatik), the old roadmap's
  "Code Workshop";
- later, the Building Yard and others.

Nineteen plain scenery houses could still be turned into buildings, as was done for the Kalender, Spielwelt and
Trommelhaus. Andreas chose to grow the town instead, so it keeps ordinary houses and keeps feeling like a town.

A bigger town is a longer walk. So she gets a **map**: she taps a building on it, and her own character **rides there
on a bicycle**, along the streets, by itself. Andreas chose the ride over jumping straight to the door. She sees the
way, so over the weeks she learns where things are (Lehrplan Zugang 4, Räumliche Orientierung), and the town stays a
place rather than a menu.

This design covers the growth, the map and the bicycle only. The NMG house and the Bee-Bot house get designs of their
own. This one gives them their lots.

## Goals

- A **nature district** of forest and farm joined onto the town (Andreas: forest and farm), with the lot for the NMG
  house.
- A smaller **workshop district** with the lot for the Bee-Bot house and spare lots for the next ones.
- **Mountains** as a backdrop behind the forest: seen, never reached.
- A **map** she opens from the town and can use without reading, with every building she can go into and a stop in
  each district.
- A **bicycle ride** from where she is to the door she tapped.
- The old town is unchanged: every building, house, street and path stays where it is.

## Non-goals

- The NMG house and the Bee-Bot house themselves.
- Mountains she can walk on, and a gondola. Those could become a district of their own later if she loves the
  mountains. Walkable mountains need steep ground, climbing paths and a camera that copes with slopes.
- Things to do outside in the districts: feeding chickens, finding mushrooms, seasons on the trees. Andreas agreed
  to "look, with a few small touches".
- Riding the bicycle by hand. It only rides itself, on a ride from the map.
- Logging rides or counting them for anything (Stars, stickers, the goal, play time).

## Anti-goals

- A town that turns into a menu: the map must not make walking pointless or the town disappear behind a fade.
- A ride she can't get out of. Touching the controls always gives her the character back.
- A ride to a door she can't open. A closed building on the map says why it is closed, as its door does, and no ride
  starts.
- Frames dropping below today's town. If they do and can't be won back, the districts become separate scenes
  (approach B below).
- Anything on the map that needs reading.

## Constraints

- Everything from earlier stages holds:
  - German voice and English code;
  - no CDN: models are built from code;
  - the layout fits at 1024×768 (touch) and 1440×900;
  - Three.js draws, Rapier does the physics;
  - walking speed stays 4 m/s;
  - doors use the same `DoorDef` and registry (`src/buildings/registry.ts`).
- The town is data first (`src/city/map.ts`), checked by `map.test.ts` before anything is drawn:
  - every door can be reached;
  - nothing she walks on is steeper than 20°;
  - the lake is closed.

  The new districts are data in the same way and pass the same checks.
- The camera draws to 200 m (`followCamera.ts`), with fog from 55 m to fully sky at 110 m (`world.ts`): the fog is what
  hides the distance. House parts are merged into 30 m cells (`merge.ts`), so what is out of view costs little
  already.
- Frame-rate yardstick, from the performance review (Nov 21): the town runs at about 50 frames a second in Chrome on
  an Intel UHD 620 at double pixel density, and the town lowers its own sharpness below about 45 (`quality.ts`). The
  grown town must hold that on the same laptop, measured the same way, with walking in the districts and on the
  longest ride.

## Approaches

Three ways to grow were considered:

- **A. A bigger square.** The wall moves out to about 180 m on each side, and the districts fill parts of the new
  ring.
  - Simplest in code: everything assumes a square today.
  - But it adds a lot of empty ground in the corners, which needs filling (more to draw), and the town feels emptier.
- **B. Districts as separate scenes.** A gate at an avenue's end leads to the forest and farm as a scene of their own,
  and the old town is unloaded meanwhile.
  - Best for the frame rate.
  - But the town breaks into pieces: the farm can't be seen from the plaza, a ride must cross a fade, and the map
    becomes several maps.
- **C. Districts joined onto the edge.** The avenues continue through gaps in the wall into areas added outside the
  old square, and the wall follows the new outline.
  - Ground is only added where something is.
  - The town stays one place, and the map gets a shape she can recognise.
  - It costs more than A: the wall, the ground, the checks and the bicycle's routes work with an outline instead of a
    square.

**Andreas picked C**, with B as the fallback if the frame rate drops. So each district is kept as its own data (its
outline, streets, paths, lots, houses, animals), so that it could become a scene of its own without being redrawn.

## Decided

### Where the districts go *(my call)*

```
                 ▲ mountains (backdrop, never reached)
        ┌──────────────────────┐
        │   forest     farm    │   nature district, about 70 × 45 m
        │      🌲🌲  🐄 🐔      │
        └─────────┬┬───────────┘
                  ││  back avenue (x = 0) continues through the gate
   ┌──────────────┴┴──────────────┐
   │                              │┌────────────┐
   │        the old town          ├┤  workshop  │  about 40 × 40 m,
   │        120 × 120 m           ├┤  district  │  through the right
   │            ⛲ plaza           │└────────────┘  avenue (z = 0)
   │                              │
   └──────────────────────────────┘
               camera's first view looks this way ▲ (towards −z)
```

- **Nature district behind the town (−z),** past the end of the back avenue, about 70 m wide and 45 m deep. The camera's
  first view looks that way, so on day one she sees the roofs and, above them, the mountains. The forest shows as
  faint shapes in the fog until she comes closer *(my call: the fog stays as it is; moving it costs frames)*.
  - The farm is on the right half: a farmhouse, a barn, fenced pens with cows, chickens and pigs or sheep, a field,
    a tractor.
  - The forest is on the left half: dense trees, a clearing, deer at its edge, a dirt path through it.
- **Workshop district to the right (+x),** past the end of the right avenue, about 40 × 40 m. It has a yard look:
  paving, sheds, crates, a crane.
- **The gates:** the back avenue and the right avenue each continue through a gap in the hedge. The scenery houses that
  flank the avenues' ends today stay where they are.
- **The wall** runs around the outer outline of the old square plus the districts, with a low hedge you see and a tall
  barrier you don't, as today. Between a district and the old town there is no wall: the gap is the street, and a
  hedge closes the rest.
- Sizes are first guesses: the builder may move them by a few metres to pass the checks.

### Lots

- **Nature district:**
  - one lot for the NMG house, on the street near the farm and visible from the gate;
  - one spare lot.
- **Workshop district:**
  - one lot for the Bee-Bot house;
  - two spare lots (for the Building Yard and one more).
- Spare lots are a garden or a little square until used, like the cat's and the dog's gardens, and the reachability
  check covers them.
- Until the NMG and Bee-Bot houses exist, their lots are spare lots too. No building is added by this design.

### Life in the districts

Andreas: look, with a few small touches.

- **Farm animals in pens:**
  - cows, chickens, pigs or sheep: block animals like the ducks, cat and dog, on idle loops inside their pen;
  - small touches *(my call)*: chickens scatter a little when she comes close and come back; a cow turns its head
    towards her and moos once (a short sound, at most once every few seconds).
- **Forest animals:** deer at the edge that walk into the trees when she comes close; a squirrel on a tree; birds as in
  the town today.
- **Townsfolk:** one or two of today's wobblies walk a loop in each district (a farmer at the farm). They don't
  collide with her, as today.
- **Workshop:** no animals. A slowly turning crane or a conveyor is enough *(my call)*.

### Mountains

- A ring of snowy peaks behind the forest, wide enough to fill the view whenever she looks towards −z from anywhere
  in town.
- Drawn as a flat-shaded backdrop that the fog doesn't touch, inside the camera's 200 m. It is never in physics and
  costs almost nothing.
- Not on the other sides *(my call)*: one direction with mountains is what makes them useful for finding her way
  ("the mountains are behind the forest").

### The map

- **Opening:** a 🗺️ button in the town's corner next to the ? (and the parents' button). It is shown only in town,
  never inside a building, the help or the parents' area.
- **What it shows:** the town from above, drawn from the map data, so it stays true as the town changes. It is not a
  screenshot.
  - streets, the lake, the park and its hill;
  - each district in its own ground colour: the old town light, the forest green, the farm yellow-brown, the workshop
    grey;
  - the mountains as a band along the top;
  - every door building as its emoji, the same as its sign;
  - a dot where she is, in her body colour;
  - closed buildings with the lock, as at their door.
- **The voice:** when the map opens, "Wohin willst du fahren?". Tapping an open building names it and starts the
  ride: "Wir fahren zur Schule!" *(my call: one tap rides; the line names where, so a mistaken tap is clear and she
  can stop the bike)*.
- **The door states** (`core/access.ts`) on the map *(my call)*:
  - `open`: tapping it rides there;
  - `locked`, `timeUp` and `poor`: drawn as at the door (the lock, and the door's own look for the others); tapping
    one says the same line as its door and starts no ride, since she couldn't go in when she arrives;
  - `unavailable` (this device has no camera or no touch): not on the map at all, since she can never go in there on
    this device.
- **Closing:** a ✕ in the corner, or tapping outside the map's picture.
- **A stop in each district** (Andreas: "to each district"): besides the buildings, every district has one tappable
  landmark she can ride to, even before it has a building:
  - ⛲ the plaza, in the old town *(my reading: the old town is a district too)*: "Wir fahren zum Platz!";
  - 🚜 the farm, stopping at the farm gate: "Wir fahren zum Bauernhof!";
  - 🌲 the forest, stopping where the path enters it: "Wir fahren in den Wald!";
  - 🏗️ the workshop yard, stopping in the middle of the yard: "Wir fahren zur Werkstatt!".

  A stop is always open. Arriving there shows no door prompt: she just stands there, facing the landmark.
- Spare lots and scenery houses are not marked.
- The help overlay gets one more picture: the 🗺️ button.

### The bicycle

- **Getting on:**
  - the map closes;
  - a bicycle appears under her (no walking to a bike stand);
  - her own character, in her outfit, sits on it.
- **Starting off a street** *(my call)*: if she is in the air or tumbling, the ride starts when she stands again. If
  she is on grass (the park, the hill, the playground, a garden), the bike first rides the shortest way over the
  ground to the nearest street that no house, block or water is in the way of, then follows the streets. She is never
  moved by a jump: she sees the whole way.
- **The route:** from that street to the street in front of the chosen door, along streets and
  district paths only. It never crosses grass, the playground or the trampolines: the old path to the Kleiderladen
  over the big trampoline is not a route.
- **Speed:** about three times walking speed (12 m/s) on straight stretches, slower in curves, and a gentle start and
  stop. The longest ride (the workshop's far end to the forest's far end, about 230 m) then takes about 20 seconds
  *(my call: 12 m/s stays; a faster bike is harder on the camera and the frame rate, and a long ride is rare)*.
- **The camera** follows from behind as when walking, with the same rules for houses in the way.
- **Arriving:**
  - the bike stops at the door, she gets off, and the bike disappears;
  - she stands where she would after walking there, facing the door;
  - the door prompt and its line come as usual;
  - she still enters herself: arriving never opens the building.
- **Stopping:** touching the joystick, the walk keys, the jump button or the turn buttons stops the bike within about
  half a second. She gets off where she is and walks on. Opening the map again during a ride starts a new ride from
  where she is.
- **Townsfolk** step aside as for her walking. Animals move as for her walking.
- Rides are free and are not logged.

### Size and finding her way

- The old town's streets keep their names in code. The districts add their own streets and paths.
- The map and the mountains are what keep the grown town findable. No signposts that need reading.

## Fallback to B

If walking in the grown town or the longest ride drops below the frame-rate yardstick, and simpler drawing of the far
districts doesn't win it back, the districts become separate scenes reached through their gates.

- The map then shows the whole town still, and a ride to a district fades at the gate.
- Because each district is its own data, this changes how it is loaded, not what it is.
- The decision is made by measurement, the same way as in the performance review, and written in the roadmap.
- **When** *(my call)*: Claude measures on this laptop (the Intel UHD 620 the yardstick comes from), with the same
  Playwright set-up as the performance review. The first check comes once the districts are built and before the map
  and the bicycle, so B can still be chosen before any ride work. A second check comes at the end, with the longest
  ride.

## Left to the builder

- Exact outlines, street and path courses, lot positions and house counts, within the sizes above, passing the map
  checks.
- The look of the farm, the forest, the workshop yard, the mountains and the bicycle, in the town's existing style
  (blocks, warm daylight colours).
- How the map is drawn: SVG or a canvas, from the map data.
- The route finding: a graph from the streets' centre lines is enough.
- How the bicycle moves the character: through the character controller, or by placing it and keeping the physics in
  step. Either way, at the door she must stand exactly where walking would have put her.
- How far districts are drawn more simply, if measurement asks for it.
- The animals' idle loops and their small touches.
- Updating `map.test.ts` and the other checks from a square to an outline.
