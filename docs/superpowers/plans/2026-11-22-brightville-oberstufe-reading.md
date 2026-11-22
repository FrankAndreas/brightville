# Oberstufe Reading (Bibliothek) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At Oberstufe the Bibliothek is a reading room: short texts in English or French with a tap-for-German glossary and four questions in German, one text per visit, texts not yet read first.

**Architecture:** As the grammar PR (#69): an Oberstufe side (`BuildingDef.oberstufe.component`) and an `oberstufe` entry in `shared/buildings.json`; content in `shared/reading/<lang>.json`; the record kept by a new server module and a store made with `defineRoundStore` (`src/stores/rounds.ts`).

**Tech Stack:** Vue 3 `<script setup>` + Pinia + Vitest (jsdom); FastAPI + SQLite + pytest.

**Spec:** `docs/superpowers/specs/2026-11-22-brightville-oberstufe-grammar-reading-dates-design.md` (this plan is PR 2 of 3: the Bibliothek section, its doors entry and its parents' line)

## Global Constraints

- Never mix languages: a text, its glossary and voice are one language (`en`/`fr`) plus German; questions and answers are German (or numbers, times, names).
- Kindergarten unchanged: her Bibliothek (`src/buildings/bibliothek/`) as now; the Kalender stays "Bald" at Oberstufe in this PR.
- `bibliothek` gets `"oberstufe": { "maxStars": 10 }` (no `needs`: the voice only adds 🔊).
- Texts: the 12 topic ids and German names of the word lists, **3 texts per topic** (36 per language), about A2, 6–10 sentences, kinds that fit (e-mail, school-trip plan, menu, notice, short news item, diary entry), Swiss context where it fits; first drafts by Claude.
- A text = `{ id, title, sentences: string[6..10], glossary: { word, de }[8..15], questions: { question, answers: string[4], right: 0..3 }[4] }`; key `<lang>:<topic>:<id>`. Questions ask for what the text says, exactly one right answer.
- A visit: language → topic or "Gemischt" → one text (never read first, then read longest ago). The text stays on screen; questions one after another below it, answers in a new order each time. Tapping a glossary word shows its German next to it (free, as often as he likes). 🔊 per sentence only when the device has a voice for the language.
- After each answer: right or wrong (wrong: the right one marked), "Weiter"; a question doesn't come back. Stars +2 per question right, +2 for all four (cap 10).
- Record per child and text: times read, last day read, questions right last time. Sent and counted as before (a key per visit, waiting on the device, counted once).
- Parents' "Sprachen" per language: "M von 36 Texten gelesen".
- Commits end with the two attribution lines. Tests: `npx vitest run <path>`, `venv/bin/pytest <path>`; whole: `npm test`, `npm run lint`, `npx vue-tsc --noEmit`, `venv/bin/pytest -q`.

## Review Focus

1. A glossary word inside another word ("bus" in "business") or at a sentence start with a capital ("Station" / "station"), or a phrase across an apostrophe ("youth hostel", "l'auberge"): marked where it really stands, never inside another word. (Task 4)
2. A question whose answer is also given by another of its four choices (two choices both true from the text): never in the content. (Tasks 2, 3)
3. Leaving after two questions: those answers and their Stars count; the text counts as read. (Task 6)
4. All texts of a topic read: the next visit picks the one read longest ago, not always the same. (Task 4)
5. A device without an English voice: the text works, the 🔊 buttons don't show. (Task 6)

---

### Task 1: Server: the reading record and the door

**Files:** Create `backend/app/reading.py`; Modify `backend/app/db.py` (migration), `backend/app/main.py`, `shared/buildings.json`, `src/buildings/registry.ts` (`bibliothek.oberstufe = { component: Lesen, preload }`, placeholder `src/buildings/lesen/Lesen.vue` emitting `finished` 0 until Task 6), `src/core/access.test.ts`, `src/buildings/registry.test.ts`; Test `tests/test_reading.py`, `tests/test_level.py`

**Interfaces:**
- Produces: tables `reading_progress (person_id, text, reads INTEGER, last_read TEXT, last_right INTEGER, PRIMARY KEY (person_id, text))`, `reading_keys (person_id, key, day)`; `GET /api/reading` → `{ progress: { [text]: { reads, last_read, last_right } }, seen }`; `POST /api/reading/results` body `{ key, lang, answers: [{ text, right /* 0..4 */ }] }` (≤ 5 answers, text ≤ 120 chars, right 0..4) → same, counted once per key, a text of the other language or not `<lang>:<topic>:<id>` skipped; `GET /api/players/{id}/reading` (parents) → without `seen`.
- [ ] **Step 1: Failing tests:** `test_level.py::test_bibliothek_opens_at_oberstufe` (20 Stars → 10); `test_reading.py`: a result sets reads 1, last_read today, last_right; a second visit adds to reads and replaces last_right; same key twice counts once; `fr:` text in an `en` round skipped; right 5 → 422; parents see it, a child calling the parents' route → 403.
- [ ] **Step 2:** red. **Step 3:** implement as `backend/app/listen.py`; frontend door tests updated with the placeholder. **Step 4:** `venv/bin/pytest -q` and `npm test` → PASS. **Step 5:** Commit `feat: the reading record on the server, and the Bibliothek open at Oberstufe`

### Task 2: Reading content: schema, loader, English

**Files:** Create `shared/reading/en.json`, `shared/reading/fr.json` (empty `topics` until Task 3), `src/core/reading/texts.ts`, `texts.test.ts`

**Interfaces:**
- Produces: `ReadingText = { id; title; sentences: string[]; glossary: { word: string; de: string }[]; questions: { question: string; answers: string[]; right: number }[] }`; `READING: Record<Lang, { id; name; texts: ReadingText[] }[]>`; `textKey(lang, topic, id)`; `allTexts(lang, topic?)` → `{ key, topic, text }[]`.
- [ ] **Step 1: Failing test** (`checkReading(lang)`, run for `en`): topic ids and German names as `BUILTIN`; 3 texts each, ids unique; 6–10 sentences, each ≤ 200 chars; 8–15 glossary entries, each `word` found in the text as a whole word or phrase (case-insensitive, Unicode letters as word characters); 4 questions, each ending in "?", 4 distinct answers, `right` 0..3; English text without French accent letters.
- [ ] **Step 2:** red. **Step 3:** write the 36 English texts. **Step 4:** green. **Step 5:** Commit `feat: English reading texts`

### Task 3: French texts

**Files:** Create `shared/reading/fr.json` (36 texts); Modify `texts.test.ts` (run for `fr`; no sentence in both files)
- [ ] **Step 1–4:** red, write, green. **Step 5:** Commit `feat: French reading texts`

### Task 4: Rules: which text, the glossary in a sentence

**Files:** Create `src/core/reading/rules.ts`, `rules.test.ts`

**Interfaces:**
- Produces: `ReadingProgress = Record<string, { reads: number; last_read: string; last_right: number }>`; `pickText(all: { key; topic; text }[], progress, rand): { key; topic; text } | undefined` (never read first, at random among them; then the oldest `last_read`, ties at random); `segments(sentence: string, glossary: { word; de }[]): ({ text: string } | { text: string; de: string })[]` (whole-word or phrase matches, case-insensitive, longest phrase first, never inside another word, every occurrence, joined segments give back the sentence); `answerOrder(rand): number[]` (a permutation of 0..3); `readingStars(rights: boolean[]): number` (+2 each right, +2 for 4/4); `layReading(progress, item, today)` (as the server).
- [ ] **Step 1: Failing tests:** `pickText` prefers unread, then oldest read, and across 30 draws with two equally old texts picks both; `segments('The bus to the business park.', [{word:'bus',de:'Bus'}])` marks only the first "bus"; "Station" matches glossary "station"; phrase "youth hostel" beats "hostel"; "l'auberge" matched as a phrase with an apostrophe; `segments` joined equals the sentence; `readingStars([true,true,true,true])` 10, `[true,false,true,true]` 6; `layReading` adds reads and sets last_right.
- [ ] **Step 2–4:** red, implement, green. **Step 5:** Commit `feat: rules for reading visits`

### Task 5: The reading store

**Files:** Create `src/stores/reading.ts`, `reading.test.ts`; Modify `src/services/api.ts` (`reading()`, `readingResults(body)`, `playerReading(id)`, types), `src/services/fakeApi.ts` (`reading_`, the server's rule via `layReading`), `src/App.vue` (init/load beside `grammar`), `src/App.test.ts` (`'reading'` loaded)
- Produces: `useReadingStore = defineRoundStore('reading', { prefix: 'brightville.reading', … })`, answers `{ text: string; right: number }`.
- [ ] **Step 1: Failing tests:** server record taken; offline visit waits and goes once; App loads `reading`.
- [ ] **Step 2–4:** red, implement, green. **Step 5:** Commit `feat: the reading record on the page`

### Task 6: The Bibliothek at Oberstufe (Lesen)

**Files:** Create `src/buildings/lesen/Lesen.vue` (replacing the placeholder), `ReadingRound.vue`, `Lesen.test.ts`

**Interfaces:** Consumes Tasks 2, 4, 5; `LanguagePick` (no `needsVoice`), `hasVoice`, `speak` (voice `en-GB`/`fr-FR`), `useVisit`, `ProgressStars`.
- Screens: language → topics (`topic-mixed` "🎲 Gemischt", `topic-<id>`, a ✓ when all three texts of the topic were read) → reading (`data-test="text"` with the title, sentences, each glossary word a button `data-test="gloss"` showing `data-test="gloss-de"` when tapped; 🔊 `data-test="say"` per sentence only with a voice) and below it the current question (`data-test="question"`, four `data-test="answer"` in `answerOrder`), after the answer the verdict and "Weiter" → end ("N von 4 richtig – S ⭐", "Fertig").
- Leaving (or "Fertig") records `{ text: key, right: n }` once, if at least one question was answered.
- [ ] **Step 1: Failing tests:** topics in the language (13 buttons); tapping a gloss shows its German, tapping again hides it; no 🔊 without a voice, 🔊 speaks the sentence in `fr-FR` in a French text; four questions one after another, a wrong one marks the right answer and doesn't come back; 4/4 → 10 Stars and one `readingResults` with `right: 4`; leaving after two questions (one right) → 2 Stars, recorded `right: 1`.
- [ ] **Step 2–4:** red, implement, green (lint, types). **Step 5:** Commit `feat: reading in the Bibliothek at Oberstufe`

### Task 7: Parents, docs, browser check

**Files:** Modify `src/components/VocabOverview.vue` (+ test), `README.md`, `docs/roadmap.md`
- [ ] **Step 1: Failing test:** "2 von 36 Texten gelesen" per language from `playerReading` (texts that exist now only).
- [ ] **Step 2–4:** red, implement, green.
- [ ] **Step 5:** README (Oberstufe: the Bibliothek), roadmap (PR 2 done; first guesses: 3 texts a topic, +2 per question, the glossary words).
- [ ] **Step 6:** Browser check on 5188 (Oberstufe child): an English and a French text at 1024×768 and at 1024×420 (keyboard-height window: the question must stay reachable by scrolling), glossary taps, 🔊; no console errors.
- [ ] **Step 7:** `npm test && npm run lint && npx vue-tsc --noEmit && venv/bin/pytest -q` → clean. Commit `docs: README and roadmap for reading`
