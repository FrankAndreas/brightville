# Brightville for the Oberstufe, piece 1: the level and the vocabulary trainer

## Why

The older son (3. Oberstufe, 9th grade, Lehrplan 21 Zyklus 3) gets Brightville too: the same town and the same
buildings, with content for his age. The main aim is to **motivate him for languages, English and French**. The
first piece has to be enough for him to start and to show whether it motivates him: the School becomes a vocabulary
trainer that practises **the words of his current school unit** (what his next test asks), with built-in lists for
when he has none.

The whole Oberstufe plan, in pieces with their own design and PR each:

1. **This design:** a level per child, the School as vocabulary trainer, his lists, built-in lists.
2. Schreiben (dictation) and Reimhaus (listening).
3. Musterwerkstatt (grammar), Bibliothek (reading), Kalender (dates and times).
4. Spielwelt and the movement buildings with an English or French coach.
5. Later: speaking (Trommelhaus), his own character, the play buildings.

## Goals

- A parent sets each child's level: **Kindergarten** (as today) or **Oberstufe**.
- At Oberstufe, the School is a vocabulary trainer for English or French, with his own lists and built-in lists.
- Words he gets wrong come back sooner, words he knows come back less and less often (spaced repetition), across
  days and devices.
- Parents see per language how far he is and what lists he has.

## Non-goals (for this piece)

- Any other building's Oberstufe content; the character's look; the play buildings; speaking.
- Parents editing his lists (they only see them); importing lists from a photo or a file.
- Changing the town, the map or the bicycle beyond the doors' new "Bald" sign.

## Anti-goals (a failure even if it works)

- **Mixing languages.** A list, a round, a choice of answers and the voice are always one language (English or
  French) plus German. Never English and French together.
- Anything changing for the younger child: at Kindergarten level everything stays exactly as it is.
- Treating him like a five-year-old inside the trainer: no spoken German instructions, no picture-only screens.
- Making a wrong answer feel like a punishment: show the right word, let him type it, move on.

## Approaches considered

- **A. One game, two levels (chosen).** A level per child; each building shows the content of the child's level.
  One town, one server, one login, one deploy; fixes to the town reach both. Cost: buildings get two sides.
- B. A copy of the game for him: fast to start, then every fix twice and the copies drift apart.
- C. New language buildings on the districts' empty lots: not "the same buildings", only five lots, and his brother
  would see them.

For the words: his school lists **and** built-in lists (chosen, "3"), rather than only his lists (needs typing every
unit, nothing when there is no list) or only a built-in course (beside school rather than for it, feels like extra
homework).

## The level

- `players.level`: `'kindergarten'` (default, every existing child) or `'oberstufe'`. Set on the parents' page, on
  each child's card, next to the daily goal (`PUT /api/players/{id}` takes it). `/api/state` returns it, so the game
  knows it at start.
