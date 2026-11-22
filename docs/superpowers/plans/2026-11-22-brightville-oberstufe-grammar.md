# Oberstufe Grammar (Musterwerkstatt) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At Oberstufe the Musterwerkstatt is a grammar trainer: 12 topics per language, gap sentences that are chosen while a topic is new and typed once he knows it, rounds that favour his weak topics, and a record per topic the parents read as "sicher" / "schwach".

**Architecture:** As pieces 1 and 2: an Oberstufe side (`BuildingDef.oberstufe.component`) and an `oberstufe` entry in `shared/buildings.json`. Content in `shared/grammar/<lang>.json`; form topics generated from verb tables and frames, choice topics written out. Rounds reuse the School's round flow (`createRoundFlow`, modes `choice` / `type-de`). The page-side "results wait on the device and count once" logic, now needed a third time (and twice more in PRs 2 and 3), moves into one factory that the listening store and the new grammar store use.

**Tech Stack:** Vue 3 `<script setup>` + Pinia + Vitest (jsdom); FastAPI + SQLite + pytest.

**Spec:** `docs/superpowers/specs/2026-11-22-brightville-oberstufe-grammar-reading-dates-design.md` (this plan is PR 1 of 3: the grammar sections, its doors entry and its parents' lines only)

## Global Constraints

- Never mix languages: a round, its items, choices and rule lines are one language (`en`/`fr`) plus German.
- Kindergarten unchanged: her Musterwerkstatt (`src/buildings/muster/`) as now; Bibliothek and Kalender stay "Bald" at Oberstufe in this PR.
- `muster` gets `"oberstufe": { "maxStars": 15 }` (no `needs`: written only).
- 12 topics per language, ids and German names as in the spec's table; each with a one-line German `rule`. Form topics: EN past simple; FR être/avoir/aller/faire, -er/-ir/-re verbs, passé composé with avoir, passé composé with être, futur proche. All others are choice topics with about 20 sentences each.
- Every verb form is written out in the tables (never derived by code); only the French `je` → `j'` before a vowel or mute h is a rule.
- Item key `<lang>:<topic>:<itemId>`; a topic's record key `<lang>:<topic>`.
- Round: 10 items. Choose while fewer than 5 right of his last 10 in that topic (or never tried), else type. Typed: the School's check (case, spaces don't matter; accents count, marked when only they were off); French accent buttons. After each answer: the filled-in sentence and the rule line. Wrong: type it out once, comes back once at the end (no Star). Stars +1 first-try right, +5 for 10/10; cap 15.
- "Gemischt": topics drawn weighted towards weak ones (untried counts as weak), every topic possible; within a topic his last-missed items first, then random; no item twice in a round.
- Record per topic: the first answers of the last 20 (true/false, newest last) and the ids missed last time (`missed`, at most 20). "Sicher": ≥ 8 right of the last 10. "Schwach": ≥ 5 tries and < 8 right of the last 10; at most three named, fewest right first.
- Parents' "Sprachen" per language: "Grammatik: N von 12 Themen sicher" and, when any, "Schwach: A, B, C".
- Commits end with the two attribution lines. Tests: `npx vitest run <path>`, `venv/bin/pytest <path>`; whole: `npm test`, `npm run lint`, `npx vue-tsc --noEmit`, `venv/bin/pytest -q`.

## Review Focus

1. A typed answer with an apostrophe or a contraction ("j'ai", "don't" / "do not", "isn't") or a curly apostrophe from the iPad keyboard: right when the item lists it. (Tasks 3, 5)
2. A French form item for `je` before a vowel or mute h ("j'ai", "j'habite") and its filled-in sentence starting the sentence with a capital: shown correctly, typed "J'ai" or "j'ai" both right. (Task 5)
3. Two choices that are the same text, or a distractor that is also a right answer (e.g. "elle est allée" vs. "elle est allée" from two persons): never shown. (Task 5)
4. The device loses the server or changes hands mid-round: results wait for him and count once, the listening store still works after moving onto the factory. (Tasks 2, 6)
5. A topic he never tried, a topic with fewer than 10 items, "Gemischt" on a first visit: a full round of 10 without repeats. (Task 5)

---

### Task 1: Server: the grammar record and the door

**Files:** Create `backend/app/grammar.py`; Modify `backend/app/db.py` (migration), `backend/app/main.py`, `shared/buildings.json`; Test `tests/test_grammar.py`, `tests/test_level.py`

