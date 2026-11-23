# Oberstufe Speaking (Trommelhaus) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At Oberstufe the Trommelhaus is a speaking room: he hears or reads a word or sentence in English or French (or reads the German of a word he knows well) and says it; the browser's recogniser checks it.

**Architecture:** The same shape as the Reimhaus/Kalender pieces: a server record per spoken item (`backend/app/speak.py`, cloned from `listen.py`), a round store from `defineRoundStore`, rules in `src/core/speak/` (sentences, the check, building a round), and a building component behind `LanguagePick`. The browser's `SpeechRecognition` sits behind `src/services/recogniser.ts` (`recognise(lang, timeoutMs) → alternatives[]`) so a dedicated service can replace it later. A new device need `speech` keeps the door crossed out where there is no recogniser or microphone.

**Tech Stack:** Vue 3 `<script setup>` + Pinia + Vitest (jsdom); FastAPI + SQLite + pytest.

**Spec:** `docs/superpowers/specs/2026-11-23-brightville-oberstufe-play-speak-look-design.md` (PR 2 of 3: section 2, speaking)

## Global Constraints

- Kindergarten unchanged: her Trommelhaus (rhythm, claps, microphone levels) stays exactly as it is.
- `trommelhaus` gets `"oberstufe": { "maxStars": 15 }` in `shared/buildings.json`; registry `oberstufe: { component, preload, needs: ['speech'] }`. `speech` = the browser has `SpeechRecognition` or `webkitSpeechRecognition` **and** `navigator.mediaDevices.getUserMedia`. Without it the door is `unavailable`.
- Language first (`LanguagePick`, no voice needed: recognition and voice are separate). **Never mix languages**: a round is one language plus German.
- A round has **10** items: **Nachsprechen** (the foreign text written, and spoken when the device has a voice for it; he says it) and **Übersetzen** (the German written; he says it in the language) — Übersetzen only for words with vocabulary box **≥ 3**, never sentences; about half Übersetzen as far as such words exist (at most 5); always **at least 3 sentences**.
- Items: words from his own lists and the built-in topics (their first answer), and sentences from `shared/speak/<lang>.json`: **12 topics** (the vocabulary topic ids: travel, school, family, freetime, food, jobs, health, home, town, nature, shopping, feelings) × **5 sentences** each, short (≤ 60 characters), everyday A2, `{ id, text, de }`. French with its accents.
- The check: every alternative the recogniser offers is tried against every answer of the expected text (`answersOf`). Case, punctuation, apostrophes, hyphens and spaces don't matter; accents don't matter; figures count as their words (0–100: "2" = "two" = "deux"); English "to" before a verb may be left out (word items).
- Tries: right → +1 Star and on; not right → "Gehört: …" (the first alternative) and "Nochmal versuchen (n von 3)"; after the 3rd wrong try the right form is shown and spoken (when there is a voice) and the round goes on. **Nothing heard** (empty alternatives: silence, an error, a timeout) is not a try: "Nichts gehört – tipp nochmal auf 🎤".
- Stars: +1 per item right within 3 tries, +5 for 10/10, cap 15.
- Record keys: word `<lang>:speak:<word key without its "<lang>:" prefix>` (`en:speak:travel:window`, `fr:speak:own:la gare|der bahnhof`), sentence `<lang>:speak:sentence:<topic>:<id>`. Server keeps per child and key `right_count`, `last_right`, `last_asked` (as `listen.py`); a round's answers count once by its key; a key of the other language or not starting `<lang>:speak:` is skipped.
- Parents' "Sprachen" per language: **"N Sätze und Wörter gesprochen"** (keys of that language with right_count ≥ 1).
- No on/off switch on the parents' page. The voice goes only to the browser's recogniser; nothing is recorded or kept by the game.
- Commits end with the two attribution lines; the PR title starts with `feat:`. Tests: `npx vitest run <path>`, `venv/bin/pytest <path>`; whole: `npm test`, `npm run lint`, `npx vue-tsc --noEmit`, `venv/bin/pytest -q`.

