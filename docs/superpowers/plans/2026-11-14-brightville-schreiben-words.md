# Schreiben: Her Words, Sentences and Letter Levels – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Schreibhaus offers her own words and sentences (written by the parents) besides the 🎲 round, and every letter has a level per child that sets how much help she gets, with paced introduction of new letters.

**Architecture:** The server (`backend/app/writing.py`) is the truth for the list of texts and the letter levels; it applies the three-in-a-row rule and the daily new-letter pacing. The same pure rules live in `src/core/writing/levels.ts` so the page can keep going offline; a Pinia store (`src/stores/writing.ts`) mirrors the server with an outbox of counted writes and finished introductions. Schreiben.vue gets a menu, a word mode with an ink row, a fourth help level and bumpy/clean detection; the parents' page gets an editor and a letter grid.

**Tech Stack:** Vue 3 `<script setup>`, Pinia, Vitest + jsdom (fake timers), vue-tsc, ESLint; FastAPI, Pydantic, sqlite3, pytest, black, flake8, mypy.

**Spec:** `docs/superpowers/specs/2026-11-14-brightville-schreiben-words-design.md`

## Global Constraints

- German voice and visible text, English code and comments; no CDN.
- Glyphs: A–Z, Ä, Ö, Ü, 0–9 (the keys of `basisschrift.json`); texts also allow single spaces. No lowercase, no punctuation, ß refused.
- Texts: trimmed, double spaces collapsed, lowercase turned to capitals (ä→Ä), at most **30** characters, at most **20** texts per child, no duplicates. New children: empty list.
- Levels: 0 new, 1 full, 2 dots, 3 start, 4 known. Three clean in a row → up one (max 4); three bumpy in a row → down one (min 1); the other kind resets the streak.
- Pacing: new letters per day = 2, but 1 while ≥3 letters are at level 1, and 0 while ≥5 are at level 1; minus those introduced today (server date `clock.today()`), floor 0.
- An introduction counts only after all three intro writes; intro writes and writes of level-0 letters in words never move levels.
- Stars: 1 per letter written + 4 for finishing all (`starsFor` in `session.ts`); `shared/buildings.json` stays `maxStars` 10, `minSecondsPerStar` 1.5.
- New tables only through a new entry appended to `MIGRATIONS` in `backend/app/db.py`.
- Python checks: `black`, `flake8 --max-line-length=120 --extend-ignore=E203,W503`, `mypy`, run from `/home/andreas/work/brightville/venv/bin`. Front: `npm test`, `npx vue-tsc --noEmit`, `npx eslint .`.
- Check servers only on ports 8017–8019 / 5186–5188 with a scratchpad `DATA_DIR`; never touch 8000/5173.

## Review Focus

