# Brightville for the Oberstufe, piece 2: dictation (Schreiben) and listening (Reimhaus)

## Why

Piece 1 (`2026-11-22-brightville-oberstufe-vocab-design.md`, PR #67) gave the older son (3. Oberstufe) a level and the
School as a vocabulary trainer. The aim stays the same: **motivate him for English and French**. Piece 2 opens two more
buildings for him, each with its own job:

- **✏️ Schreiben: dictation of his words.** He hears a word and types it: spelling, the way his vocabulary tests ask.
- **👂 Reimhaus: listening.** He hears short built-in scenes (a sentence or a tiny dialogue) and answers a question
  about them in German: understanding what he hears.

The parents chose "mixed" (his words for dictation, built-in sentences for listening) over words only (too close to
the School) and sentences only (no practice of his test words).

## Goals

- Schreiben at Oberstufe: a dictation round of his words, with its own spelling record (spaced repetition).
- Reimhaus at Oberstufe: rounds of five listening scenes per language, with a record of which he understood.
- Both open at Oberstufe on any device with an English or French voice (Schreiben no longer needs a touch screen
  there); the parents see the new numbers.

## Non-goals

- Speaking (piece 5), grammar, reading texts, other buildings.
- Sentences he types in himself; scenes from his own words.
- A second voice for dialogues beyond what the device offers (see below).

## Anti-goals

- **Mixing languages**, as in piece 1: a round, its scenes, choices and voice are one language plus German.
- Anything changing for the Kindergarten child: her Schreiben (tracing letters, touch only) and her Reimhaus stay as
  they are.
- A building that opens but can't speak: without a voice for the language, there is nothing to do.

## Approaches considered

- **Oberstufe sides of the existing buildings (chosen)**, as the School got in piece 1: the same `oberstufe` entry
  in `shared/buildings.json`, the same vocabulary store and server progress for spelling (own keys), fixed content
  files for the scenes.
- New buildings per skill: against "the same buildings", and the district lots are meant for NMG and Bee-Bot.
- Listening sentences generated from his words by templates: stiff, often wrong, and the German questions would be
  guesses.

## The doors

- `schreiben` and `reimhaus` get `"oberstufe"` entries in `shared/buildings.json` (maxStars 15 for Schreiben as for
  the School; 10 for the Reimhaus), so the server lets them in and the "Bald" sign goes.
- **Needs per level:** a building's needs can differ at Oberstufe. Schreiben needs `touch` at Kindergarten (as now) and
  `voice` at Oberstufe; the Reimhaus needs nothing at Kindergarten (as now) and `voice` at Oberstufe. `voice` means:
  the device has an English or a French voice. Without one the door is `unavailable` (crossed out, as a camera
  building without a camera).
- Voices load late in some browsers (Safari): the town listens for the voices arriving (`voiceschanged`) and opens the
  doors then.
- Inside, a language without a voice on this device can't be picked (its button is crossed out with "Keine Stimme").

## ✏️ Schreiben at Oberstufe: dictation

1. He picks the language (the last one remembered, as in the School), then a source from the same shelf as the School
   (his lists, "Alle meine Wörter", the built-in topics), **without** "Neue Liste" and the ✏️ buttons: lists are made
   and changed in the School only.
2. A round is **10 words**, chosen by the School's rules (due first, at most 4 new, then due soonest) but on the
   **spelling record**: each word's spelling key is its word key with `spell` added after the language,
   `en:spell:travel:station`, `fr:spell:own:la gare|der bahnhof`. Same boxes and days as in piece 1, kept by the same
   server table and sent the same way (the server already takes any key that starts with the round's language).
3. Each word: the foreign word is spoken (its first answer); 🔊 plays it again, 🐢 plays it slowly (speech rate 0.6).
   Nothing is written on the screen before he answers. He types it; the check is the School's (case, spaces, a final
   full stop don't matter, English "to" may be left out, **accents count**, marked when only they were off); French
   has the accent buttons. An empty answer is ignored.
4. After the answer: the word and its German meaning are shown. Wrong: he types it out once to go on, and it comes
   back once at the end (no Star), as in the School.
5. Stars: +1 per word right on the first try, +5 for a 10-word round without a miss (cap 15).

## 👂 Reimhaus at Oberstufe: listening

### The scenes

- In `shared/listen/en.json` and `shared/listen/fr.json`, by the same 12 topics as the built-in word lists, **6
  scenes per topic** (72 per language), written for this piece (by Claude) as first drafts at about A2, Swiss
  context where it fits (Bern, francs, the train).
- A scene: an id, its text as 1–3 lines (a line may name a speaker, `A:` / `B:`, for a tiny dialogue), a question in
  German, four answers in German (or numbers, times, names), the right one marked. The question asks for something
  said in the scene, not general knowledge; the answers are short.
  - Example (travel, English): "The train to Bern leaves from platform four at ten past eight." — "Von welchem Gleis
    fährt der Zug?" — 2 / **4** / 8 / 10.
- Dialogue lines are spoken one after another with a short pause; when the device has two voices for the language,
  the second speaker uses the second voice, otherwise the same voice with a lower pitch.

### A visit

1. He picks the language, then a topic or **"Gemischt"** (all topics).
2. A round is **5 scenes**: first scenes he has never answered right, then those answered right longest ago, never
   the same scene twice in a round; the four answers are shown in a new order each time.
3. The scene is played once by itself; 🔊 replays it, 🐢 replays it slowly; as often as he likes. The question and the
   four answers are written in German.
4. After the answer (right or wrong): the scene's text is shown, so he can read what he heard, and "Weiter" goes on.
   A wrong answer counts as a miss; the scene does **not** come back in this round (it comes in a later one).
5. Stars: +1 per scene right on the first try, +5 for all five (cap 10, as the Kindergarten Reimhaus).

### The record

Per child and scene (`listen_progress`: child, scene key `<lang>:<topic>:<id>`, right count, last day right or null,
last day asked), sent and counted like the vocabulary results (a key per round, waiting on the device, counted once).

## For the parents

In "Sprachen", per language, two more lines: **"N Wörter richtig geschrieben"** (spelling box 3 and up, over words that
exist now) and **"M von 72 Hörszenen verstanden"** (scenes answered right at least once).

## Calls made in writing this down (Claude's, for the parents to check)

- The spelling record is separate from the School's (a word can be known there and new here).
- 🐢 at speech rate 0.6; 6 scenes per topic; 5 scenes a round; a missed scene doesn't come back in the same round.
- The second speaker of a dialogue: a second voice if there is one, else a lower pitch.
- Schreiben at Oberstufe has 15 Stars at most, the Reimhaus 10.
- Scenes never answered right come in the order least recently asked first (never asked before asked).

## Left to the builder

The screens' layout (the School's trainer is the model), names of files, tables and routes, how the voice check and
`voiceschanged` reach the doors, the exact scenes.

```
┌──────────────────────────────────────────┐
│  👂 🇬🇧 Reisen              ⭐⭐○○○          │
│        🔊 Nochmal     🐢 Langsam          │
│  Von welchem Gleis fährt der Zug?        │
│   [ 2 ]   [ 4 ]   [ 8 ]   [ 10 ]         │
└──────────────────────────────────────────┘
```
