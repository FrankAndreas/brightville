# Brightville

A small, friendly town for a kindergarten-age child: walk a wobbly character around, go into buildings, and earn Stars there by learning and moving.
Everything the child sees is pictures and a German voice; no reading is needed.

The old town is 120 m across: a plaza in the middle where she starts, with balls to push, and four avenues and a ring road leading out to its buildings. Learning, making things, moving, playing and the two shops are mixed along the streets, so every walk passes a bit of everything; her own house is by the plaza. Between the streets lie houses that are just houses, a park with the big hill (and the big trampoline), smaller hills in the corners, a lake with a wooden jetty by the plaza, two more trampolines in a garden, a playground (a staircase of blocks up to a platform, hurdles to hop over), and two fenced gardens where the cat and the dog live. A hedge runs round it all. Each building's sign floats above its door, seen from every street. The houses are blocky row houses with windows on every floor, stepped roofs, and here and there a chimney, an awning, a balcony or flower boxes (`src/city/houseKit.ts`, merged into a few meshes by `merge.ts`); trees stand on the hills, in the park and round the lake, lamps along the streets, benches round the plaza and by the lake, and the two gardens are fenced (`src/city/nature.ts`, the same every time). She walks through bushes and flowers, not through trees, lamps or benches. The town is alive: seven townsfolk (wobblies in random looks, never in anything from the shops) stroll the streets and turn back when they meet her (`src/city/walkers.ts`); a duck with two ducklings paddles and two sailing boats drift on the lake, birds hop about and fly up and away when she comes within 3 m, a cat sleeps on a garden wall and a dog plays in another garden (`src/city/animals.ts`). None of them comes towards her or stands in a doorway, and none is solid. The whole map is data in `src/city/map.ts`, and `map.test.ts` checks it: every door reachable on foot, no slope steeper than 20°, the lake closed off, the buildings mixed.

Beyond the old town lie districts, each its own data in `src/city/districts/` and joined on through a gate in the hedge: behind it a forest (with deer at a clearing) and a farm (cows and sheep in pens, chickens that run from her, a tractor), to its right a paved workshop yard with sheds, and mountains behind it all. The districts keep empty lots for new buildings (one meant for an NMG house, one for a Bee-Bot workshop, three spare); the old town has no empty lots: its two gardens belong to the cat and the dog. The 🗺️ button (or M) opens a map of the whole town in pictures: every building she can go into, and four stops (Platz, Bauernhof, Wald, Werkstatt). One tap and she rides there on a bicycle in her colours, off the grass by the shortest free way and then along the streets, and the voice says where she is going (`src/city/ride.ts`, `rider.ts`, `src/components/TownMap.vue`). Arriving never takes her in; she still does that herself. Any of her keys, the stick, a pause, the help or opening the map again ends the ride where she is.

| Building | What happens inside | Stars |
|---|---|---|
| 🔢 School | Five tasks at her step on two Lehrplan 21 ladders: three for Zählen (up to 10, 20, counting on and back, a quick look, tens bars up to 100) and two for Rechnen (plus up to 5, 10, minus, up to 20, tens up to 100); each ladder moves up by itself after two visits' worth of answers with at most one miss (`src/core/ladders.ts`, `backend/app/school.py`) | +1 per task, +5 for all five |
| 👂 Reimhaus | Five spoken tasks at her step on the Lehrplan 21 ladder Reimen: what rhymes (two, then three pictures), which word starts the same, and syllables tapped on a drum (up to 3, then 4); an example first while a step is new; moves up after two visits' worth of answers with at most two misses (`src/core/rhymes.ts`) | +1 per task, +5 for all five |
| 🧩 Musterwerkstatt | Five tasks at her step on the Lehrplan 21 ladder Muster: continue a row of colours, then shapes and sizes, sort four things into two baskets (by colour, kind or size), find a gap in a row, rows where colour and shape change together; an example first while a step is new; moves up after two visits' worth of answers with at most two misses (`src/core/patterns.ts`) | +1 per task, +5 for all five |
| 🗓️ Kalender | Five tasks at her step on the Lehrplan 21 ladder Zeit: put four pictures of a day in order, morning/noon/evening/night as little skies, the days of the week as coloured cards, yesterday and tomorrow from the real day, the seasons, full and half hours on a clock; an example first while a step is new (`src/core/kalender.ts`) | +1 per task, +5 for all five |
| 🚗 Spielwelt | A wide 2D world (house, garden, pond, playground, street, meadow) that wraps around: five tasks at her step on the Lehrplan 21 ladder Raum, finding a thing ("Die Katze ist unter dem Tisch. Findest du sie?") or carrying one ("Leg den Ball auf den Tisch."), with auf/unter/in, neben/vor/hinter, zwischen, links/rechts neben, then two clues; afterwards free play for as long as she likes: carry things, swipe, drive the car (`src/core/world.ts`, `src/core/raum.ts`) | +1 per task, +5 for all five |
| 🥁 Trommelhaus | Rhythm on the Lehrplan 21 ladder Rhythmus, answered by tapping big drums or by clapping (the microphone hears it), chosen at the door: keep a beat, fast and slow, loud and quiet, copy a rhythm; the beat is always seen too (a light and a bouncing bear) (`src/core/rhythm.ts`) | +1 per task, +5 for all five |
| ✏️ Schreiben | Her own words and short sentences (from the parents), or today's two letters, each traced three times; less help for letters she knows (touch screen only) | +1 per letter, +4 for finishing |
| 🧘 Yoga Studio | The camera checks three poses | +3 per pose held |
| 🔍 Unterschiede | Ten differences between two pictures | +1 per difference found without the lamp |
| 📚 Bibliothek | A short story read aloud with pictures, then three picture questions | +3 per question |
| 🧪 Farblabor | Two paint pots: which colour do they make? Five mixes | +2 per mix |
| 🦘 Hüpfhalle | Three rounds of ten moves (jumping jacks, hops, squats, stretches) counted by the camera; the meter only fills | +3 per round |
| 🪩 Tanzsaal | Two little songs; copy the dancer's arm moves, each one caught lights a note | up to +5 per song |
| 🎨 Ausmalen | Twenty coloring pages: pick one, tap its parts to fill them | free |
| 🖌️ Malen | Free drawing; each child's paintings are kept on the server | free |
| 🃏 Arcade | Memory with six pairs of animals | costs 3 per round |
| 🐍 Schlange | The snake collects treasures until it bites itself | costs 3 per round |
| 🍬 Bonbonjagd | Collect every sweet in a maze; chasers wander, a power-up turns the tables | costs 3 per round |
| 🪽 Flatterflug | Her wobbly gets wings: tap to flap through the gaps between the clouds | costs 3 per round |
| 🎬 Kino | One of the YouTube films the parents chose | costs 3 per film |
| 🏠 Mein Haus | Her room: the logbook (Tagebuch), the sticker book (Stickerheft), her trophies, her wardrobe (Kleiderschrank) and her furniture | free |
| 👗 Kleiderladen | Add-ons for her character on three shelves; after today's learning, one purchase a day across both shops | 15–120 per add-on |
| 🛋️ Möbelhaus | Furniture for her room on three shelves; the same rules as the Kleiderladen | 15–120 per piece |

