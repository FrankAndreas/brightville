# Oberstufe Spielwelt (position words in English and French) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At Oberstufe the Spielwelt gives its five find-and-place tasks in English or French (every position word from the start), spoken and written, then free play.

**Architecture:** The Kindergarten Spielwelt's world, tasks (`buildRaumSession`) and flow stay; the flow's German sentences move behind a `WorldTexts` interface (German as today by default), English and French implementations live in `src/core/worldWords.ts`. The Oberstufe side (`Welt.vue`) picks the language and mounts `Spielwelt` with a `lang` prop: all words (step 6), no example, no ladder record, the instruction spoken in the language's voice and written on screen.

**Tech Stack:** Vue 3 `<script setup>` + Pinia + Vitest (jsdom).

**Spec:** `docs/superpowers/specs/2026-11-22-brightville-oberstufe-coach-design.md` (PR 1 of 2: the Spielwelt section and its door)

## Global Constraints

- Never mix languages: a visit's sentences and voice are one language (`en-GB` / `fr-FR` voice); buttons German.
- Kindergarten unchanged: her Spielwelt's sentences (German), ladder, example and recording exactly as now.
- `spielwelt` gets `"oberstufe": { "maxStars": 10 }` (no `needs`); Stars as now.
- Words: EN on, under, in, next to, in front of, behind, between … and …, to the left of, to the right of; FR sur, sous, dans, à côté de, devant, derrière, entre … et …, à gauche de, à droite de, with articles and contractions (du, de la, de l', des — e.g. "à côté du lit", "à gauche de l'arbre").
- Sentences: EN "Put the ball under the table." / "The cat is behind the tree. Can you find it?" / "Put it under the table." / "The ball is now on the bed." / "Great!"; FR "Mets le ballon sous la table." / "Le chat est derrière l'arbre. Tu le trouves?" / "Mets-le sous la table." / "Le ballon est maintenant sur le lit." / "Super!". Two clues joined with "and" / "et".
- Spoken (when the device has a voice) and written at once; 🔊 repeats; the first task of a visit also shows "Mach, was der Coach sagt" in German, once.
- "left of" / "right of" as seen on the screen.
- Commits end with the two attribution lines. Tests: `npx vitest run <path>`; whole: `npm test`, `npm run lint`, `npx vue-tsc --noEmit`, `venv/bin/pytest -q`.

## Review Focus

1. French contractions with every object: masculine (du), feminine (de la), vowel (de l'), and "entre" with two objects of different genders; never "de le" or "à côté de le". (Task 2)
2. A French pronoun for the thing: "Tu le trouves?" / "Tu la trouves?", "Mets-le" / "Mets-la", by the thing's gender. (Task 2)
3. The Kindergarten child's sentences: byte-for-byte the same as before for every task kind (the refactor must not change German). (Task 3)
4. A device without a voice for the language: the written instruction is enough to play. (Task 4)
5. Leaving mid-visit at Oberstufe: Stars so far, and nothing written to her Raum ladder. (Task 4)

---

### Task 1: The door

**Files:** Modify `shared/buildings.json`, `src/buildings/registry.ts` (`spielwelt.oberstufe = { component: Welt, preload }`, placeholder `src/buildings/welt/Welt.vue`), `src/core/access.test.ts`, `src/buildings/registry.test.ts`; Test `tests/test_level.py`
- [ ] **Step 1: Failing tests:** `test_level.py::test_spielwelt_opens_at_oberstufe` (20 → 10); access test lists `spielwelt`.
- [ ] **Step 2–4:** red, implement, green (`venv/bin/pytest -q`, `npm test`). **Step 5:** Commit `feat: the Spielwelt open at Oberstufe`

### Task 2: English and French words for the world

**Files:** Create `src/core/worldWords.ts`, `worldWords.test.ts`
- Consumes: `OBJECTS`, `THINGS`, `Clue`, `Word`, `Place`, `holds`, `delta`, `RaumTask` (`src/core/world.ts`, `src/core/raum.ts`).
- Produces: `WorldTexts = { task(task: RaumTask): string; again(task: RaumTask, clues: Clue[]): string; describe(thingId: string, place: Place, objects: WorldObject[]): string; thatIs(thingId: string): string; found(thingId: string): string; cheer: string; free: string }`; `GERMAN_TEXTS: WorldTexts` (wrapping today's `taskText`, `againText`, `describe` and the flow's sentences, unchanged); `worldTexts(lang: Lang): WorldTexts`; nouns per object and thing: `EN_NOUNS: Record<id, string>`, `FR_NOUNS: Record<id, { noun: string; gender: 'm' | 'f' }>`.
- [ ] **Step 1: Failing tests:** every object and thing id has an EN noun and an FR noun with gender; `worldTexts('en').task({ type: 'place', thing: 'ball', clues: [{ word: 'unter', object: 'tisch' }] })` = "Put the ball under the table."; find with "hinter"/"baum" for the cat = "The cat is behind the tree. Can you find it?"; FR place "neben"/"bett" = "Mets le ballon à côté du lit."; FR "links neben"/"baum" → "à gauche de l'arbre"; FR "zwischen" bett/tisch → "entre le lit et la table"; FR find for the cat (m) "Le chat est … Tu le trouves?", for the apple → "la pomme … Tu la trouves?"; FR again "Mets-la …" for a feminine thing; two clues joined "… and …" / "… et …"; no FR text contains "de le", "de les", "à le"; EN describe on the bed = "The ball is now on the bed."; no French letter in any EN text.
- [ ] **Step 2–4:** red, implement, green. **Step 5:** Commit `feat: English and French words for the Spielwelt`

### Task 3: The flow speaks through WorldTexts

**Files:** Modify `src/buildings/spielwelt/flow.ts` (a `texts: WorldTexts = GERMAN_TEXTS` parameter; every sentence through it), `flow.test.ts`
- [ ] **Step 1: Failing test:** a flow built with `worldTexts('en')` speaks "Put the … ." for a place task and "Great!" when right; the existing German flow tests unchanged and green.
- [ ] **Step 2–4:** red, implement, green (`npx vitest run src/buildings/spielwelt`). **Step 5:** Commit `refactor: the Spielwelt's sentences come from one place`

### Task 4: The Spielwelt at Oberstufe (Welt)

**Files:** Create `src/buildings/welt/Welt.vue` (replacing the placeholder), `Welt.test.ts`; Modify `src/buildings/spielwelt/Spielwelt.vue` (prop `lang?: Lang`)
- `Spielwelt` with `lang`: tasks `buildRaumSession(6)`, no example, no `ladder.record`, the flow with `worldTexts(lang)`, speech by `speak(text, VOICE[lang])` (🔊 repeats the last instruction in that voice, not German), the current instruction written on screen (`data-test="instruction"`, the language's text), "Mach, was der Coach sagt" (`data-test="coach-hint"`) with the first task only; without `lang` exactly as now.
- `Welt.vue`: `LanguagePick` (no `needsVoice`), then `<Spielwelt :lang>`; passes `finished` up.
- [ ] **Step 1: Failing tests:** language screen, then the world with an English instruction written and spoken in `en-GB`; French in `fr-FR`; no voice → written only, play works; 🔊 repeats in the language; a whole visit right → Stars as the Kindergarten Spielwelt for five tasks, and the Raum ladder untouched (`ladders` store has no new results); the Kindergarten Spielwelt still speaks German (existing tests green).
- [ ] **Step 2–4:** red, implement, green (lint, types). **Step 5:** Commit `feat: position words in English and French in the Spielwelt at Oberstufe`

### Task 5: Docs and browser check

**Files:** Modify `README.md`, `docs/roadmap.md`
- [ ] **Step 1:** README (Oberstufe: the Spielwelt), roadmap (piece 4 PR 1 done; next the camera buildings).
- [ ] **Step 2:** Browser check on 5188: an English and a French visit at 1024×768 (instruction written and spoken, carrying things, a find task, free play); no console errors.
- [ ] **Step 3:** `npm test && npm run lint && npx vue-tsc --noEmit && venv/bin/pytest -q` → clean. Commit `docs: README and roadmap for the Spielwelt at Oberstufe`
