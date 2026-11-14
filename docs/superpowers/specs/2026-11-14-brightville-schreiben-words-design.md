# Brightville – Schreiben: Her Words, Her Sentences, Letters She Knows

Nov 14, 2026 · Andreas Frank

Lines marked **(call)** are decisions made by Claude, not by Andreas. Everything else comes from Andreas or from earlier stages.

## Intent

She loves writing her own name and her friends' names, and she wants to learn to write them little notes: short sentences of several words (Andreas). Spielzeugkiste (`../kids-games`, `SchreibenMenu.vue`, `SchreibenGame.vue`, `services/wordList.js`) had name writing; Brightville's Schreiben only has two random letters a visit. This brings the words back, grows them into short sentences, and makes the random letters serve them: the game keeps track of how well she knows each letter, gives more or less help accordingly, and brings in only one or two new letters a day.

## Goals

- **Her own list of words and sentences**, written by the parents, one list per child, kept on the server (the same on the iPad and the laptop). Edited on the parents' page.
- **Choosing in the Schreibhaus**: her words and sentences as big cards, plus a 🎲 card for today's letters (the existing random round, improved below).
- **Writing a word or sentence letter by letter**, as in Spielzeugkiste: each finished letter appears in a row along the top in her own handwriting, with a gap between words; at the end she sees the whole sentence in her handwriting.
- **A level per letter and child** that decides how much help she gets, wherever the letter is written (🎲 round or a word).
- **One or two new letters a day**, introduced in the 🎲 round, preferring letters from her own words.
- **The parents see the levels**: the alphabet as a grid on the parents' page, coloured by level.

## Non-goals