**The Oberstufe:** a parent sets each child's level on the parents' page: Kindergarten (everything above, as it was) or Oberstufe, for an older child (3. Oberstufe, Zyklus 3). At Oberstufe the same town opens only what has content for him yet: the 🔢 School is a vocabulary trainer for English or French, ✏️ Schreiben dictates his words, 👂 the Reimhaus plays listening scenes, 🧩 the Musterwerkstatt trains grammar, 📚 the Bibliothek is a reading room, 🗓️ the Kalender trains dates and times, 🚗 the Spielwelt gives its tasks in English or French, 🧘 Yoga, 🦘 the Hüpfhalle and 🪩 the Tanzsaal have an English or French coach, 🥁 the Trommelhaus is a speaking room, the play buildings open (the Spielhalle as a word memory, the Kino with his own films), Malen and Mein Haus stay as they are, 👗 the Kleiderladen sells his own range, and the two shops keep their rule (after the day's learning); every other door says "Bald" (at the door and on the map), and the server refuses visits to it. The trainer is written German, not pictures and voice. He picks the language (never both in one list, round or voice), then one of his own lists, "Alle meine Wörter" (all his words in that language), or a built-in topic (📘, twelve topics of 24 words at about A2 in `shared/vocab/en.json` and `fr.json`, first drafts). He makes his lists in the School himself: a name and one pair per line, German first (pasting a whole list works; a tab, ` - `, ` – `, ` — `, ` = ` or `;` between the two; ` / ` between answers that all count). A round is up to ten words: those due first, then at most four new ones, then those due soonest. A new word is picked from four (all from the same language), a known one typed, in turn German → foreign and foreign → German; case, spaces and a final full stop don't matter, an English verb may leave out its "to", but accents and umlauts count (the right spelling is shown with the accent marked, and French has buttons for its accented letters). After a miss he types the right answer once, and the word comes back at the end. English words are spoken in an English voice, French ones in a French voice, when the device has one. How well he knows each word is a box from 0 to 5: right moves it up and it comes back after 1, 2, 4, 8, 16 and then 32 days, wrong puts it back to box 1 for tomorrow (`src/core/vocab/`, `backend/app/vocab.py`, the days in `shared/vocab/boxes.json`). Stars: +1 per word right the first time, +5 for a round of ten without a miss (at most 15 a visit). ✏️ Schreiben at Oberstufe is a dictation of his words: he picks a language and a source from the School's shelf (lists are made only in the School), hears up to ten words chosen by the same rules (🔊 again, 🐢 slowly) and types each; nothing is written before he answers, then the word and its German are shown, accents count, and a miss is typed out and comes back at the end. Spelling has its own boxes (keys `<lang>:spell:…`), so a word known in the School can be new here. Stars as in the School (at most 15). 👂 The Reimhaus at Oberstufe is listening: he picks a language and a topic or "Gemischt", and hears five short scenes (a sentence or a tiny dialogue, 6 per topic in `shared/listen/en.json` and `fr.json`, first drafts at about A2), each with a question and four answers in German; 🔊 and 🐢 replay it as often as he likes, and after his answer the scene's text is shown. Scenes he never got right come first, then those right longest ago; a missed one comes back in a later round. +1 per scene right, +5 for all five (at most 10). In a dialogue the second speaker gets the device's second voice for the language, or the same voice lower. 🧩 The Musterwerkstatt at Oberstufe trains grammar: 12 topics per language (English: tenses, questions with do, comparison, modals, some/any, adverbs, relative pronouns, if-sentences, the passive; French: articles, the common verbs, passé composé with avoir and être, futur proche, negation, adjectives, partitive, possessives, object pronouns, questions), in `shared/grammar/en.json` and `fr.json` (first drafts). Verb-form topics are made from verb tables where every form is written out, the others are hand-written gap sentences. He picks a topic or "Gemischt", which leans towards the topics he gets wrong most; a round is ten sentences, picked from four while a topic is new to him and typed once he has 5 of his last 10 right (accents count). After each answer the whole sentence and the topic's rule (one line in German) are shown; a miss is typed out and comes back at the end. Stars as in the School (at most 15). 📚 The Bibliothek at Oberstufe is a reading room: 36 short texts per language (12 topics × 3: e-mails, notices, menus, news items, diary entries … at about A2, in `shared/reading/en.json` and `fr.json`, first drafts). He picks a topic or "Gemischt" and reads one text a visit, one he hasn't read yet first, else the one read longest ago. Tapping an underlined word shows its German; 🔊 reads a sentence aloud when the device has a voice. Four questions in German follow, one after another; a wrong answer shows the right one. Stars: +2 per question right, +2 for all four (at most 10). 🗓️ The Kalender at Oberstufe trains dates and times: one mixed round of ten tasks a visit, all made by rules (`src/core/dates/`), two of each kind: reading a clock (five-minute steps) in words, finding the clock for a time he hears (or reads, without a voice), finding the date he hears, writing a date in words, and spelling days, months and (in English) ordinals. Every common form counts ("quarter past eight", "eight fifteen", "it's …"; "huit heures et quart", "vingt heures quinze", "il est …"; "the fourteenth of July", "July 14th"; "le quatorze juillet", "le 14 juillet"). Each kind is picked from four while it is new to him and typed once he has 5 of his last 10 right (accents count); clocks and dates to recognise are always picked. Stars as in the School (at most 15). 🚗 The Spielwelt at Oberstufe: after picking the language, the same world and its five find-and-place tasks come in English or French ("Put the ball under the table.", "Le chat est derrière l'arbre. Tu le trouves?"), every position word from the start, spoken in the language's voice and written on the screen (🔊 repeats it), then free play; nothing is recorded on her Raum ladder. 🧘 Yoga, 🦘 the Hüpfhalle and 🪩 the Tanzsaal at Oberstufe keep their camera and movement detection, with a coach who speaks and writes in the language picked (the camera setup lines stay German): Yoga describes each pose in words, without animal names, and shows its picture only as a hint after 6 seconds; the Hüpfhalle is a counted workout, three rounds of ten split into parts ("Do four squats!", the coach counting every rep); the Tanzsaal is "Simon says" / "Jacques a dit", fifteen arm commands, five of them traps that must not be followed (left and right are his own). Stars as for the Kindergarten child. The play buildings open for him by the same rules as for her (after the day's learning, within the play time, 3 Stars): 🐍 Schlange, 🍬 Bonbonjagd and 🪽 Flatterflug as they are; 🃏 the Spielhalle is a word memory in English or French (six words, each a card in the language and its German card; a pair found at the first try counts in the School for a word due today); 🎬 the Kino shows the films of his own list, which the parents keep apart from hers on the parents' page. 🥁 The Trommelhaus at Oberstufe is a speaking room: after picking the language he says ten items aloud, tapping 🎤 for each: Nachsprechen (a word or an everyday sentence written, and spoken when there is a voice) and Übersetzen (the German of a word he knows well, box 3 and up, at most five a round); at least three sentences a round, from 12 topics × 5 in `shared/speak/en.json` and `fr.json` (first drafts). The browser's speech recogniser (Apple's on the iPad, Google's in Chrome: his voice goes there, as the parents accepted for now; `src/services/recogniser.ts` is the one place to swap in another service) hears it; case, punctuation, accents and figures ("2" = "two") don't matter. Not right: "Gehört: …" and another try, up to three, then the right form is shown; nothing heard is no try. +1 per item, +5 for ten of ten (at most 15). Without a recogniser and microphone the door is crossed out. 👗 The Kleiderladen at Oberstufe sells his own range instead of hers (eleven items over the three shelves: cap, beanie, headphones; scarf, sports medal; hoodie, Swiss football shirt, jacket; backpack, skateboard, guitar, marked `"level": "oberstufe"` in `shared/outfits.json`), each labelled in the language he picked last (English if none) with the German underneath; only his own items open his shelves, the server sells each child only their own range, and what he owns from hers stays his to wear. The look screen offers short and messy hair and sunglasses and square glasses to every child. Both Schreiben and the Reimhaus need an English or French voice on the device (Schreiben no longer needs a touch screen there); without one the door is crossed out, and a language without a voice can't be picked inside. On the parents' page his card shows "Sprachen" instead of the Kindergarten sections: per language the words learned (box 3 and up) and due today, the words he spells right, the listening scenes he understood, how many grammar topics are sure (8 of his last 10 right) and which are weak, how many texts he read, the Kalender's task kinds that are sure and weak, how many sentences and words he said right in the Trommelhaus, and his lists to read.

**Free** buildings are always open: before the day's learning, with no Stars, and after the play time. They neither give nor cost Stars and don't count as play time.

**Stars at a child's pace:** the server takes an earning visit only when enough time has passed since the one before for its Stars to be earned (`minSecondsPerStar` in `shared/buildings.json`, about half of the fastest real visit). A visit that comes too soon waits on the device and is sent again by itself, so nothing is lost; it only makes sending Stars by hand no faster than earning them.

**Learn first, play later:** the Arcade door stays locked until today's earning visits are done (any learning or moving building, in any mix; two unless a parent set another number). The slots next to the Star counter show how far the child is. A new day starts the slots over; Stars are kept.
When a parent has set a play time per day, the Arcade door shows a moon once it is used up.

**Each child has their own Stars**, kept by the game's server (`backend/`), so the laptop and the iPad show the same.
Who is playing comes from the family hub's login; a coloured circle with the first letter next to the Star counter shows who it is.
Parents get a gear next to the "?". It opens only when held for three seconds and then asked a multiplication (e.g. 7 × 8), so a child playing on a device logged in as a parent doesn't get in. Their page shows every child's Stars and today's numbers, and sets the daily goal, the play time per day and the Stars. Below, they keep the Cinema's list of YouTube films (a link and a name each, at most 30, the same for every child). Each child's card has a folded "Tagebuch" with the last seven days as text and the stickers earned, and a folded "Lehrplan 21": a bar per subject (Mathematik, Deutsch with Reimen and the letters she knows in Schreiben, Musik) showing how far she is towards the end of 2nd grade, each with a line where Kindergarten typically ends, and under each bar its ladders' steps to read and set, and this week's practice by subject and by entwicklungsorientierter Zugang (`src/core/lehrplan.ts`; codes from the template at v-fe.lehrplan.ch). The child never sees any of it.

The idea behind the game is in [Learning City – Gameplay Design.md](Learning%20City%20%E2%80%93%20Gameplay%20Design.md).
Where the project stands, what wasn't checked on real hardware and what is left to build: [docs/roadmap.md](docs/roadmap.md).
How it is built and what comes next is in [docs/superpowers/specs/2026-11-12-brightville-stage1-design.md](docs/superpowers/specs/2026-11-12-brightville-stage1-design.md);
the plan for stage 1 is in [docs/superpowers/plans/2026-11-12-brightville-stage1.md](docs/superpowers/plans/2026-11-12-brightville-stage1.md).
Stage 2 (School, Arcade, daily goal) has its own [design](docs/superpowers/specs/2026-11-12-brightville-stage2-design.md) and [plan](docs/superpowers/plans/2026-11-12-brightville-stage2.md).
Stage 3 (iPad and NAS) has a [design](docs/superpowers/specs/2026-11-12-brightville-stage3-design.md) and a [plan for its first part](docs/superpowers/plans/2026-11-12-brightville-stage3-part1.md).
Stage 4 (family login, server, parents) has a [design](docs/superpowers/specs/2026-11-12-brightville-stage4-design.md).
Stage 5 (the rest of Spielzeugkiste) has a [design](docs/superpowers/specs/2026-11-12-brightville-stage5-design.md), and its third part (Cinema, paintings on the server, a bigger town) [another](docs/superpowers/specs/2026-11-12-brightville-stage5-part3-design.md).
Stage 6 (Hüpfhalle, Tanzsaal, the house, stickers) has a [design](docs/superpowers/specs/2026-11-13-brightville-stage6-design.md) and a [plan](docs/superpowers/plans/2026-11-13-brightville-stage6.md).
Stage 7 (her own character, the Kleiderladen, the wardrobe) has a [design](docs/superpowers/specs/2026-11-13-brightville-stage7-design.md) and a [plan](docs/superpowers/plans/2026-11-13-brightville-stage7.md).
Stage 8 (her room: trophies, furniture, the Möbelhaus) has a [design](docs/superpowers/specs/2026-11-13-brightville-stage8-design.md) and a [plan](docs/superpowers/plans/2026-11-13-brightville-stage8.md).

## Run it

Requires Node 22 or later and Python 3.14.

```bash
npm install        # also copies the body-tracking files into public/mediapipe/ and enables the git hook
python3 -m venv venv && venv/bin/pip install -r backend/requirements.txt -r tests/requirements.txt black flake8 mypy

npm run dev        # the server on :8000 and the game on http://localhost:5173, without the family hub
npm test           # Vitest
npm run lint       # ESLint
npm run typecheck  # vue-tsc
npm run build      # type check, then static files in dist/
venv/bin/pytest    # the server's tests
```

**Trying it here, without the family hub:** `npm run dev` starts the server without `HUB_URL` and with `LOCAL_MODE=1`, so there is no login. The page asks who plays: big coloured circles for the people of `LOCAL_PEOPLE` (default "Kind" and "Eltern"). Tapping the circle in the town hands the game to someone else. Pick your own people:

```bash
LOCAL_PEOPLE="Mia:CHILD,Ben:CHILD,Papa:PARENT" npm run dev
```

Their Stars are kept in `backend/data/brightville.db`; delete it to start over. Anybody can pick a parent, so this mode is not for the NAS.

**With a family hub:** `HUB_URL=http://<NAS_IP>:8086 HUB_PUBLIC_URL=https://home.local.<domain> npm run dev`. The hub's login cookie only reaches pages under `local.<domain>`, so this works on `localhost` only with a `hub_session` token sent by hand (`Authorization: Bearer`). `npm run dev:web` starts the game page alone.

The pre-commit hook (`.githooks/pre-commit`, the same script as in the other family repos) runs lint and the type checks, and black, flake8 and mypy for the server, on commits that touch code.
CI (`.github/workflows/ci.yml`) runs the audit, the tests, lint and the build, the server's checks and tests, and builds the two container images; a push to `main` publishes them as `ghcr.io/frankandreas/brightville/frontend` and `.../backend`.

Running it on the NAS for the iPad: [docs/deploy-nas.md](docs/deploy-nas.md).

The camera only works on `localhost` or over HTTPS. On a plain `http://` address the doors of the Yoga Studio, the Hüpfhalle and the Tanzsaal stay closed.

## Controls

In every building, next to the door button at the top left, a 🔊 button says the building's instruction again (the question in the School, the colours in the Farblabor, the letter in Schreiben …), for a child who missed it. The Bibliothek has its own 🔁 for the story.


| Action | Keyboard | Touch screen |
|---|---|---|
| Walk | Arrow keys or W A S D (up always walks away from the camera) | Drag a finger anywhere in the left half of the screen |
| Turn the view | J and L while held; K turns around; I looks at the learning row again | Hold one of the round arrows above the jump button |
| Jump | Space | The yellow arrow button, bottom right |
| Go into a building | Enter or E, in front of the glowing door | Tap the picture that appears at the door (a mouse click works too) |
| Leave a building | Esc | The door button, top left (also for the mouse) |
| Open the map (tap a picture to ride there) | M | The 🗺️ button |
| Show the controls | H or F1 | The ? button |

Keys and fingers work at the same time. The stick and the jump button appear only on a device with a touch screen.

A new player (0 Stars) sees the controls as pictures at the start, read aloud one at a time while each picture lights up; any key or tap closes them. A device with touch and no mouse gets the finger pictures instead of the keys.

The trampoline bounces by itself. A long fall makes the character tumble for a moment; nothing is ever lost.

## School

The question is asked aloud. Pointing at an object (click or tap) counts it aloud.
Answer with the digit key, with Left/Right and Enter, or by clicking a button.
A wrong answer only fades its button and the objects are counted together; the task ends when it is right.

## Trommelhaus

At the door she picks 👆 Tippen or 👏 Klatschen (without a microphone, tapping starts straight away). Clapping asks the iPad for the microphone on that tap; if it says no, she taps. The microphone only measures loudness while she answers: nothing is recorded or sent. The house never listens while it plays: when she claps along to a beat, it drums the first two beats and then only the light and the bear keep it. Tolerances are generous (±0.2 s on a beat, six of eight; a copied rhythm's gaps within a third). After three misses a task is shown once more and the visit goes on; if the microphone hears nothing in two tasks running, she taps.

## Spielwelt

Swipe the world to scroll; it wraps around, and the strip at the top shows all of it (tap it to jump). Press a thing and carry it; let go and it settles: on a surface it was dropped above, under a table, bed, bench, bridge or slide, in the Schrank, Kiste, Sandkasten, Hundehütte, garage or car, or on the ground. Dropped a little higher than an object's foot it is behind it (smaller, see-through), a little lower in front. Only letting go near the task's object counts; setting a thing down on the way says nothing. Tap the car to drive with ◀ ▶; what is on or in it rides along. Where she left things is kept per child on the device. The relations are in `src/core/world.ts`, the tasks in `src/core/raum.ts`.

## Kalender

"Heute" is the real day: the device's date when the visit starts, so on a Thursday it says "Heute ist Donnerstag" and "Welche Jahreszeit haben wir jetzt?" has the real season as its answer (the seasons change around the 21st, as in a Kindergarten calendar). The days keep fixed colours, in the week strip (today's card with a sun) and on the answer cards, which the voice names as they light up. Clocks are not named (that would give the answer away); "halb vier" is 3:30. In the order of a day each picture is named as it lights up (lunch and dinner carry a sun and a moon), and she taps them one after the other; one tapped too early wiggles. Every question has exactly one answer: "Wann gehst du schlafen?" (Abend or Nacht) is not asked.

## Musterwerkstatt

A row is said piece by piece as each lights up, then "Was kommt jetzt?" (or "Was fehlt?" for a gap inside, which the voice hums). A tap on one of the pieces below is her answer: a wrong one fades and the row is said again, the right one fills the gap. To sort, she taps a thing (it lifts and its name is said), then a basket; each basket already holds one example. A thing in the wrong basket goes back to its place. Pieces are drawn (`src/buildings/muster/PieceView.vue`); the rows and sorts are made in `src/core/patterns.ts`.

## Reimhaus

Everything is said, and every word is a picture; there is nothing to read. In a rhyme or first-sound task the voice names each picture in turn as it lights up, and a tap is her answer. In a syllable task she taps the big drum once per syllable (a dot each), ↺ starts over and ✓ says she's done. A wrong picture fades and both words are said again; a wrong count is drummed and said again in syllables. The words and their syllables are in `src/core/rhymes.ts`.

## Arcade

Turn cards by clicking, or with the arrow keys and Enter. Esc leaves; the 3 Stars are not given back.

## Unterschiede

Tap a difference in either picture; the voice says what changed. The lamp 💡 circles one, which then gives no Star. Five misses within ten seconds let the pictures rest for three seconds ("Schau genau hin!"), so tapping everywhere doesn't pay. One of four scenes from Spielzeugkiste, never the same twice in a row.

## Schlange and Bonbonjagd

Arrow keys or WASD on the keyboard; a swipe anywhere or the arrow pad with a finger. The first direction starts the round.
Schlange ends when the snake bites itself; Bonbonjagd when the five lives are gone or every sweet is eaten. Then the game goes back to the town by itself. Each look (unicorn or princess) and each maze is picked at random. Before the start, Bonbonjagd offers three speeds (🐢 🐇 🐆); the child's last choice is remembered on the device. The mazes are Brightville's own.

## Flatterflug

Her own wobbly, in her look and with what she wears (anything on its back makes room for a pair of feathered wings), flies through the sky. Each tap anywhere (or Space, ↑) makes it flap and rise a little; without flapping it sinks. Columns of clouds come from the right, each with a gap to fly through: 15 make a round, and the voice cheers at half. A cloud costs one of three hearts ("Hoppla!") and the wobbly blinks for a moment, flying on; the meadow below just bounces it up again, so falling never ends the round. Before the start she picks a speed (🐢 🐇 🐆: faster clouds, smaller gaps), remembered on the device. Upright, the wobbly flies further left, so the next gap is always seen two seconds ahead. The rules are in `src/core/flight.ts`, the flying wobbly in `src/city/flyer.ts`.

It is a play building like Schlange (3 Stars a round, after today's learning).

## Kino

The door stays grey until a parent added films. Inside, a tap on a film's picture plays it full size in YouTube's privacy-enhanced player (`youtube-nocookie.com`); when it ends, the child is back in the town. One film per 3 Stars; the leave button stops it any time. The page's security rules allow exactly that player and the films' pictures (`i.ytimg.com`), nothing else from YouTube. The player runs in a sandbox without new windows or leaving the page, so YouTube's logo and the film's title lead nowhere: no way from here to youtube.com or the YouTube app.

## Ausmalen

A tap on a picture opens it; pick a colour at the bottom, then tap a part of the picture. ↩️ takes the last fill back. Esc or the leave button goes from a picture back to the wall, and from the wall back to the town. The pages come from Spielzeugkiste and are not kept.

## Malen

➕ starts a new sheet; a tap on a painting paints further on it. Brush, pencil, eraser, six shapes (dragged from corner to corner), three sizes, twelve colours, ↩️ and 🗑.
Leaving the sheet (✅, Esc or the leave button) keeps it on the server, so the same gallery shows on the laptop and the iPad. Each child sees only their own paintings, the newest 30. When the server can't be reached, the painting waits in the browser (IndexedDB, shown with ⏳) and is sent the next time the gallery opens. A resting hand is ignored, as in Schreiben; the mouse works too.

## Schreiben

Capital letters, Ä Ö Ü and the digits in the Deutschschweizer Basisschrift, with the stroke order Swiss schools teach. The paths and the tracing rules come from Spielzeugkiste.

The child traces each stroke from the green dot with a finger or a pen; the traced part turns green. A resting hand is ignored: a touch much larger than the pen doesn't count.
Lifting early starts that stroke again. Nothing is ever taken away.

**Choosing.** Inside, her words and sentences stand as big cards, with a 🎲 for today's letters. Without any words the 🎲 round starts at once. The parents write the list on the parents' page (each child's card, "Schreiben"; ↑ ↓ to reorder, ✕ to remove): capitals, Ä Ö Ü, digits and spaces, at most 30 characters a text and 20 texts; typed lowercase becomes capitals and a pasted umlaut (letter + mark) one letter; ß and punctuation are refused. Lowercase letters come later, once she knows the capitals.

**A word or sentence** is written letter by letter. Along the top, each letter she finished shows in her own lines, with a gap between words. The voice says what she writes ("Wir schreiben: Ich mag dich Lena!"), names each new word and each letter, and reads the whole text at the end. One Star per letter, +4 for finishing (the server caps a visit at 10).

**How well she knows each letter.** Every letter and digit has a level per child, kept on the server, which sets the help wherever the letter comes:

| Level | On the board |
|---|---|
| new | not met yet; in a word the whole letter, and the write doesn't count |
| 1 | the whole path with arrows |
| 2 | dots along the path |
| 3 | only the green start dot |
| learned | only the lines; after a wrong start the start dot appears |

A write is *bumpy* when she started at the wrong place or the wrong end, or lifted early in a real try; otherwise it is *clean*. Three clean writes in a row move a letter up a level, three bumpy ones down (never below 1). The parents' page shows the levels as a coloured grid.

**Today's letters (🎲).** Two letters, each written three times. New letters come first, at most two a day: one while she has three or more letters at level 1, none while five or more (counting the letters she met before today, so the first new letter of the day never takes the second one's place). A new letter is written with the whole path, then dots, then the start dot; it counts as met after the third. The letters of her own words come first, then the other letters, then the digits. The other places go to her weakest letters (lowest level, then the longest unpractised); with too few letters to repeat, other letters are practised without counting as met. Writes and new letters wait on the device while the server is away; a letter met offline counts for the day she met it (within the last 60 days; otherwise today). The server forgets a write's key after 60 days.

The door is open only on a device with a touch screen.

**The pen.** The rules were tuned in Spielzeugkiste with a children's stylus (Edurino) on the iPad. Its recorded tries (`../kids-games/traces/`) show that Safari reports that pen as an ordinary touch of 41.6 px, the same as a fingertip, so pen and finger are treated alike. A resting hand is told apart by comparing each touch with the smallest one seen in the visit, not by a fixed size. An Apple Pencil has not been tried.

## Yoga Studio

1. The browser asks for the camera. Without one, a crossed-out camera is shown and Enter leads back.
2. Stand so that head to knees are in the picture; the outline turns green.
3. The teacher shows a pose and names it. Hold it until the ring is full (5 seconds). A wobble only drains the ring slowly.
4. After 30 seconds without success the teacher moves on, with no Stars and no comment.

The five poses are Stern, Riese, Baum, Frosch and Flieger. Their rules are in `src/core/pose/poses.ts`.

## Hüpfhalle and Tanzsaal

Both need only the head and shoulders in the picture, so the child can stand closer to the camera than for Yoga. A raised hand that leaves the top of the picture still counts as "up" by its elbow.
Progress only goes up: a move done stays done.
The frame around the camera picture is green while the camera sees the child and orange at once when it doesn't. When the camera loses the child for 1.5 seconds, an 👀 covers the picture and the voice asks them to step in front of the camera again; the meter waits, and in the Tanzsaal the music stops until the child is back.

- **Hüpfhalle:** a figure shows the move, and every one the child does fills the meter by a step with a rising note. Ten fill a round; the voice counts along from seven. Moves: Hampelmann, Hüpfen, Kniebeuge, Strecken (rules in `src/core/moves/reps.ts`).
- **Tanzsaal:** two of three little tunes (`src/core/moves/tunes.ts`, played with Web Audio). A dancer shows an arm move each bar: arms up, arms out, hands on the hips, hands on the head, waving, clapping (`src/core/moves/dance.ts`). A move counts if the child is in it at any moment of its bar or half a beat later. Missed moves just stay dark. Leaving during a song pays for the moves caught so far.

Camera pictures are analysed in the page and thrown away. Nothing is recorded or sent anywhere.
The tracking model (`public/mediapipe/pose_landmarker_lite.task`, from Google's MediaPipe) is part of the repo, so the game works offline.

## Mein Haus, the logbook and stickers

Mein Haus, by the plaza, is her room: a wall with a window, a floor, a table with the logbook and the sticker book, a trophy shelf, her wardrobe and seven spots for furniture.

- **Tagebuch:** one page per day the child did something, newest first. It shows the icon of each building visited with the Stars earned (green) or spent (grey), a sun when the daily goal was reached, the stickers earned and the paintings made that day. The voice reads the date, and tapping an entry says it ("Schule, sieben Sterne."). It is built from what the server has recorded since stage 4; visits to Malen and Ausmalen are recorded from stage 6 on, and only those in which something was made: at least ten strokes or fills and a minute inside (`src/buildings/effort.ts`).
- **Stickerheft:** a space for each of the 17 stickers, earned ones in colour, the rest as grey outlines. Tapping one says what it is for.
- **Trophies:** the shelf next to the album holds all 17 stickers as trophies: earned ones in their colour, the others as faint outlines of what is still to get. Tapping an earned one says its name and what it is for; any other, what it is for.
- **Kleiderschrank (wardrobe):** a big wooden wardrobe; inside, everything she owns, to put on and take off as often as she likes; ✏️ changes her look. Empty, it points to the Kleiderladen.
- **Her furniture:** seven fixed spots (picture, curtain, lamp, bed, rug, plant, toy), dashed while empty. Tapping a spot shows the pieces she owns for it and 🚫; a tap puts one there or takes it away, as often as she likes. Pieces she swapped out stay hers.

**Stickers** are rare milestones, never spent: ten visits to a building, six different learning buildings, the daily goal 3, 7 or 14 days in a row or on 10 or 30 days, 100 or 500 Stars. The list is `shared/stickers.json`, read by the page and the server; the server decides (`backend/app/stickers.py`), after each visit and when the page loads, so earlier history counts. A new sticker is celebrated in the town (at most three in a row; any more wait in the album, which glows).

## Her character, the Kleiderladen and the wardrobe

**Her look:** on her first visit, before the town, each player designs her wobbly character, for free: a body colour (8), hair (none, spiky, ponytail, buns, curly), a hair colour (6) and glasses (none, round, star, heart). 🎲 picks one for her. She can change it in the wardrobe; the same character walks in the town, with what she wears.

**The Kleiderladen** (👗, at the front next to Mein Haus) sells add-ons for her character, one per place (head, neck, body, back), on three shelves: 15–25 ⭐ (about a day), 40–60 ⭐ and 90–120 ⭐ (about a week). A shelf opens once she owns two add-ons from the one above. Tapping an add-on tries it on and says its price; ✔️ buys it, and she wears it at once.

- **Learn first:** the door opens only once today's learning visits are done, but play time used up doesn't close it.
- **One purchase a day.**
- **Saved Stars count half:** the Stars she had when the shop came (and still has) pay two for one there, so a full savings account can't empty the shelves at once. Everywhere else they count as before; the parents' page shows them ("davon gespart").
- **Sticker gifts:** four add-ons are never sold but come with a sticker (Sternensammler, Yoga-Meister, Tanzstern, Eine ganze Woche), also for stickers earned before.

The catalogue is `shared/outfits.json`, read by the page and the server; never rename or remove an add-on's id, as owned ones are kept by id.

## The Möbelhaus

**The Möbelhaus** (🛋️, at the front right, past the playground) sells furniture for her room: 18 pieces on three shelves, 15–25 ⭐, 40–60 ⭐ and 90–120 ⭐, each for one of the seven spots. It follows the Kleiderladen's rules: learn first, open after the play time, two pieces from a shelf open the one below, saved Stars count half, and **one purchase a day across both shops** (a Schal today means no bed until tomorrow). Tapping a piece shows it on its spot in a small picture of her room, with what else stands there; ✔️ buys it and puts it there at once. What stood on that spot stays hers, to put back in her room.

Both shops share their code (`src/buildings/shop/`) and, on the server, their rules (`backend/app/shop.py`). The catalogue is `shared/furniture.json`; never rename or remove a piece's id, and no piece may share an id with an add-on. The logbook shows a furniture purchase like a clothes purchase, and the parents' page shows her furniture under her clothes.

## How the code is organised

| Folder | What it holds |
|---|---|
| `src/core` | Pure logic with tests and no browser code: door rules, counting tasks, Memory, letters and tracing, pose rules |
| `src/input` | Turns the keyboard and the on-screen stick and buttons into intents (move, jump, go in, leave), merged into one source for the town |
| `src/city` | The 3D town: Three.js for drawing, Rapier for physics |
| `src/buildings` | One folder per building, plus the list of buildings in `registry.ts` |
| `src/services` | Voice, sound, camera, body tracking, device detection, and `api.ts` for the server (`fakeApi.ts` stands in for it in tests) |
| `src/stores` | Who plays (`session.ts`) and their Stars and today's numbers (`player.ts`); an earned visit the server didn't get waits in the browser and is sent again |
| `backend/` | The server: FastAPI and SQLite. The family hub's login (`hub.py`, `auth.py`) or the no-hub picking (`local.py`), the rules that touch Stars (`game.py`), the people (`people.py`). Tests in `tests/` |
| `shared/buildings.json` | What each building is (earns or costs, how much), read by the server; a test checks the town agrees |

A building is a Vue component that emits `finished` with `{ stars }`. To add one, write the component and add an entry to `src/buildings/registry.ts` with its door position, picture, spoken name, where the bicycle goes as a German phrase with its little word (`toName`, "zur Schule", said as "Wir fahren zur Schule!"), whether it earns Stars, costs them or is free (`kind`, `cost`), where its door stands on a street of `src/city/map.ts` (a new building takes one of the districts' empty lots) and on which side of the door its house is (`door.side`; `map.test.ts` checks the spot is free and reachable) and what it needs from the device (camera, touch, keyboard). The town shows a door as closed when the device can't serve it. A building also tells `src/buildings/leave.ts` how it is left (`onLeaveRequest(leave)`), so the on-screen leave button works in it.

In development mode, pressing L in the Yoga Studio prints the tracked body to the browser console, which is how real poses can be turned into test data.
