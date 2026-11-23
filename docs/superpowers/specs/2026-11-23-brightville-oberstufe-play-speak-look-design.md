# Brightville for the Oberstufe, piece 5: play buildings, speaking, his own look

## Why

Pieces 1–4 (PRs #67–#73) gave the older son (3. Oberstufe) ten buildings for English and French. The aim stays:
**motivate him for English and French**. Piece 5 adds what was put off at the start:

- **Play buildings:** he earns Stars but can spend them almost nowhere; the five play buildings say "Bald" for him.
  Opening them gives a reason to earn, and two of them can carry language too.
- **Speaking:** everything so far trains reading, listening and writing; saying words and sentences aloud is missing.
- **His own look:** his character and the Kleiderladen are made for his younger sister (ponytails, crowns, fairy wings).

## Goals

Built as **three PRs from this design**, in this order:

1. **Play buildings:** Schlange, Bonbonjagd and Flatterflug open as they are; the Spielhalle becomes a word memory in
   English or French; the Kino gets a film list of his own.
2. **Speaking:** the Trommelhaus at Oberstufe: he hears or reads a word or sentence and says it; the browser recognises
   it.
3. **His look:** new hair styles and glasses, and a Kleiderladen range of his own.

## Non-goals

- A new character figure, faces, animations.
- Translating the play games' own few spoken lines (they are games, not lessons): they stay German.
- Pronunciation scoring beyond "the recogniser understood the right words".

## Anti-goals

- **Mixing languages** in what is taught (as before): a memory round, a speaking round, a shop label is one language
  plus German.
- Anything changing for the Kindergarten child: her play buildings, her Kino films, her Trommelhaus (rhythm), her
  looks and her shop range stay as they are.
- Childish things for him: her crowns, fairy wings, ballet dress, unicorn hat must not be offered to him.
- His voice going anywhere the parents didn't choose: it goes to the browser's recogniser (Apple on the iPad,
  Google in Chrome), which the parents accepted **for now** (no switch on the parents' page in this piece); it must be
  easy to swap for a dedicated service later.

## Approaches considered

- **Oberstufe sides of the existing buildings (chosen)**, as in pieces 1–4: `"oberstufe"` entries in
  `shared/buildings.json`, the language screen, the shared results store and Stars rules.
- New buildings for speaking or for his shop: against "the same buildings".
- Speaking without recognition ("listen, record yourself, compare"): keeps the voice on the device, but the game can't
  tell him whether he said it right. The parents chose recognition by Apple/Google for now.

## 1. Play buildings

- **Doors:** `arcade`, `schlange`, `bonbonjagd`, `kino`, `flatterflug` get `"oberstufe"` entries (cost as now: 3 Stars;
  needs as now). The rules for play are the same as for her: open after the day's learning, the play time the parents
  set, a game costs 3 Stars.
- **🐍 Schlange, 🍬 Bonbonjagd, 🪽 Flatterflug:** the same games, their German lines unchanged (no Oberstufe component).
- **🃏 Spielhalle: word memory.** He picks the language, then a round of memory with **6 pairs**: each pair is a word in
  the language and its German, both written on the cards (no pictures, no animal names). The words come from his own
  lists and the built-in topics, words he has met in the School first (box ≥ 1), else new ones. Turning a card speaks it
  in its own language (German cards in the German voice, foreign ones in the language's voice when the device has one).
  A pair found **at the first try** (neither of its cards was turned before in a turn that missed) counts as a right
  answer in his vocabulary record **only for a word that is due today** (box ≥ 1, due ≤ today), exactly as a School
  answer would; once answered it isn't due any more, so a word moves at most once a day and never past its schedule.
  Words not due, and pairs needing more tries, change nothing.
- **🎬 Kino: his own list.** The parents' films get a level: Kindergarten (her list, as now) or Oberstufe (his). On the
  parents' page the film list has a switch "Kindergarten / Oberstufe"; each list up to 30 films, as now. At the door a
  child sees the films of their level; with no films for his level the door stays crossed out (as now with none at all).
  Existing films stay Kindergarten. The same film may be on both lists (a film is unique per level, not overall).

## 2. Speaking: 🥁 the Trommelhaus at Oberstufe

- **Door:** `trommelhaus` gets an `"oberstufe"` entry (maxStars 15) with the need **`speech`**: the browser can
  recognise speech and there is a microphone. Without it the door is crossed out ("unavailable"), as a camera building
  without a camera.
- **A visit:** he picks the language (`LanguagePick`; a language without a recogniser voice of its own still works:
  recognition and voice are separate), then a round of **10**:
  - **Nachsprechen:** the word or sentence is spoken (when there is a voice) and written; he presses 🎤 and says it.
  - **Übersetzen:** the German is written; he presses 🎤 and says it in the language. Only for words he knows well
    (vocabulary box ≥ 3); never for sentences.
  - About half of each, as far as there are well-known words; a round always has at least 3 sentences.
- **What he says:** words from his lists and the built-in topics (their first answer), and **everyday sentences**: a fixed
  list per language in `shared/speak/<lang>.json`, 12 topics like the word lists × 5 short sentences (60 per language),
  first drafts by Claude ("How are you?", "Je voudrais un croissant, s'il vous plaît.").
- **The check:** what the recogniser heard against the expected words: case, punctuation, apostrophes and spaces don't
  matter, accents don't either (the recogniser writes them, he doesn't); numbers written as figures count as their words
  ("2" = "two"); English "to" before a verb may be left out, as in the School. Every alternative the recogniser offers
  is tried.
- **Tries:** right → Star and on; not right → "Gehört: …" (what was heard) and he tries again, up to **3 tries**; after
  the third the right form is shown, spoken, and the round goes on (no Star). Nothing heard (silence, an error) doesn't
  count as a try.
- **Stars:** +1 per item right within 3 tries, +5 for 10/10 (cap 15).
- **Record:** per child and item a speaking key (`<lang>:speak:<word key>` or `<lang>:speak:sentence:<topic>:<id>`):
  times said right; sent and counted as the other results. Parents' "Sprachen" per language: **"N Sätze und Wörter
  gesprochen"** (items said right at least once).
- **The recogniser** sits behind one small interface (`recognise(lang, timeout) → alternatives[]`) so a dedicated
  service can replace the browser's later.

```
┌──────────────────────────────────────────┐
│  🥁 🇬🇧 Nachsprechen         ⭐⭐○○○○○○○○ │
│        How are you today?   🔊           │
│               [ 🎤 ]                     │
│   Gehört: "how are you to day"  ✗        │
│        Nochmal versuchen (2 von 3)       │
└──────────────────────────────────────────┘
```

## 3. His look

- **Looks** (server `LOOK_OPTIONS` and `src/core/look.ts`): new hair styles **short** and **messy**, new glasses
  **sunglasses** and **square** — for every child (her choice grows a little, nothing of hers goes).
- **Kleiderladen at Oberstufe:** his own range, each outfit marked with a level in `shared/outfits.json`
  (`"level": "oberstufe"`; items without it are hers). His range is **his own items with their own ids**, about 10 over
  the four places: head: cap, beanie, headphones; neck: scarf, sports medal; body: hoodie, football shirt (Swiss red
  and white), jacket; back: backpack, skateboard, guitar. A shape may reuse one of hers in the code (his cap can look
  like her cap), but the item is his. All are for sale, the medal too. Prices like hers; the once-a-day purchase as
  now. What he already owns from her range stays his and can still be worn. At Oberstufe the shop shows
  only his range (and what he already owns); her items are not offered to him. Gifts from stickers stay as they are.
- Each item is labelled in the shop in his last picked language ("Hoodie" / "le sweat à capuche"), German underneath;
  without a picked language, English.
- The items are 3D pieces on the character (`src/city/dress.ts`), drawn in the same simple style as hers.

## Calls made in writing this down (Claude's, for the parents to check)

- Memory: 6 pairs, word ↔ German; a pair found at the first try counts only for a word due today (as a School answer).
- Kino: one switch for the level per film; existing films stay hers.
- Speaking: 10 per round, 3 tries, at least 3 sentences, Übersetzen only from box 3; accents and numbers forgiven.
- 60 everyday sentences per language.
- The new looks for every child; his shop range of about 10 items of his own (the medal for sale).
- The same film may be on both levels' lists.
- No on/off switch for speech recognition on the parents' page in this piece.

## Left to the builder

Screen layouts (the existing buildings are the model), file names, the exact sentences and item names, the 3D shapes,
the recogniser's timeout, how "Gehört" shows several alternatives.