## Review Focus

1. Leaving (button, Esc, end) while the recogniser listens: it is stopped, and a result that arrives late changes nothing (no Star, no record, no error). (Task 5)
2. The microphone refused (`not-allowed`) or the recogniser failing at once: no try counted, he is told "Das Mikrofon ist nicht erlaubt" and can still leave; a second tap on 🎤 while listening starts nothing new. (Tasks 4, 5)
3. A word with several answers ("buy / purchase"), one with "to" ("to travel"), a sentence with an apostrophe or figures ("It's 2 o'clock" heard as "it's two o'clock"), French accents heard without them: all right. A different word that only shares letters ("bike" vs "big") is wrong. (Task 2)
4. A fresh child (no box ≥ 3 words, no own lists): a full round of 10, all Nachsprechen, at least 3 sentences; a child with many box-3 words: at most 5 Übersetzen, at least 3 sentences. (Task 3)
5. The device changing hands or the server away: the round's answers go to the child who started it and wait on the device (the round store does this; the building must pass the owner). (Task 5)

---

### Task 1: Server: the speaking record and the door

**Files:** Create `backend/app/speak.py`, `tests/test_speak.py`; Modify `backend/app/db.py` (migration: `speak_progress (person_id, item, right_count, last_right, last_asked, PRIMARY KEY (person_id, item))`, `speak_keys (person_id, key, day, PRIMARY KEY (person_id, key))`), `backend/app/main.py` (`GET /api/speak`, `POST /api/speak/results` with `SpeakResultsIn {key ≤64, lang: Literal['en','fr'], answers: list[{item ≤ 120, right}] ≤ 40}`, `GET /api/players/{id}/speak` parents only), `shared/buildings.json` (`trommelhaus` oberstufe maxStars 15), `tests/test_level.py`, `src/buildings/registry.test.ts` (shared entry), `src/core/access.test.ts` (open list)
- Produces: `speak.state(db, person_id, seen=True) -> {"progress": {item: {"right", "last_right", "last_asked"}}, "seen"?: [key]}`; `speak.record(db, person_id, key, lang, answers)`.
- [ ] **Step 1: Failing tests:** `test_speak.py`: a round's right and wrong answers counted (right_count, last_right only when right, last_asked); the same key twice counts once; `fr:speak:…` in an `en` round and `en:travel:x` (no `speak`) skipped; a parent reads a child's record, a child can't read another's (403/404 as `/api/players/{id}/listen`). `test_level.py::test_trommelhaus_speaks_at_oberstufe`: at Oberstufe a visit with 20 Stars gives 15; at Kindergarten still 10.
- [ ] **Step 2–4:** red, implement (clone `listen.py`'s shape), green (`venv/bin/pytest -q`, `npm test`). **Step 5:** Commit `feat: the server keeps what he said right`

### Task 2: Sentences and the check

**Files:** Create `shared/speak/en.json`, `shared/speak/fr.json`, `src/core/speak/sentences.ts`, `src/core/speak/check.ts`, tests
- Produces: `interface Sentence { key: string /* <lang>:speak:sentence:<topic>:<id> */; text: string; de: string; topic: string }`; `sentences(lang: Lang): Sentence[]`; `heardRight(alternatives: string[], expected: string, lang: Lang, opts?: { word?: boolean }): boolean`; `spokenForm(text: string, lang: Lang): string` (digits 0–100 → words, then small letters without accents, no punctuation, apostrophes, hyphens or spaces).
- [ ] **Step 1: Failing tests:** content: both files 12 topics with the vocabulary topic ids × 5 sentences, ids unique per topic, text ≤ 60 characters and `de` non-empty, no `{`/`/` in text; French texts contain at least 20 accented letters overall (accents kept), English texts no French letters (é è ê à ç œ). Check: `heardRight(["how are you today"], "How are you today?", 'en')`; `heardRight(["it's two o'clock"], "It's 2 o'clock.", 'en')` and the reverse (expected words, heard "2"); `heardRight(["je voudrais un croissant sil vous plait"], "Je voudrais un croissant, s'il vous plaît.", 'fr')`; `heardRight(["purchase"], "buy / purchase", 'en', { word: true })`; `heardRight(["travel"], "to travel", 'en', { word: true })`; a later alternative right counts (`["big", "bike"]` for "bike"); `heardRight(["big"], "bike", 'en')` false; `heardRight([], "bike", 'en')` false; "vingt-deux" vs heard "22" right.
- [ ] **Step 2–4:** red, implement (French numbers 0–100 with "et un", "soixante-dix", "quatre-vingts"; English with hyphens), green. **Step 5:** Commit `feat: everyday sentences, and a check that forgives what the recogniser writes`

### Task 3: A speaking round and the store

**Files:** Create `src/core/speak/round.ts`, `src/stores/speak.ts`, tests; Modify `src/services/api.ts` (`SpeakState`, `SpeakResultsIn`, `speak()`, `speakResults()`, `playerSpeak()`), `src/services/fakeApi.ts`
- Consumes: Task 2 `sentences`, `Sentence`; `VocabWord`, `Progress` (vocab), `ownWords`, `builtinWords`, `answersOf`; `defineRoundStore`.
- Produces: `interface SpeakItem { key: string; mode: 'repeat' | 'translate'; kind: 'word' | 'sentence'; text: string /* the foreign form, all answers */; shown: string /* first answer */; de: string }`; `speakKey(word: VocabWord, lang: Lang): string`; `buildSpeakRound(lang, words: VocabWord[], vocab: Progress, said: SpeakProgress, rand, today: string): SpeakItem[]` (10 items); `type SpeakProgress = Record<string, { right: number; last_right: string | null; last_asked: string | null }>`; `laySpeak(progress, item, today)`; `saidCount(lang, progress): number`; `useSpeakStore` (prefix `brightville.speak`).
- Choice: within each kind, items said right least often first, then not asked today, at random among equals; sentences: 3–5 per round (5 when there are few words), Übersetzen words: min(5, box≥3 words), the rest Nachsprechen words; shuffled.
- [ ] **Step 1: Failing tests:** a fresh child: 10 items, ≥ 3 sentences, all `repeat`, keys unique; with 12 words at box 3: 5 `translate`, all of them words with box ≥ 3, ≥ 3 sentences; never a sentence as `translate`; an English round has only `en:speak:` keys; items said right before come after those never said; `speakKey` for a built-in and an own word; `laySpeak` like the server; `saidCount` counts right ≥ 1 of that language only; the store records and sends like `stores/dates`.
- [ ] **Step 2–4:** red, implement, green. **Step 5:** Commit `feat: a speaking round of words and sentences`

### Task 4: The recogniser and the `speech` need

**Files:** Create `src/services/recogniser.ts`, `recogniser.test.ts`; Modify `src/buildings/types.ts` (`Need` + `'speech'`), `src/App.vue` (caps `speech: hasSpeech()`), `src/buildings/registry.ts` (trommelhaus oberstufe with a placeholder component until Task 5, `needs: ['speech']`), `src/App.test.ts`
- Produces: `hasSpeech(): boolean`; `recognise(lang: Lang, timeoutMs = 7000): Promise<string[]>` — `en-GB`/`fr-FR`, `maxAlternatives = 5`, no interim results, one utterance; resolves with every alternative's transcript (trimmed, non-empty) on a result, `[]` on `no-speech`, `aborted`, any other error, an end without result, or the timeout (then it aborts the recogniser); rejects only with `Error('not-allowed')` for `not-allowed`/`service-not-allowed`; `stopRecognising(): void` aborts the one listening and resolves it with `[]`. A second `recognise` while one listens aborts the first.
- [ ] **Step 1: Failing tests** (a fake `SpeechRecognition` class on `window`): alternatives returned in order; `lang` set per language; `no-speech` → `[]`; timeout → `[]` and `abort` called; `not-allowed` rejects; `stopRecognising` resolves `[]`; `hasSpeech` false without the class or without `getUserMedia`. App: at Oberstufe without `speech` the Trommelhaus door is `unavailable`, with it `open`; at Kindergarten no change.
- [ ] **Step 2–4:** red, implement, green. **Step 5:** Commit `feat: the browser's recogniser behind one small interface`

### Task 5: The Trommelhaus at Oberstufe and the parents' line

**Files:** Create `src/buildings/sprechen/Sprechen.vue`, `src/buildings/sprechen/speakFlow.ts`, tests; Modify `src/buildings/registry.ts` (the real component), `src/App.vue` (init and load the speak store as the dates store), `src/components/VocabOverview.vue` (+ test)
- Consumes: Tasks 2–4.
- Produces: `createSpeakFlow(items: SpeakItem[], lang: Lang)` with `state { index, tries, heard: string | null, phase: 'ready' | 'listening' | 'right' | 'wrong' | 'shown' | 'nothing' | 'denied' | 'done', stars, results: { key, right }[] }` and `listen(): Promise<void>` (ignores a call while listening), `next()`, `stop()` (stops the recogniser; a result after it changes nothing).
- Screen: header "🎤 Nachsprechen" / "🔁 Übersetzen" and ⭐ progress; the foreign text big (`lang` attribute) with 🔊 when `hasVoice` (Nachsprechen), or the German big (Übersetzen); a large 🎤 button (`data-test="mic"`, pulses while listening); "Gehört: …" with "Nochmal versuchen (n von 3)"; after the 3rd wrong try the right form shown and spoken, "Weiter"; right → a chime and on after a moment. End screen as the Kalender's (ProgressStars, "N von 10 richtig – S ⭐", Fertig). Esc and the leave button leave on every screen, including the language screen.
- Record: on leaving or at the end, once, `speak.record(lang, results, owner)` with the items finished (right or shown); Stars = right count + 5 if 10/10, cap 15.
- [ ] **Step 1: Failing tests** (`vi.mock('@/services/recogniser')`): language first, then the first item; heard right → Star, next; heard wrong 3 times → right form shown, no Star, "Weiter"; `[]` doesn't count a try ("Nichts gehört"); `not-allowed` → the denied line, no try; a second tap while listening starts nothing; leaving while listening calls `stopRecognising` and a late result changes nothing; 10/10 → 15 Stars; leaving mid-round records only finished items for the owner; Esc on the language screen leaves with 0 Stars. VocabOverview: "3 Sätze und Wörter gesprochen" from a `playerSpeak` record.
- [ ] **Step 2–4:** red, implement, green (lint, types). **Step 5:** Commit `feat: speaking in the Trommelhaus at Oberstufe`

### Task 6: Docs and browser check

**Files:** Modify `README.md`, `docs/roadmap.md`
- [ ] **Step 1:** README (Oberstufe: the Trommelhaus speaking room, the voice goes to the browser's recogniser — Apple or Google — accepted for now), roadmap (piece 5 PR 2 done).
- [ ] **Step 2:** Browser check on 5188 with a fake `webkitSpeechRecognition` in the page (answers from a list): an English and a French round, a wrong try showing "Gehört", the end screen; Kindergarten Trommelhaus unchanged; no console errors. Real Chrome recognition can't run headless — the iPad check goes to the user.
- [ ] **Step 3:** `npm test && npm run lint && npx vue-tsc --noEmit && venv/bin/pytest -q` → clean. Commit `docs: README and roadmap for speaking in the Trommelhaus`
