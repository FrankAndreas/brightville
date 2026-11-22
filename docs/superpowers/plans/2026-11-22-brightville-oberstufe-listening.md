# Oberstufe Dictation and Listening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At Oberstufe, Schreiben dictates his words (own spelling record) and the Reimhaus plays built-in listening scenes with German questions; both open on any device with an English or French voice.

**Architecture:** As piece 1: each building gets an `oberstufe` side (`BuildingDef.oberstufe.component`) and an `oberstufe` entry in `shared/buildings.json`, now with per-level `needs`. Spelling reuses the vocabulary store and server table with keys `<lang>:spell:…`. Scenes are fixed JSON (`shared/listen/`), their record a new server table and a store shaped like `src/stores/vocab.ts`.

**Tech Stack:** Vue 3 `<script setup>` + Pinia + Vitest (jsdom); FastAPI + SQLite + pytest.

**Spec:** `docs/superpowers/specs/2026-11-22-brightville-oberstufe-listening-design.md` (builds on `2026-11-22-brightville-oberstufe-vocab-design.md`)

## Global Constraints

- Never mix languages: a round, its scenes, choices and voice are one language (`en`/`fr`, voices `en-GB`/`fr-FR`) plus German.
- Kindergarten unchanged: Schreiben needs `touch` there, Reimhaus nothing; their components as now.
- `voice` = the device has an English or a French voice; without one the Oberstufe door is `unavailable`; doors re-check when voices arrive (`voiceschanged`). Inside, a language without a voice can't be picked ("Keine Stimme").
- Spelling key: the word key with `spell` after the language: `en:spell:travel:station`, `fr:spell:own:la gare|der bahnhof`. Same boxes/days and round rules as piece 1 (10 words, due first, at most 4 new, then due soonest).
- Dictation: nothing written before he answers; 🔊 again, 🐢 at rate 0.6; the School's answer check (accents count) and French accent buttons; empty answer ignored; after the answer the word and its German; wrong → type it out, comes back once at the end. Stars +1 first-try right, +5 for 10/10; cap 15.
- Scenes: `shared/listen/en.json`, `fr.json`; the 12 topic ids of the word lists; 6 scenes each; a scene = `{ id, lines: string[1..3], question, answers: string[4], right: 0..3 }`; a line may start `A: ` / `B: `. Key `<lang>:<topic>:<id>`.
- Listening round: 5 scenes; never answered right first (least recently asked first, never asked before asked), then those right longest ago; no scene twice; answers shuffled. Played once by itself; 🔊/🐢 unlimited. After the answer the text and "Weiter"; a missed scene doesn't come back this round. Stars +1 first-try right, +5 for 5/5; cap 10. Dialogue: line by line with a pause; `B:` lines with the second voice for the language if there is one, else pitch 0.8.
- Parents' "Sprachen" per language adds "N Wörter richtig geschrieben" (spelling box ≥ 3 over words that exist now) and "M von 72 Hörszenen verstanden" (right at least once).
- Commits end with the two attribution lines. Tests: `npx vitest run <path>`, `venv/bin/pytest <path>`; whole: `npm test`, `npm run lint`, `npx vue-tsc --noEmit`, `venv/bin/pytest`.

## Review Focus

1. Voices arriving late (Safari) or not at all: doors start crossed out and open when `voiceschanged` fires; a device with only an English voice offers only English inside. (Tasks 2, 3, 7)
2. A dictation round where the same foreign word stands for two German words ("bank"): both are asked, each with its own spelling key, and the German is shown after the answer. (Task 5)
3. The device loses the server or changes hands during a listening round: results wait for him and count once. (Task 6)
4. Speech cut off by leaving: leaving mid-scene stops the voice (no English voice in the town). (Tasks 7, 8)
5. The Kindergarten child: her Schreiben still needs touch, her Reimhaus is hers, unchanged. (Task 3)

---

### Task 1: Server: the doors and the listening record

**Files:** Modify `shared/buildings.json`, `backend/app/db.py`, `backend/app/main.py`; Create `backend/app/listen.py`; Test `tests/test_listen.py`, `tests/test_level.py`

**Interfaces:**
- Produces: `schreiben` gets `"oberstufe": { "maxStars": 15, "needs": ["voice"] }`, `reimhaus` gets `"oberstufe": { "needs": ["voice"] }` (the server ignores `needs`); table `listen_progress (person_id, scene, right_count, last_right, last_asked, PRIMARY KEY (person_id, scene))`, `listen_keys (person_id, key, day)`; `GET /api/listen` → `{ progress: { [scene]: { right: int, last_right: str|null, last_asked: str } }, seen: str[] }`; `POST /api/listen/results` body `{ key, lang, answers: [{ scene, right }] }` → same shape, counted once per key, a scene of the other language skipped; `GET /api/players/{id}/listen` (parents) → same without `seen`.

