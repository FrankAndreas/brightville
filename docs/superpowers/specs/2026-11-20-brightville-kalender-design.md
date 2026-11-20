# Brightville – Kalender: Time of Day, the Week, the Seasons and the Clock (Design)

Nov 20, 2026. Issue #36. Builds on the Lehrplan 21 ladders (#32, #33) and follows the Reimhaus (#34) and the
Musterwerkstatt (#35) in shape: the same ladder machinery, the same kind of flow and screen, the same lessons from
their reviews (lit reset per run, 🔊 stops naming and forgets a solved question, whole German sentences).

## Intent

A new learning building where she finds her way in time: what comes first in a day, morning, noon and evening, the
days of the week, yesterday and tomorrow, the seasons, and later the full and half hours on a clock. The Lehrplan has
this as Zugang 3 (Zeitliche Orientierung), today the one Zugang the parents' page shows as "noch kein Haus", and
under Mathematik as time, a quantity (MA.3).

It is new to her (the parent's answer): the building shows before it asks. Everything is said aloud; every answer is
a picture, a drawn sun or clock, or a coloured day card whose name is said. Nothing to read.

**"Heute" is the real day** (the parent's choice): on a Thursday the Kalender says "Heute ist Donnerstag", from the
device's date, and "Welche Jahreszeit ist jetzt?" has the real season as its answer.

## Goals

- A building, the **Kalender**, earning Stars like the others (five tasks, at most 10 Stars).
- A fifth Lehrplan ladder, **Zeit**, with five steps and "fertig", moving up by itself and set by a parent.
- The parents' overview shows it under Mathematik, the overall number counts it, and Zugang 3 gets its house.

## Non-goals

- Reading the clock to the minute, quarter hours, digital times. Full and half hours only.
- Dates and months by name.
- Stepping down by itself.

## Anti-goals

- A buzz or anything that feels like failing (as in every learning building).
- A day card she has to read: every card's day is said as it lights up, and the cards keep fixed colours.
- A routine that isn't hers on a given day as the only truth: the day's order uses things every child does
  (aufstehen, frühstücken, Mittagessen, schlafen), not "Kindergarten" on a Saturday. *(My call: on a weekend the real
  day doesn't change what the order of a day asks.)*

## The ladder: Zeit

| Step | Asks | Answer |
|---|---|---|
| 1 | The order of a day: four pictures shuffled ("Was machst du zuerst?") | she taps them in order; each right tap moves the picture into a row of four places |
| 2 | Morning, noon, evening, night: "Wann frühstückst du?", "Wann scheint der Mond?" — only questions with one clear answer (not "Wann gehst du schlafen?", which is Abend or Nacht) | four drawn buttons: sun low on the left (Morgen), sun high (Mittag), sun setting (Abend), moon (Nacht) |
| 3 | The days of the week: "Was kommt nach Montag?", "Was kommt vor Freitag?" | three day cards, each named as it lights up; a strip of the whole week above, today marked |
| 4 | Yesterday, today, tomorrow from the real day: "Heute ist Donnerstag. Was war gestern?"; the seasons: "Wann fällt Schnee?", "Welche Jahreszeit ist jetzt?" | three day cards; or four season pictures (🌷 Frühling, ☀️ Sommer, 🍂 Herbst, ⛄ Winter) |
| 5 | The clock: "Wo ist es drei Uhr?", "Wo ist es halb vier?" (= 3:30) | three drawn clocks: the right one, one with the hands swapped or the hour off by one, one full/half mixed up |
| 6 | "fertig": a mix of steps 2–5 | |

**Questions with one answer only** (after the builder check): every question has exactly one right answer; a
question two answers fit for a child is left out, not scored.

Step 4 asks two day questions and three season questions or the other way round; step 5 asks three clock questions
and two of step 4's kind; "fertig" one of each of steps 2–5 and one more clock. *(My call, the builder may tune it.)*

**The order of a day (step 1):** sets of four from everyday things with one obvious picture: aufstehen 🛏️,
anziehen 👕, frühstücken 🥣, Zähne putzen 🪥, Mittagessen 🍝, spielen 🧸, Abendessen 🍲, baden 🛁, schlafen 🌙. A set
is four in their real order (e.g. aufstehen, frühstücken, Mittagessen, schlafen). A wrong tap: that picture wiggles,
"Hmm, was machst du davor?", and she tries again; the task counts as missed on the first try. When all four are in a
row, the voice says the whole order: "Zuerst aufstehen, dann frühstücken, dann Mittagessen, dann schlafen."

**Day cards:** seven fixed colours (Montag … Sonntag), the same in the strip and the answers, so she can learn them by
colour too. Today's card in the strip has a little sun. The answer cards are named in turn as they light up, as in
the Reimhaus.

**Clocks:** drawn, a round face with 12 dots (no numbers needed, but numbers 12, 3, 6, 9 may be shown as a help), a
short thick hour hand and a long thin minute hand. "halb vier" is 3:30 (German); the hour hand stands between 3 and 4.

**Moving up:** as the others: of her last 10 answers at the step, at most 2 missed on the first try. Parents can set
the step (1–5 or "fertig"), which empties the window. Start step 1.

## Showing before asking

While the step's window holds fewer than 10 answers (steps 1–5; none at "fertig"), one example first, with nothing to
tap:

- Step 1: "Schau: zuerst stehst du auf, dann frühstückst du, dann isst du zu Mittag, und am Abend gehst du schlafen."
  The four pictures move into their row one after the other.
- Step 2: "Am Morgen geht die Sonne auf. Am Mittag steht sie hoch oben. Am Abend geht sie unter. In der Nacht scheint
  der Mond." Each button lights up.
- Step 3: the week said once, each card in the strip lighting up: "Montag, Dienstag, … Sonntag."
- Step 4: "Heute ist Donnerstag. Gestern war Mittwoch. Morgen ist Freitag." The three cards light up.
- Step 5: "Der kurze Zeiger zeigt die Stunde. Steht der lange Zeiger oben, ist es genau drei Uhr." The clock shows
  3:00, then "Steht der lange Zeiger unten, ist es halb vier" and it shows 3:30.

🔊 repeats the instruction of the moment.

## Tasks of a visit

Five tasks at the step; never the same question twice in a visit; the right answer in different places. Stars: one
per solved task and 5 for finishing, 10 at most. `minSecondsPerStar` 2.

The real day is read once when the visit starts (a visit over midnight keeps its "heute"). The season from the
device's date by months: Frühling March–May, Sommer June–August, Herbst September–November, Winter December–February.

## The building in the town

- Id `kalender`, spoken name "Kalender", sign icon 🗓️, kind `earn`, needs nothing.
- No free lot is left: one of the plain scenery houses (`SCENERY_HOUSES` in `src/city/map.ts`) becomes the Kalender.
  The builder picks one on a street near the other learning buildings whose spot fits a building's footprint (the
  map and nature tests decide), removes it from the scenery list and puts the door at its spot. First choice: the one
  at (3.5, −24), next to the Bibliothek and across from the School.
- Its own colour pair.

## Server and app

- `zeit` becomes the fifth ladder: window 10, misses 2, start step 1. The server's results model gets the field; the
  app's code already loops over the ladder list.

## Parents' overview

- Under **Mathematik**: a row "Zeit — Stufe n von 5 „…“ [Stufe ändern]".
- Step texts: 1 „Tagesablauf ordnen“, 2 „Morgen, Mittag, Abend, Nacht“, 3 „Wochentage“, 4 „gestern, morgen,
  Jahreszeiten“, 5 „volle und halbe Stunden“, fertig.
- **The overall number** becomes the average of six shares.
- **End of Kindergarten:** Zeit's target is step 5 reached (80 %): the day, the week, yesterday/tomorrow and the
  seasons (steps 1–4) are Kindergarten; the clock (step 5) is 1st grade. The mark becomes
  (40 + 40 + 100 + 60 + 80 + 0) / 6 = 53 %. *(My call, settled after the builder check.)*
- Tags: `kalender` gets codes `MA.3` and Zugang 3 (and 8, Sprache: the words for time).

## Left to the builder

- The exact question lists, the drawings (suns, clocks, cards), timings.
- The flow/screen split as in `src/buildings/muster/`.
- Fitting 1180×820, 1024×768, 768×1024.

## Also in this PR

- `docs/roadmap.md`: item 15; the calls above. README: the Kalender row and section; the parents' paragraph.
