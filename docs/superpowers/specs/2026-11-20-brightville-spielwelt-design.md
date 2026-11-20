# Brightville – Spielwelt: Position Words in a Wide 2D World (Design)

Nov 20, 2026. Issue #37. Builds on the Lehrplan 21 ladders and follows the Reimhaus, Musterwerkstatt and Kalender
in how a visit, a ladder and the parents' page work, with the lessons of their reviews (lit reset per run, 🔊 stops
what is being said and forgets a solved question, whole German sentences, no dead taps during examples, no question
with two fair answers).

## Intent

Position words — auf, unter, in, neben, vor, hinter, zwischen, links, rechts — learned by doing, in a 2D world much
wider than the screen that she scrolls through, where she can pick things up, put them somewhere else and drive a
car. The Lehrplan has this as Zugang 4 (Räumliche Orientierung) and Mathematik MA.2 (Form und Raum).

The parent's picture: 2D only, but bigger than the screen; close-to-endless scrolling left and right; moving things
around; driving a car. (The parent named an existing children's app with these mechanics as the feel to aim for. The
Spielwelt is our own world: its own landscape, drawings and things; only the kind of play is shared.)

**A learning building with free play as the reward** (the parent's choice): five tasks first, then the world stays
open for free play for as long as she likes (the parent's choice).

## Goals

- A building, the **Spielwelt**, earning Stars like the others (five tasks, at most 10 Stars).
- A sixth Lehrplan ladder, **Raum**, with five steps and "fertig", moving up by itself and set by a parent.
- The world is wide (about six screens), scrolls by swiping, has things she can carry and a car she can drive.
- After the tasks, free play until she leaves. The world remembers where she left things.
- The parents' page shows Raum under Mathematik; "Diese Woche geübt" lists Zugang 4 again (it was left out because
  walking the town isn't logged; now a building practises it).

## Non-goals

- 3D, walking the town, a character in the world.
- Endless procedurally made land: the world is fixed and wraps around (scrolling past the right end comes back in on
  the left), which feels endless. *(My call.)*
- Physics (things falling, rolling). A dropped thing settles onto the nearest surface below it.
- Stepping down by itself.

## Anti-goals

- A buzz or anything that feels like failing. A thing put in the wrong place stays there, and the voice says where it
  is now and asks again.
- A task that can't be solved because she left things in odd places last time: before each task the things it needs
  are put where the task can be done.
- A "links/rechts" that depends on a viewpoint: left and right are always the screen's.
- Free play that pays: Stars come only from the five tasks.

## The world

A side-on landscape, about six screens wide (at the iPad's landscape size), from left to right:

1. **The house**, cut open: a room with a bed, a table with a chair, a cupboard (Schrank) and a box (Kiste).
2. **The garden**: a tree, a fence, a bench, a flower bed.
3. **The pond** with a bridge over it.
4. **The playground**: a slide (Rutschbahn), a sandbox (Sandkasten), a swing (Schaukel).
5. **The street** with a garage and the car.
6. **The meadow**: a big stone, a bush, a dog house (Hundehütte).

**Things to carry** (each with one obvious name, drawn or emoji): Ball, Teddy, Katze, Eimer, Apfel, Buch, Hut,
Ente. **Objects** (furniture and landscape) don't move.

**Depth:** the ground has two lanes besides the objects' own line. A thing dropped a little higher than an object's
foot, overlapping it, goes **hinter** it (drawn behind, smaller, partly hidden); dropped a little lower, **vor** it
(drawn in front, a little bigger). That makes vor and hinter something she can do in 2D. *(My call; the builder
decides the exact lane heights.)*

**Scrolling:** swiping on the background scrolls; carrying a thing to the screen's edge scrolls too. A small strip at
the top shows the whole world with where she is (tapping it scrolls there). *(My call: so she can't get lost.)*

**The car:** tapping the car makes it honk, and two big arrows ◀ ▶ appear; holding one drives, and the view follows.
Tapping the car again gets out. Things can be put on (auf) or in the car.

**Remembering:** where she left the things is kept per child on this device (browser storage), and comes back next
visit. *(My call: it's play, not progress; nothing is lost but the arrangement if it goes.)* There is one arrangement:
a task moves only the things it needs, and they stay wherever the task ends; everything else stays where she put it.
Things on or in the car move with the car.

## Relations

The game decides where a thing is, relative to an object, from their outlines:

| Word | When |
|---|---|
| auf | resting on the object's top surface |
| unter | below the object's top, within its width, where the object has room under it (table, bed, bench, bridge, slide, car) |
| in | inside a container (Kiste, Schrank, Sandkasten, Hundehütte, car); the Eimer is a thing to carry, not a container *(my call after the builder check: no things inside things she carries)* |
| neben | on the same ground as the object, close to its left or right, not overlapping |
| vor / hinter | on the front or back lane, overlapping the object |
| zwischen | on the ground between two objects that are close together, not overlapping either |
| links neben / rechts neben | neben, on the screen's left or right side of the object, close to it (never "anywhere to the left": the world wraps around) |

When a thing fits more than one word (on the bench and next to the tree), the task's word is checked; the
description after a miss uses the closest object. *(Builder: a pure module with tests for each word.)*

## The ladder: Raum

All five tasks of a visit at her step; each visit has **two finding** and **three placing** tasks (*my call*).

| Step | Words | Range |
|---|---|---|
| 1 | auf, unter, in | the thing and the object on the same screen |
| 2 | neben, vor, hinter | the same screen |
| 3 | zwischen, and steps 1–2 | up to one screen apart |
| 4 | links neben, rechts neben: "Leg den Ball links neben den Baum" | anywhere in the world |
| 5 | two clues, to two objects that stand close, both must hold: "Leg den Ball auf die Bank, rechts neben den Baum", "Die Katze sitzt unter dem Tisch, links neben dem Schrank" | anywhere |
| 6 | fertig: a mix of all | anywhere |

- **Finding:** the game puts a thing somewhere ("Die Katze sitzt unter dem Tisch. Findest du sie?"); she scrolls there
  and taps it. A tap on the wrong thing: "Das ist der Ball. Die Katze sitzt unter dem Tisch." Counted missed. Things
  behind something peek out (an ear, a tail), never hidden completely.
- **Placing:** "Leg den Ball auf das Bett." She carries the ball there. Only a release **near the task's object(s)**
  (within about half a screen) is judged: right → cheer; wrong → it stays, and the voice says where it is: "Der Ball
  liegt jetzt neben dem Bett. Leg ihn auf das Bett." Counted missed. Setting the ball down on the way, anywhere else,
  is not judged and not counted *(my call after the builder check)*; nor is moving other things.
- **Two clues (step 5):** the pairs come from a fixed list of objects that stand close (bench and tree, table and
  Schrank, bridge and pond's reeds …), so both can hold. A miss names the clue that isn't met yet.
- Before a task, the things it uses are put back where it can be done (and where she can see the thing to carry, at
  steps 1–3 on the same screen as the object).

**Moving up:** of her last 10 answers at the step, at most 2 missed on the first try. Parents can set the step (1–5
or "fertig"), which empties the window. Start step 1.

## Showing before asking

While the step's window holds fewer than 10 answers (steps 1–5; none at "fertig"), one example first, nothing to
tap: the voice says and the game shows it, for example "Schau: der Ball liegt auf dem Tisch" (the ball moves onto the
table), "jetzt liegt er unter dem Tisch" (it moves under). At step 2 vor and hinter with the tree; at 3 zwischen two
trees; at 4 links and rechts of the bench; at 5 one with two words. 🔊 repeats the task or the example.

## Free play

After the fifth task: confetti, "Super gemacht! Jetzt darfst du frei spielen.", and the world stays open: carry
things, drive, scroll. No more tasks, no more Stars. She leaves with the door button as always; the Stars earned are
counted then (and are safe even if she leaves during the cheer, as elsewhere). Free play in an earning building
doesn't count against the parents' daily play time (that limits play buildings only). *(Noted: the parent chose "as
long as she likes".)*

## The building in the town

- Id `spielwelt`, spoken name "Spielwelt", sign icon 🚗, kind `earn`, needs nothing (a mouse can drag too).
- No free lot: one more plain scenery house becomes the Spielwelt, chosen by the builder on a street (the map and
  nature tests decide), preferably near the playground.
- Its own colour pair.

## Server and app

- `raum` becomes the sixth ladder: window 10, misses 2, start step 1 (server field and constants; the app loops).

## Parents' overview

- Under **Mathematik**: "Raum — Stufe n von 5 „…“". Step texts: 1 „auf, unter, in“, 2 „neben, vor, hinter“,
  3 „zwischen“, 4 „links, rechts“, 5 „zwei Angaben zusammen“, fertig.
- **Overall number:** seven shares. **End of Kindergarten:** Raum step 4 reached (60 %): auf to zwischen are
  Kindergarten; links/rechts are 1st grade. Mark: (40 + 40 + 100 + 60 + 80 + 60 + 0) / 7 = 54 %. *(My call.)*
- Tags: `spielwelt` gets `MA.2` and Zugänge 4 and 2. Zugang 4 comes back into "Diese Woche geübt" (`NOT_LOGGED`
  keeps only 9).

## Left to the builder

- The drawings (simple, flat, friendly), the exact layout, lanes and sizes, timings, the car's speed.
- The split: a pure world/relations module, a pure flow, a screen.
- Performance on an iPad Air 4: a wide SVG or canvas that scrolls smoothly; only what is near the view drawn if
  needed.
- Fitting 1180×820, 1024×768, 768×1024 (portrait shows less width; the world is the same).

## Also in this PR

- `docs/roadmap.md`: item 16, the calls above. README: the Spielwelt row and section, the parents' paragraph.