- Lowercase letters and punctuation. Capitals (A–Z, Ä, Ö, Ü), digits and spaces only. Lowercase comes later, as its own step, once she knows the capitals well; even then capitals stay first for a new learner (Andreas).
- Grading the shape of her writing. The tracer keeps her on the path; we only measure how smoothly she wrote.
- The child adding words herself; parents editing on her device inside Schreiben **(call: the parents' page is the only place; a ⚙️ in the Schreibhaus would need its own parent gate)**.
- Sending the note to the friend, printing, or keeping written sentences as pictures after the visit **(call)**.
- Parents setting levels by hand or resetting them **(call; possible later)**.

## Anti-goals

- Her own name locked away because it has letters she hasn't "learned" yet.
- Help taken away so fast she gets stuck and frustrated, or a letter dropping back after a single slip (hence three in a row, both ways).
- A flood of new letters in one day.
- Anything she has to read: cards and instructions are spoken.

## Constraints

- Everything from earlier stages holds: German voice, English code, no CDN, the server is the truth for Stars, the 🔊 and leave buttons, touch-only door, layout fit at 1024×768 (touch) and 1440×900.
- Schreiben stays an earning building: `shared/buildings.json` `maxStars` 10, `minSecondsPerStar` 1.5. The server caps a visit at 10.
- New tables only through a new step in `MIGRATIONS`.
- Glyphs come from `src/core/writing/basisschrift.json`; tracing rules from `tracing.ts` stay as they are.
- Offline: like the other stores (wardrobe, room), a change waits in the browser and is sent later; the visit itself keeps working without the server.

## The letter levels

Each child has, for every glyph (letters and digits), a level and a streak:

| Level | Help on the board |
|---|---|
| new | not introduced yet; in a word: the full letter (see below) |
| 1 | the full path with arrows (today's `full`) |
| 2 | dots along the path (today's `dots`) |
| 3 | only the green start dot (today's `start`) |
| known | only the writing lines, no help (a new `Help` value) |

- **Clean or bumpy.** A write is *bumpy* if, while writing that letter, she touched the letter away from the start dot (`wrong-end` or `far-from-start`), or lifted early after drawing a real part of a stroke (`too-short` with progress ≥ `SMALL_TRY`). Taps beside the letter, a resting hand and tiny taps don't count. Otherwise it is *clean*.
- **Three in a row, both ways (Andreas).** Three clean writes in a row at the letter's level move it up one level; three bumpy writes in a row move it down one. A write of the other kind resets the streak. Level 1 is the floor once introduced; known is the top.
- **Known, without a dot.** With no help shown she has to know where to start. Any touch at the known level that isn't accepted and isn't a resting hand (`wrong-end`, `far-from-start` and also `off-letter`, since nothing is drawn) makes the green start dot appear for the rest of that letter, with the spoken hint "Fang beim grünen Punkt an.", and the write counts as bumpy **(call)**. Tiny taps don't count, as elsewhere.
- Only writes shown at the letter's own level count. The introduction writes (below) and writes of not-yet-introduced letters in words don't move levels.

## The 🎲 round (today's letters)

Still two glyphs, each written three times, 1 Star per write and +4 for all six (10 in all), as today.

- **New letters: at most two a day per child** (server date, `clock.today()`). A new glyph is written three times with falling help (full, dots, start), exactly as the current round does. **It counts as introduced only when all three writes are done** (then it is at level 1 and uses up one of today's two) **(call)**. If she leaves before that, it stays new, uses up nothing, and comes first again on her next 🎲 visit. The client reports a finished introduction; the server records it and refuses a third that day.
- **Pacing (Andreas).** Normally two new letters a day; only one while she has three or more letters at level 1; none while she has five or more at level 1 (the round then practises those). The server applies the same rule when it records an introduction.
- **Which new letters**: first those that appear in her words and sentences, in the order they first appear in her list **(call)**; then the remaining letters, then digits, at random **(call)**.
- **The other places** in the round go to her weakest introduced letters: lowest level first, then the longest unpractised **(call)**. Those are written three times at their own level.
- When the two new letters for today are used up (a second 🎲 visit the same day), both glyphs are repeats. When every glyph is introduced, every round is repeats of the weakest.

## Writing a word or sentence

- **The menu.** Entering the Schreibhaus shows her list as big cards, in the parents' order, and a 🎲 card. The welcome is spoken. Tapping a card starts it and the voice says what she'll write ("Wir schreiben: Ich mag dich, Lena!"). The text is spoken in normal case **(call: spoken as lowercase with a capital first letter, so the voice doesn't spell "ICH" as letters)**. With no words in her list the menu is skipped and the 🎲 round starts at once, as today.
- **On the board.** One letter at a time, all letters of the text at one size (`viewBox` over the whole text), help per letter from her levels. Letters not yet introduced show the full letter.
- **The row along the top.** One slot per letter; spaces are gaps. Finished slots show her ink (Spielzeugkiste's `InkThumb`); the current slot is highlighted. A long sentence wraps onto a second row **(call)**.
- **Voice.** Before each letter: "Jetzt ein L." At a new word: "Jetzt das Wort Lena." **(call)**. At the end: the cheer, confetti, and the whole text spoken.
- **Stars.** 1 per letter written, +4 for finishing the whole text, capped at 10 by the server **(call: the same rule as the 🎲 round, so short names pay as well as long sentences)**. Leaving early pays for the letters written.
- **Every letter written in a word updates its level** (if introduced), as above.

## The list on the parents' page

- In each child's card, a section **Schreiben** with her words and sentences: add (text field), remove, move up/down **(call)**.
- Allowed: capitals, Ä Ö Ü, digits and single spaces. Text typed in lowercase is turned to capitals; ß is refused **(call: no glyph for it)**. Leading/trailing spaces trimmed, double spaces collapsed. At most 30 characters a text **(call)**, at most 20 texts a child **(call)**, no duplicates. A refused text says why in plain German.
- New children start with an empty list **(call)**. Andreas fills in names (MIA, LENA …).
- **The letter grid.** Below the list: A–Z, Ä Ö Ü and 0–9 as small tiles coloured by level (grey new, then four steps to green known), with a short legend.

## Server

- Two tables per child: the words (person, position, text) and the letter levels (person, glyph, level, streak, last practised, introduced on).
- The parent reads and writes a child's list (`auth.parent`); a child reads her own list and levels.
- The child's page sends each counted write as it happens (glyph, clean or bumpy, the level shown), through an outbox, so levels survive a dropped connection and a reload. The server applies the three-in-a-row rule; it is the truth for levels **(call)**. Writes are idempotent by key, like visits.
- The daily new-letter limit is enforced by the server: it records finished introductions and refuses a third the same day; the round learns from the levels how many are left today.
- Offline (no server): the round still runs from the levels it last knew; new letters may be introduced locally and are reported later. If the server later refuses (third new letter that day), it just doesn't record that introduction.

## Left to the builder

- Exact layout of the menu cards and the top row, card sizes for long sentences.
- API shapes and table names, the migration step, store structure.
- How the 🎲 round fetches levels on entering (the building waits briefly for its store, as the shops do).
- README and roadmap updates.
