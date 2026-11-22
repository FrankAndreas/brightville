# Oberstufe Level and Vocabulary Trainer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A per-child level (Kindergarten / Oberstufe); at Oberstufe the School is an English or French vocabulary trainer with his own lists, built-in lists and spaced repetition, every other building except Malen, Mein Haus and the two shops shows "Bald", and parents see his progress.

**Architecture:** The level lives on `players` and comes with `/api/state`. `shared/buildings.json` says per building what it is at Oberstufe (absent = `soon`), read by the server (refusals, 15-Star cap) and the page (door state, which component to mount). The trainer is a new building component `src/buildings/vokabeln/` mounted for the School's id at Oberstufe; its rules are pure TS in `src/core/vocab/` mirrored by `backend/app/vocab.py` (server is the truth); its store follows `src/stores/ladders.ts` (results wait on the device under a key, counted once).

**Tech Stack:** Vue 3 `<script setup>` + Pinia + Vitest (jsdom); FastAPI + SQLite + pytest.

**Spec:** `docs/superpowers/specs/2026-11-22-brightville-oberstufe-vocab-design.md`

## Global Constraints

- **Never mix languages:** a list, a round, the choices and the voice are one language (`en` or `fr`) plus German. Distractors never come from the other language.
- At level `kindergarten` (default for every existing child) nothing changes: same doors, same School, same parents' card.
- Level values exactly `'kindergarten'` and `'oberstufe'`; languages exactly `'en'` and `'fr'`; voices `en-GB` and `fr-FR`.
- Open at Oberstufe: `school` (trainer), `malen`, `haus` (as today), `laden`, `moebel` (as today, after the day's learning). Every other building: door state `soon`, a "Bald" sign at the door and on the map, refused by the server.
- Lists: up to 30 per language, up to 60 pairs each, each side up to 60 characters; name required, up to 40 characters (Ruling: the spec gives no name limit).
- Paste: one pair per line, German first, separators tab, ` - `, ` – `, ` = `, `;`; a tab wins when there are several. ` / ` separates alternative answers; the first is shown.
- Round: 10 words; due words longest overdue first, then new words (at most 4 per round) in list order, then the words due soonest. Fewer words in the source, shorter round.
- Box 0 or 1: pick from 4 choices (German shown). Box ≥ 2: typed, alternating German → foreign and foreign → German.
- Answer check: ignore case, spaces around and between words (collapsed), a final `.`, `!`, `?`; English verbs may leave out `to`. **Accents and umlauts count**: an answer differing only in them is wrong, shown with the differing letters marked. Input: `autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"`. French: accent buttons `é è ê à â ç ô î û ë ï ù œ`.
- Wrong: right answer shown and spoken, he types it once to go on, the word comes back once at the end (no Star; a second miss keeps it in box 1). Only the first answer of a word moves its box.
- Boxes: right moves 0→1 due +1 day, 1→2 +2, 2→3 +4, 3→4 +8, 4→5 +16, 5 stays +32; wrong → box 1 due +1 day. Learned = box ≥ 3. Word keys: built-in `<lang>:<topic>:<id>`, own `<lang>:own:<normalized first foreign answer>` (so editing the foreign side starts it new, and the same word in two lists is one word).
- Stars: +1 per word right on the first try, +5 when all of a 10-word round were right on the first try; server cap 15 for a School visit at Oberstufe (10 at Kindergarten).
- All new text the child sees is written German; the trainer speaks no German instructions.
- Commits end with the two attribution lines (`Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, `Claude-Session: https://claude.ai/code/session_01AaK9DPyUsG7sZZPHidc45Q`). Test commands: `npx vitest run <path>`, `venv/bin/pytest <path>`; whole: `npm test`, `npm run lint`, `npx vue-tsc --noEmit`, `venv/bin/pytest`.

## Review Focus

1. A pasted list from Word/Excel/a PDF: Windows line endings, a BOM, blank lines, a heading line without separator, a trailing separator, non-breaking spaces. Expect: pairs read, blank lines ignored, unreadable lines marked and not kept. (Task 4)
2. The device changes hands or loses the server mid-visit: his results must wait for **him** and be counted once when the server is back. (Task 5)
3. The same word in two of his lists, or in his list and a built-in one: "Alle meine Wörter" asks it once; progress is shared. (Task 4)
4. The younger child's game unchanged: Kindergarten doors, School and parents' card exactly as before. (Tasks 1, 6, 8)
5. The iPad keyboard: Enter submits, an empty answer is ignored (not wrong), the accent buttons insert at the caret and keep the keyboard open. (Task 7)

---

### Task 1: The level on the server, doors at Oberstufe, the Star cap

**Files:**
- Modify: `backend/app/db.py` (new migration), `backend/app/game.py`, `backend/app/buildings.py`, `backend/app/main.py`, `backend/app/people.py` (listing includes `level`), `shared/buildings.json`
- Test: `tests/test_level.py` (new)

**Interfaces:**
- Produces: `players.level TEXT NOT NULL DEFAULT 'kindergarten'`; `State.level: str` in `/api/state` and in `/api/players` rows; `RulesIn.level: Literal['kindergarten','oberstufe'] | None` (absent keeps it); `shared/buildings.json` entries gain `"oberstufe": {}` (open as is) or `"oberstufe": { "maxStars": 15 }` (school); `Building.oberstufe: bool`, `Building.oberstufe_max_stars: int | None`; refusal code `soon` (HTTP 409 `{"error": "soon"}`) for `/api/visits`, `/api/free-visits`, `/api/plays`, `/api/shop/buy`, `/api/moebel/buy` when the child is at Oberstufe and the building has no `oberstufe` entry.

- [ ] **Step 1: Write the failing tests** in `tests/test_level.py`, using the fixtures of `tests/conftest.py` the other tests use:
  - `test_every_child_starts_at_kindergarten`: `/api/state` → `level == "kindergarten"`.
  - `test_parent_sets_level`: `PUT /api/players/{id}` with `level: "oberstufe"` → state says `oberstufe`; a PUT without `level` keeps it; `level: "gymnasium"` → 422.
  - `test_oberstufe_school_gives_up_to_15`: at Oberstufe a school visit with stars 15 earns 15, with 20 earns 15; at Kindergarten 15 earns 10.
  - `test_soon_buildings_refused_at_oberstufe`: at Oberstufe a visit to `reimhaus` → 409 `soon`; a free visit to `ausmalen` → 409 `soon`; a play in `arcade` → 409 `soon`; a free visit to `malen` and `haus` → 200.
  - `test_kindergarten_unchanged`: at Kindergarten the same reimhaus/ausmalen/arcade calls behave as before (200 / locked as today).
- [ ] **Step 2: Run** `venv/bin/pytest tests/test_level.py -q` — Expected: FAIL (no `level`).
- [ ] **Step 3: Implement.** Migration appended to the list in `db.py` (`ALTER TABLE players ADD COLUMN level TEXT NOT NULL DEFAULT 'kindergarten'`); `State.level` read in `_row` (default `'kindergarten'` with no row) and written in `_store`; `set_rules` takes `level: Optional[str]`; in `game.visit` the cap is `building.oberstufe_max_stars or building.max_stars` at Oberstufe; one helper `game.check_open(state, building)` raising `Refused("soon")`, called by every route above (map `Refused("soon")` to 409 like the existing refusals). Add `"oberstufe"` to `school` (`{"maxStars": 15}`), `malen`, `haus`, `laden`, `moebel` (`{}`).
- [ ] **Step 4: Run** `venv/bin/pytest -q` — Expected: all pass (existing tests untouched).
- [ ] **Step 5: Commit** `feat: a level per child, and the doors at Oberstufe on the server`

### Task 2: Vocabulary on the server

**Files:**
- Create: `backend/app/vocab.py`, `shared/vocab/boxes.json` (`{"days": [1, 2, 4, 8, 16, 32], "learned": 3, "maxBox": 5}`)
- Modify: `backend/app/db.py` (migration), `backend/app/main.py` (routes)
- Test: `tests/test_vocab.py` (new)

**Interfaces:**
- Produces (JSON shapes the page uses in Task 5):
  - `VocabList = {id: int, lang: 'en'|'fr', name: str, words: [{de: str, foreign: str}]}` (strings as typed after trimming; ` / ` kept inside)
  - `GET /api/vocab` → `{lists: VocabList[], progress: {[wordKey]: {box: int, due: 'YYYY-MM-DD'}}, seen: str[]}` (seen: latest 50 result keys, as `school.state`)
  - `POST /api/vocab/lists` body `{lang, name, words}` → `VocabList`; `PUT /api/vocab/lists/{id}` same body → `VocabList`; `DELETE /api/vocab/lists/{id}` → 204. Refusals 422 `{error}`: `too-many` (31st list in a language), `too-long` (name > 40, side > 60, > 60 words), `empty` (no name or no words), `bad-lang`. Another child's list → 404.
  - `POST /api/vocab/results` body `{key: str, lang, answers: [{word: str, right: bool}]}` → same shape as `GET /api/vocab`; counted once per key (keys kept 60 days, as `school_keys`).
  - `GET /api/players/{id}/vocab` (parents, `auth.parent`) → same shape as `GET /api/vocab` without `seen`.
- `vocab.next_box(box: int, right: bool, today: date) -> tuple[int, str]` per the Global Constraints table, reading `shared/vocab/boxes.json`.

- [ ] **Step 1: Write the failing tests** in `tests/test_vocab.py`:
  - `test_next_box_follows_the_table`: `(0,True)→(1,+1)`, `(1,True)→(2,+2)`, `(2,True)→(3,+4)`, `(3,True)→(4,+8)`, `(4,True)→(5,+16)`, `(5,True)→(5,+32)`, `(4,False)→(1,+1)`, `(0,False)→(1,+1)`.
  - `test_lists_are_his_own`: child A's list is not in child B's `GET /api/vocab`; B's PUT/DELETE of it → 404.
  - `test_list_limits`: 30 lists in `en` fine, 31st → `too-many`, while `fr` still takes one; 61 words → `too-long`; a side of 61 chars → `too-long`; empty name → `empty`; `lang: "de"` → `bad-lang` (or 422).
  - `test_results_move_boxes_once`: results with key `k` move a word to box 1 due tomorrow; the same key again changes nothing; the key is in `seen`.
  - `test_parents_see_his_vocab`: a parent's `GET /api/players/{id}/vocab` has his lists and progress; a child calling it → 403.
- [ ] **Step 2: Run** `venv/bin/pytest tests/test_vocab.py -q` — Expected: FAIL (no module / 404).
- [ ] **Step 3: Implement** tables `vocab_lists (id INTEGER PRIMARY KEY, person_id, lang, name, position)`, `vocab_words (list_id, position, de, foreign)`, `vocab_progress (person_id, lang, word, box, due, PRIMARY KEY (person_id, lang, word))`, `vocab_keys (person_id, key, day, PRIMARY KEY (person_id, key))`; routes with `auth.current_person` / `auth.parent` as their neighbours; `vocab.py` docstring says the page keeps the same rules (`src/core/vocab/boxes.ts`) and the server is the truth. A word key's language must match the result's `lang` (prefix check), else the answer is skipped.
- [ ] **Step 4: Run** `venv/bin/pytest -q` — Expected: all pass.
- [ ] **Step 5: Commit** `feat: vocabulary lists and progress on the server`

### Task 3: The built-in lists

**Files:**
- Create: `shared/vocab/en.json`, `shared/vocab/fr.json`
- Test: `src/core/vocab/builtin.test.ts`, `src/core/vocab/builtin.ts`

**Interfaces:**
- File shape: `{ "lang": "en", "topics": [{ "id": "travel", "name": "Reisen", "words": [{ "id": "station", "de": "der Bahnhof", "foreign": "railway station / train station" }] }] }`
- Produces: `BUILTIN: Record<'en'|'fr', BuiltinTopic[]>` and `builtinWords(lang): VocabWord[]` where `VocabWord = { key: string; de: string; foreign: string; source: string }` (key `<lang>:<topic>:<id>`, source = topic id). `VocabWord` is defined in `src/core/vocab/types.ts` (created here, used by Tasks 4–8).

- [ ] **Step 1: Write the failing tests** in `builtin.test.ts`:
  - each language has exactly these 12 topic ids: `travel, school, family, freetime, food, jobs, health, home, town, nature, shopping, feelings`, German names, 22–28 words each;
  - word ids unique within a topic; no empty side; every side ≤ 60 chars;
  - every French noun entry (German side starting with `der `, `die `, `das `) has a French side starting with `le `, `la `, `l'`, `les `, `un `, `une `;
  - every English entry whose German side ends in `-en` and has no article (a verb) starts with `to ` (allow a list of explicit exceptions in the test, at most 10);
  - no English entry contains a French accent letter from the accent-button set, and the two files share no foreign side (never mixed).
- [ ] **Step 2: Run** `npx vitest run src/core/vocab/builtin.test.ts` — Expected: FAIL (files missing).
- [ ] **Step 3: Write the lists**: A2 level, words a Swiss 9th-grader meets in *Open World* / *dis donc!*-style units; British spelling for English. Write `builtin.ts` to import both files.
- [ ] **Step 4: Run** the test — Expected: PASS.
- [ ] **Step 5: Commit** `feat: built-in English and French lists`

### Task 4: The trainer's rules (pure)

**Files:**
- Create: `src/core/vocab/parse.ts`, `answer.ts`, `boxes.ts`, `round.ts` with `*.test.ts` beside each

**Interfaces:**
- Consumes: `VocabWord` (Task 3), `shared/vocab/boxes.json` (Task 2).
- Produces:
  - `parseList(text: string): { pairs: {de: string; foreign: string}[]; bad: number[] }` (bad = 1-based line numbers of non-empty unreadable lines)
  - `ownKey(lang: Lang, foreign: string): string` → `<lang>:own:<first answer, lower case, spaces collapsed>`
  - `ownWords(lists: VocabList[], lang: Lang, listId?: number): VocabWord[]` (deduplicated by key, lists in id order, then position; source `own:<listId>`)
  - `checkAnswer(typed: string, expected: string, opts: { lang: Lang | 'de' }): { verdict: 'right' | 'accent' | 'wrong'; shown: string; marks: number[] }` (`shown` = the first alternative; `marks` = indices in `shown` whose letters differ only by accent; `'accent'` counts as wrong)
  - `nextBox(box: number, right: boolean, today: string): { box: number; due: string }` (same table as the server)
  - `buildRound(words: VocabWord[], progress: Progress, today: string, rand: () => number): RoundItem[]` with `RoundItem = { word: VocabWord; mode: 'choice' | 'type-de' | 'type-foreign'; choices?: string[] }` (`type-de`: German shown, he types the foreign word); `choices` drawn per `pickChoices(word, pool: VocabWord[], rand)` — pool = the source first, then the rest of the same language.
- [ ] **Step 1: Write the failing tests**:
  - `parse.test.ts`: tab, ` - `, ` – `, ` = `, `;` each split; `"a\tb - c"` splits at the tab; CRLF, BOM, ` `, blank lines handled; `"Unit 3"` (no separator) is bad line 1 and not kept; `"Haus - "` bad.
  - `answer.test.ts`: `"Railway Station "` right for `railway station / train station` (shown `railway station`); `"train station."` right; `"travel"` right for `to travel`; `"l'ecole"` for `l'école` → `accent` with marks `[2]` (the `é`); `"Muhle"` for `die Mühle` (lang `de`) → `accent`; `"la gar"` → wrong; empty string → wrong (the UI ignores it).
  - `boxes.test.ts`: the table, as in Task 2 (same eight cases).
  - `round.test.ts`: with 3 due, 20 new and 10 not-due words, the round is the 3 due (oldest first), 4 new (list order), 3 not-due (soonest first); a source of 6 words gives 6; box 0/1 → `choice` with 4 distinct choices incl. the answer, none from the other language; box ≥ 2 alternate `type-de`, `type-foreign`; the same key never twice.
  - `ownWords`: a word in two lists appears once.
- [ ] **Step 2: Run** `npx vitest run src/core/vocab` — Expected: FAIL.
- [ ] **Step 3: Implement.** Accent comparison by NFD and dropping combining marks (`/\p{M}/gu`); `œ` vs `oe` counts as `accent`.
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `feat: the vocabulary trainer's rules`

### Task 5: Level and vocabulary on the page (API, player, store)

**Files:**
- Modify: `src/services/api.ts`, `src/services/fakeApi.ts`, `src/stores/player.ts`, `src/services/tts.ts`
- Create: `src/stores/vocab.ts`, `src/stores/vocab.test.ts`
- Test: `src/stores/player.test.ts`, `src/services/api.test.ts`, `src/services/tts.test.ts`

**Interfaces:**
- Consumes: Task 2's routes and shapes; Task 4's `nextBox`.
- Produces: `ServerState.level`; `player.level: Ref<'kindergarten'|'oberstufe'>`; `Api.vocab()`, `Api.createList(body)`, `Api.updateList(id, body)`, `Api.deleteList(id)`, `Api.vocabResults(body)`, `Api.playerVocab(personId)`; `Rules.level?`; `useVocabStore()` with `{ lists, progress, who, init(api, personId, storage?), load(), saveList(draft): Promise<'ok' | 'away' | RefusalCode>, deleteList(id): Promise<'ok' | 'away'>, record(lang, answers, personId?) }` — `record` lays the answers over `progress` at once via `nextBox` and sends them, waiting under `brightville.vocab.<personId>` exactly as `ladders.ts` does (same flying/generation/numbering rules); `hasVoice(lang: string): boolean` in `tts.ts` (a voice whose `lang` starts with `en` / `fr`).
- [ ] **Step 1: Write the failing tests**: player takes `level` from the state (default `kindergarten` when absent); store: `record` moves progress at once, sends once, a refused send is let go, an `away` send waits and goes with the next `load`, results recorded for another child wait under that child's key and don't touch the shown progress; `saveList` returns `'away'` without a server; `hasVoice('en-GB')` true/false with a stubbed `speechSynthesis.getVoices()`; `fakeApi` serves the new routes (in memory).
- [ ] **Step 2: Run** `npx vitest run src/stores src/services` — Expected: FAIL.
- [ ] **Step 3: Implement**, following `ladders.ts`; init the vocab store wherever the ladders store is initialised and loaded (`App.vue`).
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: the level and the vocabulary on the page`

### Task 6: Doors at Oberstufe on the page

**Files:**
- Modify: `src/core/access.ts`, `src/buildings/types.ts`, `src/buildings/registry.ts`, `src/App.vue`, `src/components/DoorPrompt.vue`, `src/components/TownMap.vue`, `src/city/mapPicture.ts`
- Test: `src/core/access.test.ts`, `src/buildings/registry.test.ts`, `src/components/DoorPrompt.test.ts`, `src/components/TownMap.test.ts`, `src/App.test.ts`

**Interfaces:**
- Consumes: `player.level` (Task 5); `shared/buildings.json` `oberstufe` (Task 1).
- Produces: `DoorState` gains `'soon'`; `doorState(building, canServe, goalReached, stars, timeUp, level = 'kindergarten')` returns `'soon'` at Oberstufe for a building without Oberstufe content (checked after `unavailable`, before everything else); `BuildingDef.oberstufe?: { component?: Component; preload?: () => Promise<unknown> }` (present = open at Oberstufe; `component` absent = the same component), filled for exactly the buildings with `oberstufe` in `shared/buildings.json`; `stateOf`/`toDoors` take `level`; App mounts `b.oberstufe?.component ?? b.component` at Oberstufe. The School's Oberstufe component is `() => import('./vokabeln/Vokabeln.vue')` (Task 7 creates it; create a placeholder that emits `finished` with 0 Stars here so the build stays green).
- [ ] **Step 1: Write the failing tests**: `doorState` → `'soon'` for reimhaus/arcade/ausmalen at Oberstufe, `'open'` for school/malen/haus, shop rules unchanged; at Kindergarten every case as before; a registry test that `BUILDINGS` with `oberstufe` match `shared/buildings.json` exactly; DoorPrompt shows `Bald` (`data-test="soon"`) and the dimmed icon, and no tap; the map marker of a `soon` building shows `Bald` and a tap on it says (voice, as today's closed doors) nothing rides; App at Oberstufe mounts the vokabeln component for the school.
- [ ] **Step 2: Run** the listed tests — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: the doors at Oberstufe`

### Task 7: The Vokabeln building

**Files:**
- Create: `src/buildings/vokabeln/Vokabeln.vue` (the screens' switch), `LanguagePick.vue`, `Shelf.vue`, `ListEditor.vue`, `Round.vue`, `AccentKeys.vue`, `roundFlow.ts` (pure state machine like `school/flow.ts`), with tests `Vokabeln.test.ts`, `roundFlow.test.ts`, `ListEditor.test.ts`, `AccentKeys.test.ts`

**Interfaces:**
- Consumes: `useVocabStore` (Task 5), `buildRound`, `checkAnswer`, `parseList`, `ownWords`, `builtinWords` (Tasks 3–4), `speak(text, lang)`, `hasVoice` (Task 5), `useVisit` and `emit('finished', { stars })` as the School does.
- Produces: `createRoundFlow(items: RoundItem[]): { state, answer(text: string), choose(choice: string), retype(text: string), next() }` with `state = { index, phase: 'asking' | 'right' | 'wrong' | 'retype' | 'done', firstTry: { key: string; right: boolean }[], stars }`; the language last chosen kept on the device under `brightville.vocab.lang.<personId>` (try/catch).
- Screens: language pick (🇬🇧 Englisch / 🇫🇷 Französisch) → shelf (his lists, "Alle meine Wörter" when he has some, 📘 built-in topics, "Neue Liste") → round or editor. Editor: name field, big text box, live preview of `parseList` with bad lines marked, Speichern (shows `'away'` as "Keine Verbindung – später nochmal", refusals in words), Löschen with one confirm. Round: progress stars, the prompt, 🔊 when `hasVoice`, choices or a text field; Enter submits, empty ignored; French shows `AccentKeys` (insert at the caret, `pointerdown.prevent` so the field keeps focus); wrong → right answer shown (accent marks highlighted) and spoken, he types it to go on; end screen "X von Y gewusst" and Stars, then leaves with `finished`.
- [ ] **Step 1: Write the failing tests**:
  - `roundFlow.test.ts`: right first try → star +1, `firstTry` right; wrong → phase `wrong`, then `retype` accepts only the right answer, the word is appended once at the end, its second answer gives no star and is not in `firstTry` twice; 10 of 10 right → stars 15; 9 of 10 → 9; `accent` verdict counts as wrong.
  - `ListEditor.test.ts`: pasting three lines with one bad shows two pairs and marks line 2; Speichern calls `saveList` with the pairs; `'too-many'` is shown in German words.
  - `AccentKeys.test.ts`: tapping `é` with caret between `l'` and `cole` gives `l'école` and the caret after `é`.
  - `Vokabeln.test.ts`: English picked → shelf shows only English lists and English built-ins, never French; a full round on the fake API ends with `finished` and the store's `record` called once with only first-try answers; the voice speaks foreign words with `en-GB` (never `fr-FR` in an English round); no German `instruct` calls.
- [ ] **Step 2: Run** `npx vitest run src/buildings/vokabeln` — Expected: FAIL.
- [ ] **Step 3: Implement**; styles responsive at 1024×768 and with the iPad keyboard up (the field stays visible: layout the round in the upper half).
- [ ] **Step 4: Run** `npm test && npm run lint && npx vue-tsc --noEmit` — Expected: all clean.
- [ ] **Step 5: Commit** `feat: the vocabulary trainer in the School`

### Task 8: The parents' page

**Files:**
- Modify: `src/components/ParentArea.vue`
- Create: `src/components/VocabOverview.vue`, `VocabOverview.test.ts`
- Test: `src/components/ParentArea.test.ts`

**Interfaces:**
- Consumes: `Api.playerVocab`, `Rules.level`, `/api/players` rows with `level` (Tasks 1, 5); `builtinWords`, `ownWords` (Tasks 3–4).
- Produces: a "Stufe" select (Kindergarten / Oberstufe) next to the daily goal, saved with the rules; at Oberstufe the card shows `VocabOverview` instead of `LehrplanOverview` and `WritingSettings`; `VocabOverview` (folded `<details>` "Sprachen"): per language "N Wörter gelernt" (box ≥ 3, over words that exist now), "M heute fällig", and his lists folded with their pairs.
- [ ] **Step 1: Write the failing tests**: changing Stufe and saving sends `level: 'oberstufe'`; a Kindergarten child's card is unchanged (Lehrplan and Schreiben shown, no Sprachen); VocabOverview counts learned/due from a fixture and lists his lists.
- [ ] **Step 2: Run** the two tests — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** `npm test` — Expected: PASS.
- [ ] **Step 5: Commit** `feat: the level and his languages on the parents' page`

### Task 9: Docs and a check in the browser

**Files:**
- Modify: `README.md` (a section "Oberstufe" after the building table: level, open doors, the trainer, his lists, built-in lists, Stars, parents), `docs/roadmap.md` (piece 1 done; pieces 2–5 listed; first guesses: the built-in lists, box intervals, 4 new per round; to try on the iPad: typing with the keyboard up, accent buttons, voices)
- [ ] **Step 1:** Write both.
- [ ] **Step 2:** `npm run dev` is the user's; instead build and preview on port 5188 with `LOCAL_MODE`-style fake data as earlier checks did, open the School at Oberstufe at 1024×768, run one English and one French round and the list editor, and look at screenshots. Expected: no console errors, field visible, no French in the English round.
- [ ] **Step 3: Run** `npm test && npm run lint && npx vue-tsc --noEmit && venv/bin/pytest -q` — Expected: all clean.
- [ ] **Step 4: Commit** `docs: README and roadmap for the Oberstufe`
