# Brightville – Lehrplan 21: School Ladders and the Parents' Overview (Design)

Nov 16, 2026. Issues #32 (tags and parents' view) and #33 (School ladders). The other Lehrplan issues (#34–#38) are
new buildings and come later; this design only makes room for them.

## Intent

The parents want to see the game against the Lehrplan 21 (Zyklus 1, Kindergarten to 2nd grade): how far she is, what
she practised this week, and what she left out. The School, the one building that teaches numbers, should climb the
Lehrplan's ladders step by step instead of always asking counts and sums up to 9.

The child never sees any of it: no marks, no steps, no percentages in the town. Kindergarten in the Lehrplan has no
marks, and the game shouldn't add any.

## Goals

- The School asks at her step on two ladders, **Zählen** (MA.1.A.2) and **Rechnen** (MA.1.A.3), and moves her up by
  itself.
- Parents see one overall number per child, which opens into the subjects, the ladders and this week's practice.
- Parents can set each School ladder's step.
- Every building is tagged with the Lehrplan areas and Zugänge it practises.

## Non-goals

- New buildings (#34–#38). Their Zugänge show as "not practised" until they exist.
- Canton-specific codes. The codes are from the template (v-fe.lehrplan.ch); the canton isn't known yet.
- Levels for buildings that don't measure anything (Yoga, Malen, Farblabor …).
- Stepping down. A step, once reached, stays (a parent can set it lower).

## Anti-goals

- Anything in the child's view that looks like a grade, a step or a failure. The School still never buzzes.
- A number that makes a Kindergarten child look behind: the bar shows where Kindergarten typically ends.
- A School visit that gets longer or harder to finish: still five tasks, still 10 Stars at most.

## Approaches

- **A – one School step for everything.** One number sets the whole visit. Simple, one control. But counting and
  adding grow at different paces: she would be held back or pushed in both.
- **B – two ladders, Zählen and Rechnen (picked).** Each has its own step and moves up on its own. Matches the
  Lehrplan, which keeps them as two Kompetenzen. Costs one more stored number and one more control.
- The parent added: on top of B, **one combined number** for the overview, with drill-down.

## The ladders

Each ladder has 5 steps. Step n means "working on step n"; a ladder's share is (completed steps) / 5, so step 1 is
0 %, step 5 is 80 %, and 100 % is step 5 completed (a sixth state, "fertig", which keeps asking step-5 tasks).

**Zählen (MA.1.A.2)** — three tasks per visit:

| Step | Asks | Lehrplan |
|---|---|---|
| 1 | count up to 10 things; one die | towards a |
| 2 | count up to 20 things; one die; "what comes after n" up to 20 | a |
| 3 | forwards and backwards from any number up to 20; in twos to 20; up to 5 dots seen briefly ("Blitzblick", no time to count) | b |
| 4 | up to 100 in steps of 1, 2, 5 and 10 (tens bars and ones) | c |
| 5 | forwards and backwards from any number up to 100; from tens in steps of 2, 5, 10 | d |

**Rechnen (MA.1.A.3)** — two tasks per visit:

| Step | Asks | Lehrplan |
|---|---|---|
| 1 | plus up to 5 | towards a |
| 2 | plus up to 10 | towards a |
| 3 | plus and minus up to 10; doubling up to 10 | a |
| 4 | plus and minus up to 20 | a |
| 5 | tens up to 100 without carrying (30 + 20, 35 + 13 shown with bars) | b |

Today's School (counts and sums up to 9, one die) is roughly Zählen 1 and Rechnen 2: a child who has used it starts
there; a new child starts at Zählen 1, Rechnen 1.

The answer is still picked from three choices, said aloud as now. The things to count stay pictures; numbers above 20
are shown as tens bars and ones, never as written digits alone.

**Moving up:** a ladder moves up one step when, of her last answered tasks on that ladder at the current step
(Zählen: the last 6, Rechnen: the last 4, i.e. two full visits), at most one was missed on the first try. Until that
many are answered at the step, it doesn't move. The window runs across visits: a visit she leaves early adds the tasks
she answered and nothing else. After a move up, the window starts empty. *(Builder check, my call: a rolling window of
answered tasks, so early leavers still progress, but never on less evidence than two full visits.)*

**Parents set a step:** on the parents' page, each ladder's step can be set to any of 1–5 or "fertig". Setting it
starts the count over.

## The overall number

Three ladders are measured: Zählen, Rechnen and **Buchstaben** (Schreiben's letters: the share of the 29 letters A–Z,
Ä, Ö, Ü at level "gelernt"; digits don't count). The overall number is the average of the three shares, as a whole
percent.

100 % is the end of Zyklus 1 (end of 2nd grade). A marker on the bar shows the end of Kindergarten, the average of
these targets: Zählen step 3 reached (40 %), Rechnen step 3 reached (40 %), Buchstaben 0 % (writing starts in
1st grade) — about 27 %. The targets are constants in one file.

## The parents' page

In each child's card, under the diary, a folded "Lehrplan 21" section, fetched when opened (like Schreiben's):

```
Lehrplan 21          ████████░░░░░░░░░░  38 %   ▸
                         ↑ Ende Kindergarten
 ▾ Mathematik
     Zählen     Stufe 2 von 5  „bis 20, was kommt danach"   [ändern]
     Rechnen    Stufe 1 von 5  „plus bis 5"                 [ändern]
 ▾ Deutsch
     Buchstaben 8 von 29 gelernt
 ▾ Diese Woche geübt
     ✓ Körper, Gesundheit und Motorik (Yoga ×2, Hüpfhalle)
     ✓ Wahrnehmung (Unterschiede)
     – Zeitliche Orientierung (noch kein Haus)
     …
```

Each step has a short German description. Under Mathematik and Deutsch, the subjects without a ladder follow
(Deutsch also lists the Bibliothek; Bildnerisches Gestalten, Bewegung und Sport, Musik), each with this week's visits,
e.g. "Bildnerisches Gestalten: Malen ×2". *(My call: so the number really opens into the subjects; codes need a display
name per Fachbereich.)*

"Diese Woche" is the last seven calendar days (today and the six before), not the logbook's last seven days with
activity; after a quiet fortnight it is empty. Grouped by the nine Zugänge: every Zugang is listed, with the buildings
visited (and how often), or "–" with "noch kein Haus" when no building is tagged with it yet. Zugänge 4 and 9 are left
out of the list for now: walking the town, Mein Haus and the shops aren't logged as visits, and logging them would
change the stickers. *(My call.)*

## Tags

A data file in the app (not on the server) gives each building its Lehrplan codes (Fachbereich, e.g. `MA.1.A.2`) and
its Zugänge (1–9). First draft:

| Building | Codes | Zugänge |
|---|---|---|
| School | MA.1.A.2, MA.1.A.3 | 5, 8 |
| Schreiben | D.4 | 8, 1 |
| Bibliothek | D.1, D.6 | 8 |
| Unterschiede | – | 2 |
| Arcade (memory) | – | 2 |
| Farblabor | BG | 6, 5 |
| Malen, Ausmalen | BG | 6 |
| Yoga, Hüpfhalle | BS | 1 |
| Tanzsaal | BS, MU | 1 |
| Schlange, Bonbonjagd, Flatterflug, Kino | – | – (play) |
| Mein Haus, shops | – | 9 |

The nine Zugänge: 1 Körper, Gesundheit und Motorik · 2 Wahrnehmung · 3 Zeitliche Orientierung · 4 Räumliche
Orientierung · 5 Zusammenhänge und Gesetzmässigkeiten · 6 Fantasie und Kreativität · 7 Lernen und Reflexion ·
8 Sprache und Kommunikation · 9 Eigenständigkeit und soziales Handeln.

Walking the town (Zugang 4) and Mein Haus and the shops (Zugang 9) aren't logged, so they aren't shown in "Diese
Woche"; position words (#37) will bring Zugang 4 in.

## Storage and sync

The server keeps each child's two ladders (step, and the recent first-try results that decide a move up), following
Schreiben's letters (`backend/app/writing.py`): the server is the truth, the page keeps the same rules
(a shared TypeScript module, like `src/core/writing/levels.ts`) to go on while the server is away, and each visit's
result is sent with a key so a resend is applied once. A parent's change goes to the server directly.

The School asks at the steps the device knows when the visit starts.

## Left to the builder

- The exact task generators per step, the "Blitzblick" timing, how tens bars look, the step descriptions' wording.
- The table and endpoint names, and whether the ladder result rides on the School's visit or has its own call.
- How the section looks beyond the sketch.