1. **The same write sent twice** (reload mid-visit, retry after a lost answer): a write key the server has seen counts once. → test in Task 1 (`test_a_write_counts_once_per_key`).
2. **A third introduction the same day from a second device**: the server answers 409 `no_new_today`; the store drops it from its outbox and reloads, the child sees nothing. → tests in Task 1 and Task 3.
3. **Parents typing "lena", "  Mia  Ben ", "Grüße" or "ä"**: normalized to `LENA`, `MIA BEN`, refused (ß), `Ä`. → tests in Task 1 (server) and Task 2 (`checkText`).
4. **She leaves during an introduction** (after one or two of the three writes): no introduction is reported, the letter stays new and comes first next visit. → test in Task 5.
5. **The server is away when she enters**: the Schreibhaus still opens (after the store's patience) with what the device knows; an empty store means no menu and a 🎲 round from scratch. → test in Task 5.

---

### Task 1: Server – texts, levels, pacing

**Files:**
- Modify: `backend/app/db.py` (append a migration)
- Create: `backend/app/writing.py`
- Modify: `backend/app/main.py` (models + 5 routes)
- Test: `tests/test_writing.py`

**Interfaces:**
- Produces (HTTP):
  - `GET /api/writing` (current person) → `WritingState`:
    `{"texts": [str], "letters": {glyph: {"level": int, "streak": int, "practised_at": str|null}}, "new_left_today": int}` — only introduced glyphs appear in `letters`.
  - `POST /api/writing/writes` body `{"writes": [{"key": str(1..64), "glyph": str(max 2), "level": int 1..4, "clean": bool}]}` (max 50) → `WritingState`. A write counts only if its key is unseen, the glyph is introduced and `level` equals its current level; otherwise ignored (still 200).
  - `POST /api/writing/introduced` body `{"glyph": str, "key": str}` → `WritingState`; already introduced or seen key → no-op 200; unknown glyph → 404 `unknown`; pacing exhausted → 409 `no_new_today`.
  - `GET /api/players/{id}/writing` (parent) → `WritingState`; `PUT /api/players/{id}/writing/texts` (parent) body `{"texts": [str]}` (max 20 items, each max 60 before normalizing) → `WritingState`; invalid → 422 with `detail.code` in `empty | letters | too-long | exists | too-many`; inactive person → 404 `unknown_person`.
- Produces (Python): `writing.normalize(text: str) -> str`, `writing.check(texts: list[str]) -> list[str]` (raises `game.Refused(code)`), `writing.state(db, pid) -> dict`, `writing.record(db, pid, writes) -> None`, `writing.introduce(db, pid, glyph, key) -> None`, `writing.new_left_today(db, pid) -> int`.

- [ ] **Step 1: Write the failing tests** in `tests/test_writing.py` (use the `mia` and parent fixtures as `tests/test_room.py` does):
  - `test_a_new_child_has_no_texts_and_two_new_letters` → `{"texts": [], "letters": {}, "new_left_today": 2}`.
  - `test_parents_set_texts_normalized`: PUT `["lena", "  ich  mag dich ", "Ä"]` → texts `["LENA", "ICH MAG DICH", "Ä"]`; the child's GET shows the same.
  - `test_refused_texts`: `"Grüße"`→`letters`, `""`/`"  "`→`empty`, 31 chars→`too-long`, `["MIA","mia"]`→`exists`, 21 texts→`too-many`; a child calling PUT → 403.
  - `test_introducing_puts_a_letter_at_level_one` and `test_two_new_letters_a_day_then_409` (third → 409 `no_new_today`; after `set_time` to the next day → allowed again).
  - `test_pacing_holds_back` : 3 letters at level 1 → `new_left_today` 1; 5 at level 1 → 0 (insert rows directly with sqlite, `introduced_on` yesterday).
  - `test_three_clean_up_three_bumpy_down`: clean×3 at level 1 → level 2 streak 0; bumpy×3 at 2 → 1; bumpy×3 at 1 → stays 1; clean, clean, bumpy → streak -1, level unchanged; clean at 4 ×3 → stays 4.
  - `test_writes_at_another_level_or_for_new_letters_are_ignored`.
  - `test_a_write_counts_once_per_key`.
  - `test_practised_at_is_set_by_a_counted_write`.
- [ ] **Step 2: Run** `venv/bin/pytest tests/test_writing.py -q` → FAIL (404s / import errors).
- [ ] **Step 3: Implement.** Migration:

```sql
CREATE TABLE writing_texts (person_id INTEGER NOT NULL, position INTEGER NOT NULL, text TEXT NOT NULL,
    PRIMARY KEY (person_id, position));
CREATE TABLE writing_letters (person_id INTEGER NOT NULL, glyph TEXT NOT NULL, level INTEGER NOT NULL,
    streak INTEGER NOT NULL DEFAULT 0, practised_at TEXT, introduced_on TEXT NOT NULL,
    PRIMARY KEY (person_id, glyph));
CREATE TABLE writing_keys (person_id INTEGER NOT NULL, key TEXT NOT NULL, PRIMARY KEY (person_id, key));
```

  `GLYPHS = set("ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ0123456789")`. Streak is signed (+clean, −bumpy). All writes inside `with writing(db):` (`BEGIN IMMEDIATE`). `PUT texts` replaces the whole list. `new_left_today`: base = 0 if count(level 1) ≥ 5, 1 if ≥ 3, else 2; minus count(introduced_on == today); max 0.
- [ ] **Step 4: Run** pytest (whole suite) + black/flake8/mypy → all pass.
- [ ] **Step 5: Commit** `feat: the server keeps her words and how well she knows each letter`.

### Task 2: Pure rules – levels, help, rounds, texts

**Files:**
- Create: `src/core/writing/levels.ts`, `src/core/writing/levels.test.ts`
- Modify: `src/core/writing/session.ts`, `src/core/writing/session.test.ts`

**Interfaces:**
- Produces:
  - `type Level = 0 | 1 | 2 | 3 | 4`; `interface LetterState { level: Level; streak: number; practised_at: string | null }`; `type Letters = Record<string, LetterState>`.
  - `applyWrite(s: LetterState, clean: boolean, at: string): LetterState` (same rule as the server).
  - `helpFor(level: Level): Help` — 0,1→`'full'`, 2→`'dots'`, 3→`'start'`, 4→`'none'`.
  - `MAX_TEXT = 30`, `MAX_TEXTS = 20`; `normalizeText(t: string): string`; `checkText(t: string, list: string[]): 'empty' | 'letters' | 'too-long' | 'exists' | 'too-many' | null` (on the normalized text).
  - In `session.ts`: `Help` gains `'none'`; `WritingTask` becomes `{ glyph: string; help: Help; intro?: boolean; counts?: boolean }` (`counts`: this write may move the level; `intro`: part of an introduction).
  - `buildDailyRound(o: { letters: Letters; texts: string[]; newLeft: number; rand: () => number }): WritingTask[]` — 2 glyphs × 3. New picks (up to `min(newLeft, 2)`): glyphs of `texts` in first-appearance order not in `letters`, then the other letters shuffled, then digits shuffled; each gets `full, dots, start` with `intro: true`. Remaining places: introduced glyphs sorted by level ascending, then `practised_at` ascending (null first); each 3× `helpFor(level)` with `counts: true`. If still short of 2, more new picks as intros.
  - `textTasks(text: string, letters: Letters): WritingTask[]` — one task per non-space character, `help: helpFor(level ?? 0)`, `counts: level ≥ 1`.
  - Keep `buildWritingSession` only if still used; otherwise remove it and its tests.
- [ ] **Step 1: Failing tests:** `applyWrite` table (same cases as Task 1); `helpFor`; `normalizeText(' ich  mag ä ') === 'ICH MAG Ä'`; `checkText('GRÜSSE', [])===null`, `checkText('Grüße', [])==='letters'`, 31 chars `'too-long'`, `'exists'`, `'too-many'` at 20; `buildDailyRound`: empty letters + texts `['LENA']` + newLeft 2 → glyphs `L`,`E` intro×3 each; newLeft 1 with `{A: level 1}` → `L` intro + `A` 3× `'full'` counts; newLeft 0 with levels `{A:2,B:1,C:1}` and C practised earlier than B → `C`, `B`; letters already introduced are skipped as new picks; `textTasks('MIA BEN', {M:{level:4…}})` → 6 tasks, M `'none'` counts, others `'full'` not counting.
- [ ] **Step 2: Run** `npx vitest run src/core/writing` → FAIL.
- [ ] **Step 3: Implement** as above.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: letter levels, the daily round and her texts as writing tasks`.

### Task 3: API client, fake server and the writing store

**Files:**
- Modify: `src/services/api.ts`, `src/services/fakeApi.ts`
- Create: `src/stores/writing.ts`, `src/stores/writing.test.ts`
- Modify: `src/App.vue` (`writing.init(props.api, id)` next to `room.init`)

**Interfaces:**
- Consumes: Task 1 HTTP, Task 2 `Letters`, `applyWrite`.
- Produces:
  - `Api`: `writing(): Promise<WritingState>`, `sendWrites(writes: WriteIn[]): Promise<WritingState>`, `introduced(glyph: string, key: string): Promise<WritingState>`, `playerWriting(id: number): Promise<WritingState>`, `setPlayerTexts(id: number, texts: string[]): Promise<WritingState>`; `interface WritingState { texts: string[]; letters: Letters; new_left_today: number }`; `interface WriteIn { key: string; glyph: string; level: number; clean: boolean }`. The fake API implements the same rules (reuse `applyWrite`, `normalizeText`, `checkText`).
  - `useWritingStore()`: refs `texts`, `letters`, `newLeft`, `loaded`; `init(api, personId, storage?)`; `load(): Promise<void>` (sends what waits first, then GET; `PATIENCE_MS` 5000 like `room.ts`); `recordWrite(glyph: string, level: Level, clean: boolean): void` (applies locally, queues, sends); `introduce(glyph: string): void` (level 1 locally, `newLeft--`, queues, sends).
  - Outbox in localStorage `brightville.writing.<personId>`: `{ writes: WriteIn[], intros: {glyph, key}[] }`; an entry leaves on success or a 4xx refusal (409 → reload); answers are taken only for the current owner and when no newer local change happened (the `changes` counter, as in `room.ts`); `overlay()` re-applies waiting writes/intros onto a server state.
- [ ] **Step 1: Failing tests** (`writing.test.ts`, with `fakeApi`): load fills texts/letters/newLeft; `recordWrite` ×3 clean moves the level up locally and on the server; offline write waits and is sent on the next `load`; a refused intro (409) is dropped and the store reloads; an answer for a previous child after `init` of another is ignored; a write sent twice by a reload counts once on the fake server.
- [ ] **Step 2–4:** run `npx vitest run src/stores/writing.test.ts src/services` FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat: the writing store keeps her levels, also offline`.

### Task 4: The board – no help, the revealed dot, clean or bumpy

**Files:**
- Modify: `src/buildings/schreiben/letterCanvas.ts` (+ its test if present), `src/buildings/schreiben/Schreiben.vue`, `src/buildings/schreiben/Schreiben.test.ts`

**Interfaces:**
- Consumes: `Help` with `'none'`, `WritingTask.counts`, `useWritingStore().recordWrite`.
- Produces: `drawLetter` draws nothing of the letter but her ink for `'none'`. Schreiben.vue keeps per letter `bumpy: boolean` and `revealed: boolean`.
  - Bumpy when: a refused `penDown` with `wrong-end` or `far-from-start`; at help `'none'` also `off-letter` (then `revealed = true`, the board draws as `'start'`, speak `'Fang beim grünen Punkt an.'` within `HINT_GAP_MS`); a `too-short` lift with progress ≥ `SMALL_TRY`. `too-big`, `pen-busy` and small taps never.
  - On finishing a letter whose task has `counts`, call `recordWrite(glyph, level, !bumpy)` where level is the store's current level for the glyph.
- [ ] **Step 1: Failing tests:** a task with `help: 'none'` + touch off the letter → `data-revealed="true"` on the root and the hint spoken; a clean write of a counting task calls `recordWrite(..., true)`; starting at the wrong end then finishing → `recordWrite(..., false)`; a non-counting task records nothing.
- [ ] **Step 2–4:** run `npx vitest run src/buildings/schreiben` FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat: letters she knows come without help, and each write counts as clean or bumpy`.

### Task 5: The menu, word writing and introductions

**Files:**
- Create: `src/buildings/schreiben/WritingMenu.vue`, `src/buildings/schreiben/InkRow.vue` (+ tests)
- Modify: `src/buildings/schreiben/Schreiben.vue`, `Schreiben.test.ts`

**Interfaces:**
- Consumes: store (`texts`, `letters`, `newLeft`, `loaded`, `load`, `introduce`), `buildDailyRound`, `textTasks`, `starsFor`.
- Produces:
  - `WritingMenu.vue` props `{ texts: string[] }`, emits `choose: [text: string | null]` (null = 🎲). Cards `data-test="text-card"` and `data-test="dice-card"`; ≥ 44 px; spoken welcome via `instruct('Was möchtest du schreiben? Tipp auf eine Karte.')`; tapping a text card speaks nothing itself (Schreiben does).
  - `InkRow.vue` props `{ text: string; inks: Point[][][]; current: number; view: ViewBox }`: one slot per character, spaces as gaps, finished slots draw the ink (small canvas or SVG polyline), the current slot highlighted, wraps on narrow screens.
  - Schreiben.vue: prop `tasks` stays for tests (skips the menu). Otherwise on mount: `await store.load()` (shows a quiet waiting state until `loaded`), then the menu if `texts.length`, else the 🎲 round. 🎲: `buildDailyRound({letters, texts, newLeft, rand: seededRandom(Date.now())})`. Text: `textTasks(text, letters)` and `instruct('Wir schreiben: ' + spoken(text) + '!')` where `spoken` lowercases and capitalises the first letter; before each letter `Jetzt ${say}.`; at a new word `Jetzt das Wort ${spoken(word)}.`; at the end cheer + confetti + the whole text spoken.
  - Introductions: after the third intro write of a glyph, `store.introduce(glyph)`; leaving earlier reports nothing.
  - Stars: `starsFor(written, tasks.length)` in both modes.
- [ ] **Step 1: Failing tests:** with texts `['MIA']` the menu shows 1 text card + dice; choosing `MIA` puts `M` on the board with its help, and the ink row has 3 slots; writing all 3 → `finished` with 7 Stars; `'MIA BEN'` → a gap slot and `Jetzt das Wort Ben.` spoken; dice with an empty store introduces two glyphs and calls `introduce` twice after 6 writes; leaving after 2 writes of an intro → `introduce` not called (Review Focus 4); no texts → no menu; server away → after 5 s the 🎲 round starts (Review Focus 5).
- [ ] **Step 2–4:** run → FAIL → implement → PASS; also check at 1024×768 and 1440×900 with the scratchpad Playwright harness (`?b=schreiben`), long sentence wraps.
- [ ] **Step 5: Commit** `feat: Schreiben offers her words and sentences, and introduces new letters paced`.

### Task 6: The parents' page – her texts and the letter grid

**Files:**
- Create: `src/components/WritingSettings.vue`, `src/components/WritingSettings.test.ts`
- Modify: `src/components/ParentArea.vue`

**Interfaces:**
- Consumes: `api.playerWriting`, `api.setPlayerTexts`, `normalizeText`, `checkText`, `LETTERS`, `DIGITS`.
- Produces: `WritingSettings.vue` props `{ api: Api; personId: number }`, a `<details data-test="writing">` in each CHILD card (loads when opened, like the diary). List items `data-test="text-item"` with ↑ ↓ ✕ buttons; input + „Hinzufügen“; each change sends the whole list (`setPlayerTexts`) and shows the server's answer; an error shown in German:
  `empty` „Bitte etwas eingeben.“ · `letters` „Nur Grossbuchstaben A–Z, Ä, Ö, Ü, Zahlen und Leerzeichen.“ · `too-long` „Höchstens 30 Zeichen.“ · `exists` „Das steht schon in der Liste.“ · `too-many` „Höchstens 20 Einträge.“ · failed request „Konnte nicht speichern. Nochmal versuchen?“.
  Grid `data-test="letter-tile"` × 39 with `data-level`, colours grey (new) → four steps to green (known), legend „neu · ganzer Buchstabe · Punkte · Startpunkt · kann sie“.
- [ ] **Step 1: Failing tests:** opening loads and lists texts; adding `lena` sends `[..., 'LENA']`; `Grüße` shows the letters error and sends nothing; ↑ reorders; ✕ removes; the grid shows 39 tiles with the right `data-level`; not shown for a PARENT row.
- [ ] **Step 2–4:** run → FAIL → implement → PASS.
- [ ] **Step 5: Commit** `feat: parents write her words and see which letters she knows`.

### Task 7: Docs and full check

**Files:** `README.md` (Schreiben section and the buildings table row), `docs/roadmap.md` (lowercase as a later step; Spielzeugkiste word writing ported), memory not in repo.

- [ ] **Step 1:** Update the README Schreiben section: menu, word writing, levels table, three-in-a-row, pacing, parents' editor.
- [ ] **Step 2:** Run everything: `npm test`, `npx vue-tsc --noEmit`, `npx eslint .`, `venv/bin/pytest -q`, black/flake8/mypy → all green.
- [ ] **Step 3:** Commit `docs: Schreiben with her words and letter levels`.
- [ ] **Step 4:** Fresh opus reviewer on the whole branch; fix Critical/Important with tests; open the PR (Conventional Commits title, body ending with the attribution lines).
