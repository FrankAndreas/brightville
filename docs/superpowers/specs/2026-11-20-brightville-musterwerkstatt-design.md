# Brightville – Musterwerkstatt: Patterns and Sorting (Design)

Nov 20, 2026. Issue #35. Builds on the Lehrplan 21 ladders (#32, #33, PR #41) and follows the Reimhaus (#34, PR #43)
in shape: same ladder machinery, same kind of flow and screen.

## Intent

A new learning building where she learns to see rules in things: what comes next in a row, and what belongs together.
The Lehrplan has this as Zugang 5 (Zusammenhänge und Gesetzmässigkeiten) and under Mathematik: patterns (MA.1.B,
Erforschen und Argumentieren) and sorting by a feature (MA.3, Daten ordnen). The codes are from the template
(v-fe.lehrplan.ch), at Kompetenzbereich level; the builder checks them there and narrows them if the template is clear.

It is new to her (the parent's answer): the building shows before it asks. Everything is said aloud; nothing to read.

## Goals

- A building, the **Musterwerkstatt**, earning Stars like the School and the Reimhaus (five tasks, at most 10 Stars).
- A fourth Lehrplan ladder, **Muster**, with five steps and "fertig", moving up by itself and set by a parent.
- The parents' overview shows it under Mathematik, and the overall number counts it.

## Non-goals

- Dragging. She sorts by tapping a thing, then a basket (the parent's choice).
- Patterns made of sounds or movement (that is #38, rhythm).
- Number patterns (2, 4, 6 …): the School's Zählen ladder has counting in steps.
- Stepping down by itself.

## Anti-goals

- A buzz, a red cross or anything that feels like failing. A wrong answer fades or goes back, is said again, and she
  tries again; the task ends only when it is right.
- A row she has to read: every row is said aloud as its pieces light up, one after the other.
- Colours or shapes that are hard to tell apart on an iPad in daylight: four clear colours (rot, blau, gelb, grün) and
  three shapes (Kreis, Dreieck, Quadrat).

## The ladder: Muster

All five tasks of a visit are at her step.

| Step | Asks | On screen |
|---|---|---|
| 1 | Continue a row of two colours, ABAB: "Rot, blau, rot, blau … was kommt jetzt?" | a row of 4–6 pieces and a gap at the end; three pieces to choose from |
| 2 | Rows of three colours (ABC) or doubles (AAB, ABB) | the same, 6–8 pieces |
| 3 | Rows of shapes (Kreis, Dreieck …: AB and ABC) or sizes (gross, klein: AB, AAB, ABB) | the same |
| 4 | Sorting: four things into two baskets, by colour or by kind (Tiere / Obst, Fahrzeuge / Tiere …) | two baskets, each with one example already inside; the four things below |
| 5 | Two rows with a gap in the middle (one feature, as at steps 2–3), one row that changes two things at once, two sorts by size | as above |
| 6 | "fertig": one row (as step 2 or 3), one gap row, one two-thing row, one sort by colour or kind, one sort by size | |

**A row that changes two things at once** (my call after the builder check): colour and shape change together, as one
AB or ABC row of combined pieces ("roter Kreis, blaues Dreieck, roter Kreis, blaues Dreieck …"). Each wrong choice
gets exactly one of the two right (the right colour in the wrong shape, or the right shape in the wrong colour), so
she has to look at both.

**Sorting by size** (my call): all four things and both examples are the same emoji, two big and two small, so only the
size on screen decides; never a small elephant next to a big mouse.

**Moving up:** as Reimen: of her last 10 answered tasks at the step (two visits), at most 2 missed on the first try.
A parent can set the step (1–5 or "fertig") on the parents' page, which empties the window.

**Where a child starts:** step 1.

## Pieces

Pieces are drawn (SVG), not emoji, so colours and sizes are exact: a filled shape in one of four colours, in two sizes
(the small one about 60 % of the big one). The voice names a piece by what changes in its row: "rot" in a colour row,
"Kreis" in a shape row, "gross" in a size row, "roter Kreis" when two things change.

Things to sort by kind are emoji with one obvious Standard German name (the Reimhaus's rule): animals, fruit,
vehicles. Sorting by colour uses drawn pieces; sorting by size uses the same emoji big and small.

## Showing before asking

While the step's window holds fewer than 10 answers (steps 1–5; none at "fertig"), one example comes first, with
nothing to tap:

- Rows: "Schau: rot, blau, rot, blau. Was kommt jetzt? Rot! Rot, blau, rot, blau, rot." — each piece lights up as it is
  named, and the right piece slides into the gap.
- At step 5 the example is a gap row: "Schau: rot, blau, … rot, blau. Was fehlt? Blau!"
- Sorting (step 4): "Die Tiere kommen in diesen Korb, das Obst in den anderen. Der Hund ist ein Tier: hier hinein!" — the dog
  moves into its basket.

A 🔊 button repeats the instruction of the moment, as in every building (and stops anything still being named, as in
the Reimhaus).

## Answering

**A row:** the voice says the row, each piece lighting up as it is named, then "Was kommt jetzt?" (or "Was fehlt?" for
a gap in the middle). Three pieces to choose from, one right. A tap is her answer.

- Right: a chime, the piece fills the gap, the whole row is said once more, a cheer.
- Wrong: the piece fades, "Hör nochmal: rot, blau, rot, blau …" with the row lit again, and she tries again with what
  is left.

**Sorting:** the voice says the rule ("Tiere hierhin, Obst dorthin"). She taps a thing (it lifts and lights, and its
name is said), then a basket.

- Right basket: the thing moves in with a soft sound. When all four are in: a chime and a cheer.
- Wrong basket: the thing goes back to its place, "Der Apfel ist Obst. Schau nochmal." She tries again.
- Tapping another thing changes which thing is lifted. Tapping a basket with nothing lifted does nothing.
- The task counts as right on the first try only if every thing went into its basket on the first try.

## Tasks of a visit

Five tasks at the step, never the same row or the same set of things twice in a visit; the right answer in different
places among the three choices. Stars: one per solved task and 5 for finishing, 10 at most (`STARS_PER_TASK`,
`SET_BONUS`). `minSecondsPerStar` 2.

## The building in the town

- Id `muster`, spoken name "Musterwerkstatt", sign icon 🧩, kind `earn`, needs nothing.
- Door on the last free lot, (3.5, 51, side right), on the street past the Yoga studio. The lot list keeps the cat's
  and the dog's gardens; the dog's index changes with it (`DOG_GARDEN` in `src/city/animals.ts`).
- Its own colour pair, like every building.
- *(Noted for later: after this, no free lot is left; #36 Kalender and #38 Rhythm will need a new place.)*

## Server and app

- `muster` becomes the fourth ladder in the existing machinery (`backend/app/school.py`, `src/core/ladders.ts`,
  `src/stores/school.ts`), window 10, misses 2, start step 1. Results name it alone, as the Reimhaus's do.
- Where the code lists the ladders by name (the store's cached steps and server answer, the results model), it should
  loop over the ladder list instead, so a ladder missing from old data or an old server falls back to step 1 by the
  same rule. *(My call: the fifth ladder should not need the same patches again.)*

## Parents' overview

- Under **Mathematik**: a row "Muster — Stufe n von 5 „…“ [Stufe ändern]" after Zählen and Rechnen.
- Step texts: 1 „Reihen mit zwei Farben“, 2 „Reihen mit drei Farben“, 3 „Reihen mit Formen und Grössen“,
  4 „Sortieren nach Farbe und Art“, 5 „Lücken, Grösse, zwei Merkmale“, fertig.
- **The overall number** becomes the average of five shares: Zählen, Rechnen, Reimen, Muster and Buchstaben.
- **The end of Kindergarten mark:** Muster's Kindergarten target is step 4 reached (60 %), so the mark becomes
  (40 + 40 + 100 + 60 + 0) / 5 = 48 %. *(My call: continuing patterns is a Kindergarten goal; sorting by two features
  and gaps belong to 1st grade.)*
- Tags: `muster` gets codes `MA.1.B` and `MA.3` and Zugang 5 (and 2, Wahrnehmung).

## Left to the builder

- The exact rows and sets of things (within the rules above), the pieces' drawing, the baskets' look, timings.
- The split between a pure flow module and the screen, as in `src/buildings/reimhaus/`.
- Fitting the screen at 1180×820, 1024×768 and 768×1024.

## Also in this PR

- `docs/roadmap.md`: item 14; the calls above under "Calls made without asking".
- README: the Musterwerkstatt row and section; the parents' paragraph names Muster and the five-part number.
