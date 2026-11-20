# Brightville – Reimhaus: Rhymes, First Sounds and Syllables (Design)

Nov 20, 2026. Issue #34. Builds on the Lehrplan 21 ladders (#32, #33, PR #41).

## Intent

A new learning building where she learns to *hear* words: what rhymes, which sound a word starts with, and how many
syllables it has. This is phonologische Bewusstheit, a core Kindergarten goal of the Lehrplan 21 (Deutsch, D.1.A.1:
Laute und Silben wahrnehmen, identifizieren und vergleichen) and the ground reading is built on later.

It is new to her: the building shows before it asks. Everything is spoken; there is nothing to read. Every word has a
picture.

## Goals

- A building, the **Reimhaus**, on an empty lot, earning Stars like the School (five tasks, at most 10 Stars).
- A third Lehrplan ladder, **Reimen**, with five steps and "fertig", moving up by itself and set by a parent.
- The parents' overview shows the ladder under Deutsch, and the overall number counts it.

## Non-goals

- Reading or written words. No letters on screen.
- Clapping in front of the camera (the parent chose a drum on the screen).
- Single sounds spoken alone ("Sss"): the browser's voice says letter names, not sounds. First sounds are compared
  through whole words.
- Stepping down by itself.

## Anti-goals

- A buzz, a red cross or anything that feels like failing. A wrong answer is said again and tried again, as in the
  School.
- A task she can't make sense of because she has never heard of rhyming: every step is shown first.
- A picture that could mean two words (a picture of a cat that she calls "Büsi"): only pictures with one obvious
  Standard German word.

## The ladder: Reimen (D.1.A.1)

All five tasks of a visit are at her step.

| Step | Asks | Shown on screen |
|---|---|---|
| 1 | "Was reimt sich auf *Maus*?" — two pictures, one rhymes | the word's picture, two answer pictures |
| 2 | the same with three pictures, one rhymes | the word's picture, three answer pictures |
| 3 | "Was fängt an wie *Sonne*?" — three pictures, one starts with the same sound | the word's picture, three answer pictures |
| 4 | "Wie viele Silben hat *Auto*?" — words of 1–3 syllables; she taps the drum once per syllable | one picture, the drum |
| 5 | the same with words of 1–4 syllables, and first sounds mixed in (two of five tasks) | as 3 and 4 |
| 6 | "fertig": a mix of steps 2, 3 and 5 | |

**Moving up:** of her last 10 answered tasks at the step (two visits), at most 2 missed on the first try. Until she has
10 answers at a step, it doesn't move. The window counts back from her latest, across visits; a visit left early adds
the tasks she answered. After a move up, the window starts empty. A parent can set the step (1–5 or "fertig") on the
parents' page, which empties the window. (Agreed with the parent: two visits, 2 misses in 10.)

**Where a child starts:** step 1. There is no old version of this building to start anyone higher.

## Showing before asking

At the start of a visit at steps 1–5, while the step's window holds fewer than 10 answers (she hasn't done two visits
at this step yet), the voice shows one example of the step's own kind before the first task (step 5: a four-syllable
word), with its pictures on screen and nothing to tap. "Fertig" shows none. *(My call after the builder check: at
"fertig" the window is always empty, so the rule would otherwise show an example forever.)*

- Rhymes: "Maus – Haus. Hör mal: Maus, Haus. Das klingt am Ende gleich. Das reimt sich!"
- First sounds: "Sonne – Sofa. Sonne, Sofa: die fangen gleich an!"
- Syllables: "Ba-na-ne. Hör mal: Ba – na – ne. Drei Silben. Ich trommle mit: bum, bum, bum." The drum lights up
  three times as it's said.

A 🔊 button repeats the current instruction, as in every building.

## The syllable drum

- A big drum under the word's picture. Each tap: a drum sound, and a dot appears in a row under the picture.
- A ✓ button, shown after the first tap, says she is done. A ↺ next to it clears the dots.
- Right: the voice says the word in syllables ("Au – to"), the drum lights up once per syllable, a cheer.
- Wrong: "Hör nochmal gut zu: Au – to", the drum lights up once per syllable, the dots clear, and she tries again.
  Missed on the first try counts as missed.

## Answering a picture task

