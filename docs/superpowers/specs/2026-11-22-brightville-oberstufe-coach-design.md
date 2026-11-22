# Brightville for the Oberstufe, piece 4: the Spielwelt and the movement buildings with an English or French coach

## Why

Pieces 1–3 (PRs #67–#71) gave the older son (3. Oberstufe) six buildings for English and French: vocabulary, dictation,
listening, grammar, reading, dates and times. The aim stays: **motivate him for English and French**. Piece 4 adds
learning by doing: he hears (and reads) an instruction in the language and acts it out, in the Spielwelt by moving
things, in Yoga, the Hüpfhalle and the Tanzsaal with his body in front of the camera. Words stick better when the body
acts them out, and it is a change from sitting and typing.

The parents' worry and wish: a 14-year-old must not find it childish. The look and the words stay sober (a coach, a
workout, "Simon says"), no animals, no children's songs.

## Goals

- **Spielwelt** at Oberstufe: the position words (on, under, in, next to, in front of, behind, between, left of, right
  of) in English or French, with the existing world, things and tasks.
- **Yoga, Hüpfhalle, Tanzsaal** at Oberstufe: the same movement detection, with instructions in the language:
  - Yoga: a calm session of held poses, each described in words.
  - Hüpfhalle: a workout of counted moves ("Do five jumping jacks!").
  - Tanzsaal: "Simon says" / "Jacques a dit": an instruction without it must not be followed.
- Built in **two PRs**: (1) the Spielwelt, (2) the three camera buildings.

## Non-goals

- New kinds of movement the detection can't see (touching a knee, turning around, lying down).
- Directions for the car ("turn left at the bakery"): the car stays free play.
- A record per child or new lines on the parents' page: these buildings give Stars like the others; the language is
  practised, not tested (see the calls below).
- Speaking (piece 5).

## Anti-goals

- **Mixing languages** (as in pieces 1–3): a visit is one language plus German for the buttons.
- Anything childish in look or words at Oberstufe: no animal names for poses, no children's songs, no "Bravo, toll
  gemacht!" in a child's voice.
- Anything changing for the Kindergarten child: her four buildings stay exactly as they are.
- Left and right the wrong way round: "raise your left arm" means **his** left arm, whatever the camera shows.

## Approaches considered

- **The same four buildings, each with a language coach (chosen):** keeps "the same buildings", reuses the movement
  detection, the world and the tasks; each building needs its own set of instructions in two languages.
- One new coach room instead of the three camera buildings: less work, but against "the same buildings", and those
  three would stay "Bald".
- The Spielwelt only, the camera buildings later: least risk, but "Simon says", likely the most fun, would wait.

## The language of an instruction

- In each building he picks the language first (`LanguagePick`, the language remembered as in the other buildings;
  no voice needed).
- Every instruction is **spoken** in the language when the device has a voice for it, and **written** on the screen
  (large, in the language). 🔊 repeats it. Without a voice it is only written.
- A short German line under it only for the very first instruction of a visit ("Mach, was der Coach sagt"), then none.
- What the coach says is in the language: the instructions, the counting and short praise ("Great!", "Bravo!").
  The **setup lines stay German** (no camera, step into the picture, "I can't see you"): they are help when nothing works
  yet, and a German line there is no lesson he misses.
- The words are fixed in content files per building (`shared/coach/<building>.json` or one file; left to the builder),
  first drafts by Claude, plain and correct A2.

## 🚗 Spielwelt at Oberstufe

- The same world, objects, things to carry and task kinds (find a thing from where it is said to be; carry a thing to
  where it should go), **five tasks** a visit, then free play, Stars as now (cap 10).
- The clues in the language, every position word from the start (no ladder):
  - EN: on, under, in, next to, in front of, behind, between … and …, to the left of, to the right of.
  - FR: sur, sous, dans, à côté de, devant, derrière, entre … et …, à gauche de, à droite de — with the right article
    and contraction (sur la table, sous le lit, à côté du lit, à côté de l'arbre, à gauche de la caisse).
- Every object and thing gets its English and French noun (and French gender); a sentence: "Put the ball under the
  table." / "Mets le ballon sous la table." / "Where is the cat? It is behind the tree." / "Où est le chat? Il est
  derrière l'arbre."
- "left of" / "right of" as seen on the screen (the world is a picture, not a mirror).

## 🧘 Yoga at Oberstufe

- The five poses the detection knows, described in words, never by their animal names: e.g. "Stand on one leg. Put your
  hands together above your head." / "Tiens-toi sur une jambe. Mets les mains au-dessus de la tête." Each pose has a
  short title in the language too ("Tree" / "L'arbre" is fine for the tree; the frog and the plane get neutral titles).
- A session as now (the same number of poses and the hold times), the instruction instead of the picture first; the
  picture of the pose appears after a few seconds if he hasn't found it yet (a hint, so he isn't stuck).
- Stars as now (cap 9).

## 🦘 Hüpfhalle at Oberstufe

- A workout of the four counted moves the detection knows (jumping jacks, hops, squats, stretches), each instruction
  with a number in words: "Do five squats!" / "Fais cinq flexions!" The count is spoken by the coach in the language as
  he goes ("one, two, three …" / "un, deux, trois …").
- The same rounds and lengths as now (three rounds of ten), each round **split into numbered instructions that add up
  to ten** ("Do four squats!" then "Do six jumping jacks!", or 3 + 3 + 4); numbers between three and seven per
  instruction. The Stars per round stay as now.
- Stars as now (cap 9).

## 🪩 Tanzsaal at Oberstufe: "Simon says" / "Jacques a dit"

- About fifteen instructions a visit from the arm moves the detection knows: both arms up, arms out to the side, hands
  on your hips, hands on your head, clap, **left arm up**, **right arm up**. (Waving is left out: the detection sees a
  wave as one arm up and couldn't tell it from "left arm up".)
- About two thirds start with "Simon says" / "Jacques a dit": he must do it within a few seconds (a point). The others
  come without it: he must **not** do it (a point when he stays still; a "Simon didn't say so!" / "Jacques n'a pas dit!"
  when he moves).
- A beat in the background (the Tanzsaal's sound, not a children's song), no dancer to copy: the instruction is the only
  help, so he must understand it.
- Stars: as the Tanzsaal now (cap 10), by points.
- "Left" and "right" are his own; the detection compares with the camera image accordingly (the builder checks this
  with a test of a mirrored body).

## The doors

`spielwelt`, `yoga`, `huepfhalle` and `tanzsaal` get `"oberstufe"` entries in `shared/buildings.json` in the PR that
builds each, with their current maxStars (10, 9, 9, 10) and needs (camera for the three); their own Oberstufe
components.

## Calls made in writing this down (Claude's, for the parents to check)

- No per-child record and no parents' lines: these buildings practise by doing; the Stars are the record.
- Instructions spoken and written at once (not hidden as in the listening tasks): he should act, not guess.
- Yoga's pose picture as a hint after a few seconds; Hüpfhalle rounds of ten split into instructions of three to
  seven; Tanzsaal about fifteen instructions, a third of them traps, no waving.
- The camera setup lines stay German; instructions, counting and praise are in the language.
- The first-instruction German hint line.
- Spielwelt: all words at once, no ladder.

## Left to the builder

Screen layouts (the existing buildings are the model), the exact sentences, where the content files live, the exact
timings (how long he has to react in the Tanzsaal, when the Yoga hint comes), how a trap's "staying still" is
measured.