- [ ] **Step 1: Failing tests:** `test_level.py::test_schreiben_and_reimhaus_open_at_oberstufe` (visits 200; schreiben 20 Stars → 15, reimhaus 20 → 10); `test_listen.py`: results move `right`/`last_right`/`last_asked` (today 2026-11-12), the same key twice counts once, a wrong answer sets only `last_asked`, `fr:` scene in an `en` round skipped, a child calling the parents' route → 403, parents see it.
- [ ] **Step 2:** `venv/bin/pytest tests/test_listen.py tests/test_level.py -q` → FAIL.
- [ ] **Step 3:** Implement (pattern of `backend/app/vocab.py` `record`/`state`).
- [ ] **Step 4:** `venv/bin/pytest -q` → PASS.
- [ ] **Step 5:** Commit `feat: the listening record on the server, and dictation and listening open at Oberstufe`

### Task 2: Voices

**Files:** Modify `src/services/tts.ts`; Test `src/services/tts.test.ts`

**Interfaces:**
- Produces: `speak(text, lang = 'de-DE', opts?: { rate?: number; pitch?: number; voice?: SpeechSynthesisVoice })`; `voicesFor(lang: string): SpeechSynthesisVoice[]` (by the first two letters); `hasVoice(lang)` uses it; `voiceCount: Ref<number>` bumped on `voiceschanged` (and set once at load); `hasAnyForeignVoice(): boolean` (en or fr); `speakLines(lines: string[], lang: string, opts?: { rate?: number }, isCurrent?: () => boolean): Promise<void>` — strips `A: `/`B: `, speaks each line after the previous (pause 400 ms), `B:` lines with `voicesFor(lang)[1]` or pitch 0.8, stops when `isCurrent()` is false.
- [ ] **Step 1: Failing tests:** rate/pitch/voice reach the utterance; `voicesFor('en-GB')` finds `en_GB` and `en-US`; `voiceCount` increases when a `voiceschanged` event fires; `speakLines(['A: Hi', 'B: Hello'], 'en-GB')` speaks "Hi" then "Hello", the second with voice 2 when two exist, else pitch 0.8; it stops after the first when `isCurrent` turns false.
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** run → PASS. **Step 5:** Commit `feat: voices for dialogues, slow speech and late voices`

### Task 3: Needs per level on the page

**Files:** Modify `src/buildings/types.ts`, `src/buildings/registry.ts`, `src/services/device.ts`, `src/App.vue`; Test `src/buildings/registry.test.ts`, `src/core/access.test.ts`, `src/App.test.ts`