- When a task is asked, the voice names every answer picture in turn, each lighting up as it is said ("Maus. Haus,
  Ball."), so she knows what each picture is called before she answers. The 🔊 button says it all again.
- A tap on a picture is her answer. *(My call after the builder check: a tap that only names the word would make
  "first try" unclear; naming them all at the start keeps one tap = one answer.)*
- Right: a chime, a cheer, the two words said together ("Maus – Haus!").
- Wrong: the picture fades, the voice says the asked word and the tapped one ("Maus … Ball. Hör nochmal gut zu."),
  and she tries again with what's left. As in the School, the visit's task ends only when it is right.

## The words

A word list in the app (`src/core/rhymes.ts` or a JSON file next to it), each word with its picture (an emoji that
looks the same on iPadOS), its syllables and its rhyme group. First draft, to be checked by the builder that each
emoji exists and reads clearly:

- **Rhyme groups:** at least 12 groups of two or more true rhymes with clear pictures, e.g. Maus, Haus, Laus ·
  Hose, Rose, Dose · Hand, Sand · Kuh, Schuh · Bär, Meer · Fisch, Tisch (only if an emoji reads clearly as a table).
- **First sounds:** at least three words per sound, e.g. Sonne, Sofa, Socke · Maus, Mond, Möhre · Ball, Banane,
  Bär · Fisch, Frosch, Feder. Only sounds that start a word clearly (no Sch/St/Sp mixed with S).
- **Syllables:** at least four words per count, e.g. 1: Ball, Hund, Baum · 2: Auto, Apfel, Hase · 3: Banane,
  Tomate, Elefant · 4: Schokolade, Sonnenblume, Regenbogen, Krankenwagen (the builder checks every count). Syllables are
  stored as written pieces ("Ba", "na", "ne") so the voice can say them apart; a test checks they join to the word.
- Distractors are picked so they share neither the rhyme nor the first sound of the asked word.

## Tasks of a visit

Five tasks at the step, no word asked twice in a visit, no answer picture repeated in the same task. Stars: one per
solved task and 5 for finishing, 10 at most, as the School (`STARS_PER_TASK`, `SET_BONUS`). `minSecondsPerStar` 2.

## The building in the town

- Id `reimhaus`, spoken name "Reimhaus", sign icon 👂, kind `earn`, needs nothing (works with a mouse too).
- Door on the empty lot at (35.5, −16, side right), the last of `EMPTY_LOTS`, which leaves the list's first three
  (the cat's garden at index 0, the dog's at 2) where they are. *(My call after the builder check: the lot at
  (−3.5, −40) is the cat's garden; she keeps it.)*
- The house looks like the other learning buildings (the builder follows how they are dressed).

## Server

The School's ladder machinery becomes the ladders' machinery, with Reimen as a third ladder:

- `school_ladders` gains rows with `ladder = 'reimen'` (no migration needed for the table; a missing row is step 1).
- Each ladder has its own window and misses allowed: Zählen 6/1, Rechnen 4/1, Reimen 10/2.
- `/api/school` returns `reimen` too. `/api/school/results` takes each ladder optionally: the Reimhaus sends only
  `reimen`; the School still sends `zaehlen` and `rechnen`. Results waiting on a device from before (without
  `reimen`) still go through.
- `PUT /api/players/{id}/school` accepts `reimen`.
- The device's waiting results (`src/stores/school.ts`) accept items with any of the three ladders.
- No new sticker for the Reimhaus in this PR.
- *(My call: keep the endpoints' and the store's names (`school`) to avoid churn; a comment says they hold every
  ladder.)*

## Parents' overview

- Under **Deutsch**: a row "Reimen — Stufe n von 5 „…“ [Stufe ändern]" above the letters.
- Step texts: 1 „reimt sich? aus zwei Bildern“, 2 „reimt sich? aus drei Bildern“, 3 „Anlaute: was fängt gleich an“,
  4 „Silben klatschen bis 3“, 5 „Silben bis 4 und Anlaute gemischt“, fertig.
- **The overall number** becomes the average of four shares: Zählen, Rechnen, Reimen and Buchstaben.
- **The end of Kindergarten mark** moves: Reimen's Kindergarten target is "fertig" (100 %), since this is a
  Kindergarten goal, so the mark becomes (40 + 40 + 100 + 0) / 4 = 45 %. *(My call: honest to the Lehrplan; the mark
  jumps from 27 % to 45 %, and every child's number shifts once.)*
- Tags: `reimhaus` gets codes `D.1.A.1` and Zugänge 8 (Sprache) and 2 (Wahrnehmung).

## Left to the builder

- The exact word list (within the rules above), the drum's look and sound, the example scenes' timing.
- How the flow is split between a pure flow module (like `src/buildings/school/flow.ts`) and the screen.
- Fitting the screen at 1180×820, 1024×768 and 768×1024 like the School.

## Also in this PR

- `docs/roadmap.md`: item 13 for the Reimhaus; "Harder tasks as she grows" marked done for the School and the
  Reimhaus.
- README: the Reimhaus row and the parents' paragraph.