- At Oberstufe the game uses **written German** in what is new (the trainer, its lists, the doors' "Bald"); the
  town's existing voice lines (the map, "Wir fahren zur Schule!", the help) stay as they are for now.

## The doors at Oberstufe

| Building | At Oberstufe |
|---|---|
| 🔢 School | open: the vocabulary trainer |
| 🖌️ Malen, 🏠 Mein Haus | open, as today |
| 👗 Kleiderladen, 🛋️ Möbelhaus | as today (after the day's learning); his only way to spend Stars for now |
| every other building (learning, moving, play, Ausmalen, Kino) | closed with a new door state **`soon`**: a "Bald" sign at the door and on the map; he can't go in |

His daily goal (default 2) then counts School visits, without any change to how the goal works. A building gets its
Oberstufe side in a later piece and opens then.

## His lists

- Per language, he has his own lists, each with a name ("Unit 3 – Travel") and up to **60 word pairs**; up to **30
  lists per language**; each side up to **60 characters**.
- He makes and edits them himself, in the School: after choosing the language, a shelf shows his lists and the
  built-in ones; "Neue Liste" opens a name and a big text box. He can paste a whole list: **one pair per line**,
  German first, separated by a tab, ` - `, ` – `, ` = ` or `;` (a tab wins when there are several). Before saving he
  sees the pairs as they will be kept; lines that can't be read are marked and not kept. He can rename, edit and
  delete his lists (deleting asks once).
- **Several right answers** are written with ` / `: `railway station / train station`. The first is the one shown;
  any counts when typed.
- Kept on the server per child (`vocab_lists`, `vocab_words`), so the laptop and the iPad show the same. The page
  works from what it last had while the server is away; changing a list needs the server (a clear message when it is
  away).
- Parents see his lists, read-only, on his card.

## Built-in lists

- In `shared/vocab/en.json` and `shared/vocab/fr.json`: topic lists at about A2, **about 25 words each, about 12
  topics** (travel, school, family, free time, food, jobs, body and health, home, town, weather and nature, shopping,
  feelings). French nouns carry their article (`la gare`), English verbs their `to` (`to travel`).
- Written for this piece (by Claude) as first drafts; the parents can check them. Shown on the shelf with a 📘 and
  can't be edited.

## A School visit

1. He picks **English** or **French** (the last choice is remembered on the device), then a list or **"Alle meine
   Wörter"** (all words of his own lists in that language; shown only when he has some) or a built-in list.
2. A round is **10 words**, chosen like this: words that are due, the longest overdue first; then new words, at most
   **4 new** per round, in the list's order; if that is still fewer than 10, the words due soonest. A source with fewer
   than 10 words makes a shorter round.
3. How a word is asked depends on how well he knows it (its box, below):
   - **New or box 1:** German shown, pick the foreign word from **4 choices** (the others from the same source, else
     from his other words in the same language, never from the other language).
   - **Box 2 and up:** typed, alternating German → foreign and foreign → German.
4. Every foreign word is spoken by an English (`en-GB`) or French (`fr-FR`) voice when it is shown or answered, with a
   🔊 to hear it again. Without such a voice on the device, there is no 🔊 and nothing breaks.
5. **Right** (first try): "Richtig" and the word moves up. **Wrong:** the right answer is shown and spoken, he types
   it once to go on, and the word comes back once at the end of the round (no Star the second time).
6. Typed answers count as right when they match one of the answers ignoring case, spaces around and between words,
   and a final `.`, `!` or `?`; for English verbs the `to` may be left out. **Accents count** (the parents' choice):
   `ecole` for `école` is wrong, like German without its umlauts; the right spelling is shown with the missing or
   wrong accent marked, so he sees it was only the accent. Anything else that differs is wrong too.
   The text field has autocorrect, autocapitalize and the spell check off. For French, a row of buttons under the
   field types the accented letters (`é è ê à â ç ô î û ë ï ù œ`), since not every keyboard has them.
7. At the end: how many he knew, and the Stars.

**Stars:** +1 per word right on the first try, +5 when all words of a 10-word round were right on the first try. The
server allows up to 15 for a School visit by a child at Oberstufe (10 at Kindergarten, as today); the pace rule
(`minSecondsPerStar`) stays.

## Spaced repetition

Per child, per word (`vocab_progress`: child, language, word key, box, due day). Own words are keyed by their id,
built-in ones by `<lang>:<topic>:<id>`. A word edited so that its foreign side changes starts as new.

| Box | Next due after a right answer |
|---|---|
| 0 (new) → 1 | 1 day |
| 1 → 2 | 2 days |
| 2 → 3 | 4 days |
| 3 → 4 | 8 days |
| 4 → 5 | 16 days |
| 5 stays | 32 days |

A wrong answer puts the word back to box 1, due the next day. A word counts as **learned** from box 3. Results are
sent the way the School's ladders are today: each visit with its own key, kept on the device until the server has
it, counted once; the server is the truth.

## For the parents

On his card (at Oberstufe), instead of the Kindergarten "Lehrplan 21" bars: **"Sprachen"**, per language the words
learned, the words due today, and his lists (folded, each with its words). Lehrplan 21 codes for Zyklus 3 come with a
later piece.

## Calls made in writing this down (Claude's, for the parents to check)

- A word wrong again when it comes back at the end of a round: no Star, it stays in box 1.
- "Alle meine Wörter": new words in the order his lists were made, then their order in the list.
- The 15-Star cap for an Oberstufe School visit is checked on the server by the child's level.
- A `soon` door is refused by the server too (an earning, play or free visit to it doesn't count), not only by the
  page.
- Only children have a level; a parent's is ignored.
- The accent buttons for French, and marking the accent when only the accent was wrong.

## Left to the builder

The screens' layout (the sketch below is the idea, not the measure), the names of tables, routes and files, how the
door state `soon` looks, the exact built-in words, and how the offline sending is shared with the ladders.

```
┌──────────────────────────────────────────┐
│  🇬🇧 Unit 3 – Travel        ⭐⭐⭐○○○○○○○   │
│                                          │
│        der Bahnhof              🔊        │
│                                          │
│   [ railway station______ ]   ✔          │
│                                          │
│   ✓ Richtig  –  +1 ⭐                     │
└──────────────────────────────────────────┘
```
