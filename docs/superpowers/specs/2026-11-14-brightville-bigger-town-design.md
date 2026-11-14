# Brightville – A Bigger Town to Walk and Discover

Nov 14, 2026 · Andreas Frank

Lines marked **(call)** are decisions made by Claude, not by Andreas. Everything else comes from Andreas or from earlier stages.

## Intent

Andreas showed [Trick or Clawd](https://trick-or-clawd.claudepages.dev/): a 3D town of detailed, colourful row houses with streets between them. What he liked: **the detailed houses, street-like paths between them, hills, lakes**. Not the night and not the spooky part: "this is not for kids this age".

Today Brightville is one flat square of 62 × 62 m with plain pastel boxes for houses: the 18 buildings stand in a ring along the walls, a few steps from the plaza. The town becomes a place to explore: walking and discovering is fun for her, and not every house needs a challenge (Andreas).

We take the *style* of that game (blocky but detailed houses, lived-in streets, a landscape) and none of its pieces: no Clawd figure, no title art, no San Francisco or bridge, no pixel or gothic fonts **(call)**.

## Goals

- **A bigger town** with streets and paths between the houses, gentle hills and a lake.
- **Detailed houses**: blocky, with windows, doors, awnings, balconies, chimneys, flower boxes, shop signs. The 18 door buildings keep their emoji sign above the door, so she still knows each one.
- **Many houses are just houses**: scenery between the door buildings, no door to enter.
- **The door buildings mixed through the town** (Andreas): learning, creative, play, shop and home buildings are not grouped into quarters, so every walk passes a bit of everything.
- **Life to discover** (Andreas): animals (ducks on the lake, birds, a cat, a dog), flower beds and meadows, boats on the lake, and **anonymous townsfolk** walking around (Andreas: not her family's wobblies).
- **Friendly daylight**, as today. Nothing dark, nothing spooky.
- **Smooth on her iPad** (Andreas: an iPad Air, 4th generation: A14 chip, 4 GB, 2360 × 1640 Retina screen, from 2020).

## Non-goals

- Night, dusk, fog, Halloween or anything scary (Andreas).
- Anything inside the buildings changes: entering a door opens the same building screen as today.
- Townsfolk or animals she can talk to, follow, feed or collect; hidden stars or rewards in the town **(call: it is decoration and discovery only; Stars stay earned in the buildings)**.
- Swimming or riding the boats **(call)**.
- Day and night cycle, weather **(call)**.
- A map screen or minimap **(call; possible later if she gets lost)**.

## Anti-goals

- She gets lost or stuck and can't find her way back: no dead ends she can't walk out of, no hole she falls into, no slope she can't climb back up.
- Something chases her, blocks a path or a door, or scares her (a dog that runs at her, a townsperson standing in the doorway).
- The iPad gets slow, hot or choppy.
- A walk so long that getting to Schreiben feels like a chore.
- It looks like a copy of Trick or Clawd.

## Constraints

- Everything from earlier stages holds: German voice, English code, no CDN (all models built from code, as today, or as local files), layout fit at 1024×768 (touch) and 1440×900.
- The town stays Three.js for drawing and Rapier for physics (`src/city/`); the character, its kinematic controller, the wobbly, the follow camera, the turn buttons, trampolines and the playground keep working as they do.
- Doors: the same `DoorDef` model (`src/city/doors.ts`) and registry (`src/buildings/registry.ts`). Only each building's `door` position (and side/facing) changes. Opening, closing, locking and entering a door don't change.
- Walk speed stays 4 m/s.

## Decided

### Size and shape

- **About 120 × 120 m** (HALF_SIZE about 60), instead of 62 × 62 **(call)**: about 15 seconds' walk from the plaza to an edge. A low wall or hedge with the tall invisible barrier around it, as today.
- **The plaza stays in the middle and is where she starts** **(call)**. Streets lead out from it in a few directions and are linked by smaller paths, so most places can be reached two ways.
- **Ground**: grass with paved streets (a path colour clearly different from the grass) and dirt paths **(call)**.

### Landscape

- **Hills**: a few gentle grassy hills, all walkable up and down at walking speed (slope well under the controller's climb limit), so she can't get stuck **(call)**. Streets stay flat or nearly flat; hills sit between them.
- **A lake** on one side, with a shore and a little wooden jetty with boats. The water can't be walked into: an invisible low collider along the shore stops her, as the wall does at the edge **(call)**. The jetty can be walked onto.
- **Trees, bushes, flower beds, fences, lamp posts, benches**, placed along streets and in gardens.

### Houses

- **Door buildings**: built from blocks in the new style, about the same footprint as today (8 × 5 m, the door 1 m in front), with the emoji sign, the glowing door ring and the lock as today. **Each gets its own colour pair**, warmer than today and kept close to its current hue; today 12 pairs are shared by 18 buildings, so mixed through the town two could stand side by side **(call)**.
- **Scenery houses**: the same kit (walls, roofs, windows, awnings, balconies, chimneys, signs) combined differently, roughly 20–30 of them **(call)**. Solid: she walks around them.
- **Mixed placement** (Andreas): the layout is a hand-made list of positions **(call)**, chosen so that the learning buildings aren't all on one street. Mein Haus stands near the plaza, so home is never far **(call)**.
- **Four empty lots** along the streets for the buildings on the roadmap (Language Café, World Tower, Building Yard, Code Workshop), kept free of houses and checked by the same reachability tests; until used they are a garden or a little square **(call)**.

### Life

- **Townsfolk**: a handful (about 6–8) of anonymous wobblies with a random look (body colour, hair, glasses; the free part of `src/core/look`) and **none of the outfit catalogue's items**, so what she buys or is given stays hers **(call)**, walking fixed loops along streets **(call)**. They don't collide with her: they slow down and step around her, and never stop in front of a door **(call)**.
- **Animals**: ducks paddling on the lake, birds hopping that fly up when she comes close, a cat sleeping on a wall, a dog in a garden **(call)**. Simple block animals, on fixed paths or idle loops, none of them moving towards her.
- **Boats**: two or three small boats drifting slowly on the lake **(call)**.

### Look

- **Daylight, warmer and richer colours** than today's pastels: closer to that game's warm orange and violet house colours, but bright and sunny, under a blue sky **(call)**.
- **Fonts and buttons stay as they are**: the clear sans-serif. She is learning to read and write capitals; pixel or gothic letters would get in the way **(call)**.

### Finding her way

- **"Look home" (the button that turns the camera) turns the view towards the plaza**, wherever she is, instead of towards the old learning row **(call)**.
- From the plaza, the emoji signs of a few buildings are visible down each street **(call)**.

### iPad

- **One sun with shadows**, the shadow area following her instead of covering the whole town **(call)**. Repeated parts (windows, trees, flowers, fences) are drawn as instanced meshes, so the whole town is a few hundred draw calls at most **(call)**.
- Far scenery may be simpler or fade out **(call)**.
- Aim: 60 fps on her iPad Air 4 (A14), never below 30 fps. Pixel ratio capped at 2 as today, lowered automatically if frames get slow **(call)**. Townsfolk use a simpler wobbly (fewer sphere segments) than hers **(call)**. Checked in Chrome with CPU throttling and the frame time logged, since Claude can't run her iPad; Andreas tries it on the iPad before merging **(call)**.

## Left to the builder

- The exact map: street layout, where the hills, lake and each building go, within the rules above.
- How the house kit is built in code, the exact colours, how many trees and flowers.
- How townsfolk avoid her (steering, a pause or a sidestep), the animals' idle movements.
- Splitting the work into stages, as long as each stage leaves a working, playable town.
- Moving the trampolines and the playground to fitting places in the new town.

## Testing

- Unit tests (Vitest) for what can be checked without drawing: no two buildings or houses overlap; every door is reachable from the plaza on walkable ground (a walk over a grid of the map); every door has free space in front; no hill is steeper than the climb limit; townsfolk loops stay on streets and keep clear of doors; the lake is closed off; the start is on the plaza.
- The existing tests for doors, entering, the character, the camera and the props keep passing or are moved to the new positions.
- A Chrome check with screenshots from the plaza and a few streets, and the frame time logged with throttling.
