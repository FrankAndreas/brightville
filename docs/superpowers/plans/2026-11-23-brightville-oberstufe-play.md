# Oberstufe Play Buildings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At Oberstufe the five play buildings open: Schlange, Bonbonjagd and Flatterflug as they are, the Spielhalle as a word memory in English or French, and the Kino with a film list of his own.

**Architecture:** `"oberstufe"` entries for the five play buildings; the films table gets a level (rebuilt by a migration so a film is unique per level); the player store hands each child the films of their level; the parents' film list gets a level switch. The Spielhalle's Oberstufe side picks the language and deals a memory of word ↔ German cards on the existing `createMemory`, recording first-try pairs of words due today through the vocabulary store.

**Tech Stack:** Vue 3 `<script setup>` + Pinia + Vitest (jsdom); FastAPI + SQLite + pytest.

**Spec:** `docs/superpowers/specs/2026-11-23-brightville-oberstufe-play-speak-look-design.md` (PR 1 of 3: section 1, play buildings)

## Global Constraints

- Kindergarten unchanged: her play buildings, her Kino films (existing films stay `kindergarten`), the animal memory.
- `arcade`, `schlange`, `bonbonjagd`, `kino`, `flatterflug` get `"oberstufe": {}` (cost and needs as now; the play rules as for her: after the day's learning, the play time, 3 Stars).
- Word memory: language first (`LanguagePick`, no voice needed); **6 pairs**, each a word in the language and its German, both written, no pictures; words he met in the School first (box ≥ 1), else new ones, from his lists and the built-in topics, never two cards with the same text; turning a card speaks it in its own language (German in the German voice, foreign in `en-GB` / `fr-FR` when the device has one). A pair found at the **first try** (neither of its cards was turned before in a turn that missed) counts as a right answer in his vocabulary record only for a word **due today** (box ≥ 1, due ≤ today); others change nothing.
- Kino: films have a level (`kindergarten` | `oberstufe`); a child sees the films of their level; the door needs films of his level; the same film may be on both lists (unique per level); up to 30 per level.
- Parents' film list: a switch "Kindergarten / Oberstufe" above the list; adding and deleting act on the shown level.
- Commits end with the two attribution lines. Tests: `npx vitest run <path>`, `venv/bin/pytest <path>`; whole: `npm test`, `npm run lint`, `npx vue-tsc --noEmit`, `venv/bin/pytest -q`.

## Review Focus

1. The films migration on a database with films already in it: they stay, as Kindergarten, with their ids; a duplicate youtube_id across levels is allowed, within one level still refused. (Task 1)
2. A child at Oberstufe with no Oberstufe films but with Kindergarten films: the Kino door is crossed out (not her films). (Task 2)
3. A word whose foreign side equals its German (e.g. "Hotel", "Taxi") or two words with the same German: never two cards with the same text in a round. (Task 3)
4. A pair found after one of its cards was in a miss, and a word not due: nothing recorded; leaving mid-round records the first-try pairs so far. (Task 4)
5. Fewer than 6 usable words in a language (a fresh child with no lists still has the built-in topics — but check the dedupe): a full round of 6. (Task 3)

---

### Task 1: Server: doors and films per level

**Files:** Modify `shared/buildings.json`, `backend/app/db.py` (migration: rebuild `films` with `level TEXT NOT NULL DEFAULT 'kindergarten'` and `UNIQUE (youtube_id, level)`, keeping ids), `backend/app/films.py` (`listing` returns `level`; `add(db, url, title, level='kindergarten')`; duplicate and the 30 limit per level), `backend/app/main.py` (`FilmIn.level: Literal['kindergarten','oberstufe'] = 'kindergarten'`), `src/core/access.test.ts`, `src/buildings/registry.test.ts` (play buildings open at Oberstufe); Test `tests/test_films.py`, `tests/test_level.py`
- [ ] **Step 1: Failing tests:** `test_level.py::test_play_buildings_open_at_oberstufe` (after the day's goal, `/api/plays` for arcade, schlange, bonbonjagd, kino, flatterflug → 200 at Oberstufe; still `locked` before the goal); `test_films.py`: a film added with level oberstufe is listed with its level; the same URL on both levels allowed, twice on one level → `already_there`; 30 per level; the migration keeps existing films as kindergarten with their ids (a database at the previous version with two films, migrated).
- [ ] **Step 2–4:** red, implement, green (`venv/bin/pytest -q`, `npm test`). **Step 5:** Commit `feat: the play buildings open at Oberstufe, and films per level`

### Task 2: Films on the page

**Files:** Modify `src/services/api.ts` (`Film.level`, `addFilm(url, title, level)`), `src/services/fakeApi.ts`, `src/stores/player.ts` (`films`: only the child's level; `allFilms` kept for nobody else), `src/components/FilmList.vue` (level switch, `data-test="film-level-<level>"`), tests (`src/stores/player.test.ts`, `src/components/FilmList.test.ts`, `src/App.test.ts`)
- [ ] **Step 1: Failing tests:** a Kindergarten child's store has only kindergarten films, an Oberstufe child's only oberstufe; App at Oberstufe with only kindergarten films → the Kino door `unavailable`; FilmList shows the Kindergarten list first, switching shows the Oberstufe list, adding there sends `level: 'oberstufe'`.
- [ ] **Step 2–4:** red, implement, green. **Step 5:** Commit `feat: his own film list for the Kino`

### Task 3: Word memory rules

**Files:** Create `src/core/vocab/memoryWords.ts`, `memoryWords.test.ts`
- Consumes: `ownWords`, `builtinWords`, `answersOf`, `Progress` (`src/core/vocab`).
- Produces: `pickMemoryWords(words: VocabWord[], progress: Progress, rand, n = 6): VocabWord[]` (met words first — box ≥ 1, at random — then new; never a word whose first answer equals its German after tidying, never two words sharing a first answer or a German); `wordDeck(words, lang, rand): WordCard[]` with `WordCard = Card & { text: string; voice: string; word: string /* key */ }` (two cards per word: `${key}-f` foreign, `${key}-d` German, same pair id); `dueToday(word, progress, today): boolean`.
- [ ] **Step 1: Failing tests:** 6 words with box-1 words first when there are enough; "Hotel / das Hotel" style words left out; two words with the same German never both; a deck of 12 cards, every text different, pair ids matching; `dueToday` true for box ≥ 1 and due ≤ today, false for new or later.
- [ ] **Step 2–4:** red, implement, green. **Step 5:** Commit `feat: rules for a word memory`

### Task 4: The Spielhalle at Oberstufe (WordMemory)

**Files:** Modify `src/buildings/arcade/Arcade.vue` (cards may carry `text` and `voice`: shown as text instead of the emoji, spoken with that voice; an optional `onPair(id, firstTry)` emit `pair`), `src/buildings/registry.ts` (`arcade.oberstufe = { component: WordMemory, preload }`); Create `src/buildings/arcade/WordMemory.vue` (LanguagePick → deck from `pickMemoryWords(ownWords(vocab.lists, lang) + builtinWords(lang), vocab.progress)` → Arcade; on finish/leave records `{ word, right: true }` for first-try pairs of words due today via `vocab.record(lang, …, owner)`), tests
- [ ] **Step 1: Failing tests:** language first; 12 cards, half in the language, half German, no emoji; turning a French card speaks it in `fr-FR`, a German one in German; a pair found at once for a word due today is recorded right, a pair found after a miss isn't, a new word isn't; leaving mid-round records the first-try pairs so far; the Kindergarten Spielhalle unchanged (animals, German).
- [ ] **Step 2–4:** red, implement, green (lint, types). **Step 5:** Commit `feat: a word memory in the Spielhalle at Oberstufe`

### Task 5: Docs and browser check

**Files:** Modify `README.md`, `docs/roadmap.md`
- [ ] **Step 1:** README (Oberstufe: the play buildings), roadmap (piece 5 PR 1 done).
- [ ] **Step 2:** Browser check on 5188: Oberstufe child after the goal: Schlange opens, the word memory in English and French, the Kino with an Oberstufe film; the parents' film switch; no console errors.
- [ ] **Step 3:** `npm test && npm run lint && npx vue-tsc --noEmit && venv/bin/pytest -q` → clean. Commit `docs: README and roadmap for the play buildings at Oberstufe`