**Interfaces:**
- Consumes: Task 2 `voiceCount`, `hasAnyForeignVoice`; Task 1 json.
- Produces: `Need` gains `'voice'`; `DeviceCaps.voice?: boolean`; `BuildingDef.oberstufe.needs?: Need[]` (absent = the building's `needs`); `canServe(building, device, level = 'kindergarten')`; `stateOf`/`toDoors` pass the level to it; App's `caps` include `voice: hasAnyForeignVoice()` recomputed when `voiceCount` changes; registry: `schreiben.oberstufe = { component: Diktat, preload, needs: ['voice'] }`, `reimhaus.oberstufe = { component: Hoeren, preload, needs: ['voice'] }` (placeholders emitting `finished` 0 until Tasks 7/8).
- [ ] **Step 1: Failing tests:** `canServe(schreiben, { touch: false, voice: true }, 'oberstufe')` true, `'kindergarten'` false; `canServe(reimhaus, { voice: false }, 'oberstufe')` false; registry: Oberstufe needs match `shared/buildings.json`; App at Oberstufe: Schreiben's prompt `unavailable` without voices, `open` after a `voiceschanged` that brings an English voice.
- [ ] **Step 2–4:** red, implement, `npm test` green. **Step 5:** Commit `feat: what a building needs can depend on the level`

### Task 4: The scenes

**Files:** Create `shared/listen/en.json`, `shared/listen/fr.json`, `src/core/listen/scenes.ts`, `scenes.test.ts`

**Interfaces:**
- Produces: `SCENES: Record<Lang, { id: string; name: string; scenes: Scene[] }[]>`, `Scene = { id; lines: string[]; question: string; answers: string[]; right: number }`, `sceneKey(lang, topic, id)`, `allScenes(lang, topic?)` → `{ key, topic, scene }[]`.
- [ ] **Step 1: Failing test:** same 12 topic ids and German names as `BUILTIN`; exactly 6 scenes each; ids unique per topic; 1–3 lines, each ≤ 160 chars; question ends with `?`; 4 distinct answers; `right` in 0..3; English lines contain no French accent letter; no line appears in both files.
- [ ] **Step 2:** red. **Step 3:** write the scenes (A2, Swiss context where it fits; the question asks for something said; answers short, German). **Step 4:** green. **Step 5:** Commit `feat: listening scenes in English and French`

### Task 5: Rules: spelling keys, dictation rounds, listening rounds

**Files:** Create `src/core/vocab/spelling.ts`, `src/core/listen/round.ts` with tests; Modify `src/core/vocab/round.ts` (mode `'dictate'`), `src/buildings/vokabeln/roundFlow.ts` (`expectedOf` for `'dictate'` = foreign)

**Interfaces:**
- Produces: `spellKey(key: string): string` (`en:travel:x` → `en:spell:travel:x`); `spellingWords(words: VocabWord[]): VocabWord[]` (same words, spelling keys); `buildDictation(words, progress, today, rand): RoundItem[]` (the School's selection on spelling keys, every item mode `'dictate'`); `pickScenes(all: {key,…}[], progress: ListenProgress, rand): ListenItem[]` with `ListenItem = { key; scene; order: number[] }` (5, per the Global Constraints; `order` = shuffled answer indices); `ListenProgress = Record<string, { right: number; last_right: string | null; last_asked: string }>`.
- [ ] **Step 1: Failing tests:** `spellKey` for built-in and own keys; a dictation round of 25 new words has 4 items, all `'dictate'`; "bank" for die Bank and das Ufer gives two items with different keys; `createRoundFlow` with a `'dictate'` item checks against the foreign word (accent → wrong); `pickScenes`: never-right first (never asked before asked, then oldest asked), then oldest `last_right`; 5 distinct; `order` a permutation of 0..3; a topic with fewer than 5 scenes gives fewer.
- [ ] **Step 2–4:** red, implement, green. **Step 5:** Commit `feat: rules for dictation and listening rounds`

### Task 6: The listening store

**Files:** Create `src/stores/listen.ts`, `listen.test.ts`; Modify `src/services/api.ts`, `src/services/fakeApi.ts`, `src/App.vue` (init/load beside the vocab store)

**Interfaces:**
- Consumes: Task 1 routes.
- Produces: `Api.listen()`, `Api.listenResults(body)`, `Api.playerListen(id)`; `useListenStore()` = `{ progress, who, init(api, personId, storage?, day?), load(), record(lang, answers: { scene: string; right: boolean }[], personId?) }`, waiting under `brightville.listen.<id>`, as `stores/vocab.ts` does.
- [ ] **Step 1: Failing tests** (as `vocab.test.ts`): server progress taken; a round moves progress at once and is sent once; offline it waits and goes once with the next load; another child's round waits for that child; a refused round is let go.
- [ ] **Step 2–4:** red, implement, green. **Step 5:** Commit `feat: the listening record on the page`

### Task 7: Schreiben at Oberstufe (Diktat)

**Files:** Create `src/buildings/diktat/Diktat.vue`, `DictationRound.vue`, `Diktat.test.ts`; Create `src/buildings/vokabeln/LanguagePick.vue` (from `Vokabeln.vue`, prop `needsVoice: boolean`) and use it in Vokabeln; Modify `Shelf.vue` (prop `editable = true`: without it no "Neue Liste", no ✏️)

**Interfaces:** Consumes Tasks 2, 3, 5; `useVocabStore().record(lang, answers)` with spelling keys; `AccentKeys`, `checkAnswer` via `createRoundFlow`.
- [ ] **Step 1: Failing tests:** language without a voice shows "Keine Stimme" and can't be picked; shelf without "Neue Liste"/✏️; a round: the word is spoken in `en-GB` at start (nothing written), 🐢 speaks with rate 0.6, a right answer shows the word and its German, results recorded with `en:spell:` keys only, Stars as the rules; leaving mid-round stops speaking (`stopSpeaking` called) and records the answers so far.
- [ ] **Step 2–4:** red, implement, green (lint, types). **Step 5:** Commit `feat: dictation in Schreiben at Oberstufe`

### Task 8: Reimhaus at Oberstufe (Hören)

**Files:** Create `src/buildings/hoeren/Hoeren.vue`, `ListenRound.vue`, `Hoeren.test.ts`

**Interfaces:** Consumes Tasks 2, 4, 5, 6; `LanguagePick` (needsVoice).
- [ ] **Step 1: Failing tests:** topic pick incl. "Gemischt"; the scene is played by itself (`speakLines` with `fr-FR` in a French round), question and four answers shown in German in `order`; a right answer → +1 and the text shown, "Weiter" goes on; a wrong one → no Star, text shown, the scene not asked again this round; 5/5 → 10 Stars; at the end `record` once with all five; 🐢 replays at 0.6; leaving stops the voice.
- [ ] **Step 2–4:** red, implement, green. **Step 5:** Commit `feat: listening in the Reimhaus at Oberstufe`

### Task 9: Parents, docs, browser check

**Files:** Modify `src/components/VocabOverview.vue` (+ test), `README.md`, `docs/roadmap.md`
- [ ] **Step 1: Failing test:** VocabOverview shows "N Wörter richtig geschrieben" (spell box ≥ 3, words that exist now) and "M von 72 Hörszenen verstanden" per language (from `playerListen`).
- [ ] **Step 2–4:** red, implement, green.
- [ ] **Step 5:** README (Oberstufe section: Schreiben and Reimhaus), roadmap (piece 2 done; first guesses: scenes, rate 0.6, 6 per topic, second speaker; to try on the iPad: voices, two voices for dialogues).
- [ ] **Step 6:** Browser check on port 5188 with the harness (Oberstufe child; Chrome with voices stubbed in an init script): a dictation round and a listening round in each language at 1024×768; no console errors.
- [ ] **Step 7:** `npm test && npm run lint && npx vue-tsc --noEmit && venv/bin/pytest -q` → clean. Commit `docs: README and roadmap for dictation and listening`