**Interfaces:**
- Produces: tables `grammar_progress (person_id, topic, recent TEXT /* JSON list of 0/1 */, missed TEXT /* JSON list of item ids */, PRIMARY KEY (person_id, topic))`, `grammar_keys (person_id, key, day)`; `GET /api/grammar` → `{ progress: { [topic]: { recent: boolean[], missed: string[] } }, seen: string[] }`; `POST /api/grammar/results` body `{ key, lang, answers: [{ item, right }] }` (item `<lang>:<topic>:<id>`, max 40 answers, item ≤ 120 chars) → same shape, counted once per key, an item of the other language or without three `:`-parts skipped; `GET /api/players/{id}/grammar` (parents) → without `seen`. `muster` gets `"oberstufe": { "maxStars": 15 }`.
- [ ] **Step 1: Failing tests:** `test_level.py::test_muster_opens_at_oberstufe` (20 Stars → 15); `test_level.py::test_soon_buildings_refused_at_oberstufe` still passes (it uses yoga); `test_grammar.py`: a round appends to `recent` per topic in order and keeps the last 20; a wrong item enters `missed`, a right one leaves it; the same key twice counts once; `fr:` items in an `en` round skipped; an item `en:x` (two parts) skipped; parents see it, a child calling the parents' route → 403.
- [ ] **Step 2:** `venv/bin/pytest tests/test_grammar.py tests/test_level.py -q` → FAIL.
- [ ] **Step 3:** Implement as `backend/app/listen.py` (reuse `KEEP_KEYS_DAYS`, `LANGS`, `SEEN_KEYS`).
- [ ] **Step 4:** `venv/bin/pytest -q` → PASS (update `src/core/access.test.ts`'s Oberstufe list in Task 7, not here).
- [ ] **Step 5:** Commit `feat: the grammar record on the server, and the Musterwerkstatt open at Oberstufe`

### Task 2: One factory for results that wait on the device

**Files:** Create `src/stores/rounds.ts`, `src/stores/rounds.test.ts`; Modify `src/stores/listen.ts` (onto the factory; `listen.test.ts` unchanged and green)

**Interfaces:**
- Produces: `defineRoundStore<P, A>(id: string, opts: { prefix: string; fetch(api: Api): Promise<{ progress: P; seen?: string[] }>; send(api: Api, item: { key: string; lang: Lang; answers: A[] }): Promise<{ progress: P; seen?: string[] }>; lay(progress: P, item: { lang: Lang; answers: A[] }, today: string): P; isAnswer(x: unknown): x is A; empty: () => P })` → a Pinia store `{ progress: Ref<P>, who: Ref<number|null>, init(api, personId, storage?, day?), load(), record(lang, answers: A[], personId?) }` with exactly the behaviour of today's `stores/listen.ts` (waiting under `<prefix>.<id>`, known under `<prefix>.<id>.known`, refusals let go, generations, `seen` pruning).
- [ ] **Step 1: Failing test** `rounds.test.ts`: a tiny store made with the factory (answers `{ n: number }`, progress = a sum) passes the five cases of `listen.test.ts` (server taken; moved at once and sent once; offline waits and goes once; another child's round waits; refused let go).
- [ ] **Step 2:** red. **Step 3:** implement; rewrite `useListenStore` as `defineRoundStore('listen', { prefix: 'brightville.listen', … })`. **Step 4:** `npx vitest run src/stores` → all green, `listen.test.ts` untouched. **Step 5:** Commit `refactor: one store factory for results that wait on the device`

### Task 3: Grammar content: schema, loader, English

**Files:** Create `shared/grammar/en.json`, `src/core/grammar/content.ts`, `content.test.ts`

**Interfaces:**
- Produces: JSON `{ note, topics: Topic[] }`; `Topic = { id, name, rule, kind: 'choice', items: ChoiceItem[] } | { id, name, rule, kind: 'form', persons: string[], verbs: Record<string, Verb>, frames: Frame[] }`; `ChoiceItem = { id, text /* exactly one "___" */, hint?: string /* shown after the gap, e.g. "(go)" */, answers: string[] /* first is shown */, wrong: string[3] }`; `Frame = { id, text /* "___" and optionally "{s}" */, verbs: string[] }`; `Verb = { forms: Record<person, string> | string, wrong?: string[] }` (EN past simple: `forms` = the past form, `wrong` = common mistakes such as "goed", "gone"). `GRAMMAR: Record<Lang, Topic[]>`.
- English topic ids: `present-simple-continuous`, `past-simple`, `present-perfect`, `will-going-to`, `do-questions`, `comparison`, `modals`, `some-any`, `adverbs`, `relatives`, `if-will`, `passive`.
- [ ] **Step 1: Failing test** (per language, run for `en` now, `fr` in Task 4): 12 topics with the spec's names (German) and a non-empty one-line `rule` (≤ 80 chars); choice topics ≥ 18 items, unique ids, exactly one `___` per text, `answers` ≥ 1, 3 `wrong` all different from each other and from every answer (compared after the School's tidying: case, spaces, apostrophes); form topics: every frame's verbs exist in `verbs`, every verb has a form for every person (or one string), ≥ 6 frames; English texts contain no French accent letters.
- [ ] **Step 2:** red. **Step 3:** write `en.json` (A2, Swiss context where it fits; past simple: ~30 irregular verbs, frames with `{s}` so the gap is the verb only; contractions listed both ways in `answers`, e.g. `["doesn't", "does not"]`). **Step 4:** green. **Step 5:** Commit `feat: English grammar topics`

### Task 4: French content

**Files:** Create `shared/grammar/fr.json`; Modify `content.test.ts` (run for `fr` too)

**Interfaces:** French topic ids: `articles`, `etre-avoir-aller-faire`, `present-er-ir-re`, `passe-compose-avoir`, `passe-compose-etre`, `futur-proche`, `negation`, `adjectives`, `partitive`, `possessives`, `object-pronouns`, `questions`. Form topics' frames have no `{s}`: the gap is subject + verb, the hint names both ("(elle · aller)"); `persons`: `je, tu, il, elle, on, nous, vous, ils, elles`; tables hold the verb part only ("suis allé", "es allée"…), with feminine and plural agreement written out for être verbs (je → "suis allé / suis allée" as two right answers).
- [ ] **Step 1:** the Task 3 test for `fr`, plus: no line in both files; every French form a frame can produce is written out (no empty strings). **Step 2:** red. **Step 3:** write `fr.json` (~30 verbs: être, avoir, aller, faire, venir, partir, arriver, rester, tomber, monter, descendre, entrer, sortir, rentrer; -er/-ir/-re regulars; mute-h verbs only `habiter`). **Step 4:** green. **Step 5:** Commit `feat: French grammar topics`

### Task 5: Rules: items, choices, topic state, rounds

**Files:** Create `src/core/grammar/items.ts`, `src/core/grammar/round.ts` with tests

**Interfaces:**
- Consumes: Task 3/4 `GRAMMAR`; `checkAnswer`/`answersOf` (`src/core/vocab/answer.ts`); `RoundItem` (`src/core/vocab/round.ts`).
- Produces: `GrammarItem = { key: string; topic: string; text: string; hint?: string; answers: string[]; wrong: string[] }`; `itemsOf(lang, topic): GrammarItem[]` (form topics expanded: one item per frame × verb × person, id `<frame>.<verb>.<person>`; French subject + verb with `je` → `j'` before a vowel or `h`, capitalised when the gap starts the sentence; distractors = the same subject with other persons' verb parts, then the verb's `wrong`, distinct, never equal to an answer after tidying); `filled(item): string` (text with the first answer in the gap); `GrammarProgress = Record<string, { recent: boolean[]; missed: string[] }>`; `rightOfLast10(p?)`, `isSure(p?)` (≥ 8 of last 10), `isWeak(p?)` (≥ 5 tries and < 8), `typesNow(p?)` (≥ 5 right of last 10); `buildGrammarRound(lang, topic | undefined, progress, rand): RoundItem[]` — 10 items as `RoundItem` (`word = { key, de: text, foreign: answers.join(' / '), source: topic }`, mode `'choice'` with 4 shuffled choices or `'type-de'`); `weakest(lang, progress, n = 3): string[]` (topic ids).
- Mixed weighting: weight = 11 − right of last 10 (untried: 11), each draw picks a topic by weight then an unused item of it.
- [ ] **Step 1: Failing tests:** `itemsOf('fr','passe-compose-etre')` contains `"elle est allée"` for frame with aller, person elle; `je` + `avoir` → `"j'ai"`; a gap at the start → `"J'ai"` in `filled`; choices are 4 distinct and include exactly one right (tidy-compare); a choice topic with 18 items: round of 10 distinct; "Gemischt" with empty progress: 10 distinct items, at least 3 topics; missed ids come first in a topic round; `typesNow` false at 4/10, true at 5/10; `isSure` at 8/10; `isWeak` false with 4 tries; `weakest` orders by fewest right; `createRoundFlow` on a typed grammar item accepts "do not" for `["don't","do not"]` and a curly `’`.
- [ ] **Step 2–4:** red, implement, green. **Step 5:** Commit `feat: rules for grammar rounds`

### Task 6: The grammar store

**Files:** Create `src/stores/grammar.ts`, `grammar.test.ts`; Modify `src/services/api.ts` (`grammar()`, `grammarResults(body)`, `playerGrammar(id)`, types `GrammarState`, `GrammarResultsIn`), `src/services/fakeApi.ts` (`grammar_`, `refuseGrammar`, the server's rule), `src/App.vue` (init/load beside `listen`)
- Produces: `useGrammarStore = defineRoundStore('grammar', { prefix: 'brightville.grammar', … })`, answers `{ item: string; right: boolean }`, `lay` as the server (recent last 20, missed).
- [ ] **Step 1: Failing tests:** the store's `lay` matches the server's rule (recent order and cap 20, missed in/out); a round recorded offline waits and is sent once; App loads `grammar` on start (`api.calls` contains `'grammar'`).
- [ ] **Step 2–4:** red, implement, green. **Step 5:** Commit `feat: the grammar record on the page`

### Task 7: The Musterwerkstatt at Oberstufe (Grammatik)

**Files:** Create `src/buildings/grammatik/Grammatik.vue`, `GrammarRound.vue`, `Grammatik.test.ts`; Modify `src/buildings/registry.ts` (`muster.oberstufe = { component: Grammatik, preload }`), `src/core/access.test.ts` (Oberstufe list + `muster`)

**Interfaces:** Consumes Tasks 5, 6; `LanguagePick` (no `needsVoice`), `AccentKeys`, `createRoundFlow`, `ProgressStars`, `useVisit`.
- Screens: language → topics (`data-test="topic-mixed"` "🎲 Gemischt", `topic-<id>` with the German name, a small ✓ on sure topics) → round → end ("N von 10 richtig – S ⭐", "Fertig").
- `GrammarRound`: the sentence with the gap shown as a blank (`data-test="sentence"`), the hint, four choices (`data-test="choice"`) or the field (`data-test="answer"`) + accent keys (French) + "Prüfen"; after the answer `data-test="filled"` (the filled sentence) and `data-test="rule"`; wrong → type it out (as `Round.vue`); "Weiter".
- [ ] **Step 1: Failing tests:** topics shown in the language only (13 buttons); a new topic asks with choices, a topic at 6/10 asks typed; a whole round: 10 items, Stars as the rules, results recorded once with `<lang>:<topic>:` items only; after a wrong answer the filled sentence and rule are shown and the item comes back at the end; leaving mid-round keeps the answers so far; Kindergarten: `muster` component unchanged (registry).
- [ ] **Step 2–4:** red, implement, green (lint, types). **Step 5:** Commit `feat: grammar in the Musterwerkstatt at Oberstufe`

### Task 8: Parents, docs, browser check

**Files:** Modify `src/components/VocabOverview.vue` (+ test), `README.md`, `docs/roadmap.md`
- [ ] **Step 1: Failing test:** "Grammatik: 1 von 12 Themen sicher" and "Schwach: <German names>" (at most three, fewest right first, ≥ 5 tries) per language from `playerGrammar`; no "Schwach" line when none.
- [ ] **Step 2–4:** red, implement, green.
- [ ] **Step 5:** README (Oberstufe: the Musterwerkstatt), roadmap (piece 3 PR 1 done; first guesses: topics, 5-of-10 switch, weighting; PRs 2 and 3 next).
- [ ] **Step 6:** Browser check on 5188 with the harness (Oberstufe child): a choice round and a typed round in each language at 1024×768, a wrong answer with the rule line, French accents; no console errors.
- [ ] **Step 7:** `npm test && npm run lint && npx vue-tsc --noEmit && venv/bin/pytest -q` → clean. Commit `docs: README and roadmap for the grammar trainer`
