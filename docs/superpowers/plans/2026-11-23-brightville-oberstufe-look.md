# Oberstufe Look Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New hair styles and glasses for every child, and a Kleiderladen range of his own at Oberstufe, labelled in his language with German underneath.

**Architecture:** The looks grow by two hair styles and two glasses in both lists (`src/core/look.ts`, `backend/app/wardrobe.py LOOK_OPTIONS`) and in `src/city/dress.ts`. His items join `shared/outfits.json` with `"level": "oberstufe"` and their English and French names; the shop rules (client and server) take a level: a child sees, opens shelves of and buys only items of their own level. The Kleiderladen picks its range by `player.level` and, at Oberstufe, labels each tile.

**Tech Stack:** Vue 3 `<script setup>` + Pinia + Vitest (jsdom) + three.js; FastAPI + SQLite + pytest.

**Spec:** `docs/superpowers/specs/2026-11-23-brightville-oberstufe-play-speak-look-design.md` (PR 3 of 3: section 3, his look)

## Global Constraints

- New hair `short`, `messy`; new glasses `sunglasses`, `square` — appended to the lists (existing order unchanged), for every child; the server takes exactly the client's lists.
- His range, new ids, `"level": "oberstufe"`, each with `en` and `fr` names (no other item gets a level or names):

  | id | name (de) | article | en | fr | emoji | place | shelf | price |
  |---|---|---|---|---|---|---|---|---|
  | baseballkappe | Baseballkappe | die | cap | la casquette | 🧢 | head | 1 | 20 |
  | muetze | Mütze | die | beanie | le bonnet | 🧶 | head | 1 | 15 |
  | fanschal | Fanschal | der | scarf | l’écharpe | 🧣 | neck | 1 | 20 |
  | hoodie | Hoodie | der | hoodie | le sweat à capuche | 👕 | body | 1 | 25 |
  | sportrucksack | Rucksack | der | backpack | le sac à dos | 🎒 | back | 1 | 25 |
  | kopfhoerer | Kopfhörer | pl | headphones | le casque | 🎧 | head | 2 | 45 |
  | fussballtrikot | Fussballtrikot | das | football shirt | le maillot de foot | ⚽ | body | 2 | 50 |
  | jacke | Jacke | die | jacket | la veste | 🧥 | body | 2 | 55 |
  | skateboard | Skateboard | das | skateboard | le skateboard | 🛹 | back | 2 | 60 |
  | sportmedaille | Sportmedaille | die | medal | la médaille | 🥇 | neck | 3 | 90 |
  | gitarre | Gitarre | die | guitar | la guitare | 🎸 | back | 3 | 110 |

- The football shirt is Swiss red and white (red body, a white cross on the front). His cap may reuse her cap's shape in another colour.
- A child sees, and can buy, only the items of their level (an item without `level` is Kindergarten). The shelf rule counts only items of the child's level. The server refuses another level's item with `not_for_level` (409). Once a day, savings and prices as now. What he owns from her range stays his and can be worn (Kleiderschrank unchanged). Gifts from stickers unchanged.
- At Oberstufe each tile shows the item's name in his last picked language (as `LanguagePick` remembers it, `brightville.vocab.lang.<owner>`; none → English), German (with article) underneath. The shop's spoken lines stay German (as the play games: the shop isn't a lesson).
- Kindergarten unchanged: her shop shows exactly her 15 items, her shelves, her lines.
- Commits end with the two attribution lines; the PR title starts with `feat:`. Tests: `npx vitest run <path>`, `venv/bin/pytest <path>`; whole: `npm test`, `npm run lint`, `npx vue-tsc --noEmit`, `venv/bin/pytest -q`.

## Review Focus

1. A child at Oberstufe who owns two of her shelf-1 items: his shelf 2 stays locked (only his own level counts); and the server agrees. (Task 2)
2. A purchase request for her item from the Oberstufe child (old page, or a crafted request) → `not_for_level`, nothing paid; the same for his item from her. (Task 2)
3. A level changed by the parents while a shop is open, or a worn item of the other level: still shown and wearable, never broken (worn/owned items keep working whatever their level). (Tasks 2, 4)
4. No language picked yet, or a stored value that isn't `en`/`fr`: English labels. (Task 4)
5. Every outfit and every look option has a 3D shape (no item invisible on the character). (Tasks 1, 3)

---

### Task 1: New hair and glasses for every child

**Files:** Modify `src/core/look.ts` (`HairStyle` + `'short' | 'messy'`, `Glasses` + `'sunglasses' | 'square'`, lists appended), `backend/app/wardrobe.py` (`LOOK_OPTIONS`), `src/components/LookScreen.vue` (icons: short ✂️, messy 🌪️, sunglasses 🕶️, square 🔲), `src/city/dress.ts` (shapes), tests (`tests/test_wardrobe.py`, `src/core/look.test.ts`, `src/city/dress.test.ts` if it exists, else a new one)
- [ ] **Step 1: Failing tests:** server: `LOOK_OPTIONS["hair"] == ["none","spiky","ponytail","buns","curly","short","messy"]`, glasses `[…,"sunglasses","square"]`; a look with `short` / `sunglasses` saved and read back. Client: `isLook` takes them; the client lists equal the server's (an existing test compares, or add one reading the same values); `dressParts` gives at least one mesh for every hair style but `none` and every glasses but `none`.
- [ ] **Step 2–4:** red, implement (short: a cap shell a little lower than `cap()`; messy: the cap plus 6–7 small tilted cones/spheres at random-looking fixed angles; sunglasses: two dark rounded-square lenses with a bridge; square: two square frames), green. **Step 5:** Commit `feat: new hair styles and glasses for every child`

### Task 2: His range in the catalogue, and the shop rules per level

**Files:** Modify `shared/outfits.json` (the 11 items above), `src/core/outfits.ts` (`OutfitDef.level?: 'oberstufe'`, `en?`, `fr?`; `levelOf(o): Level`; `forLevel(level): OutfitDef[]` sold items of a level; `shelfOpen(shelf, owned, level = 'kindergarten')` counting that level's items), `backend/app/outfits.py` (`Outfit.level = "kindergarten"`; `shelf_open(shelf, owned, level="kindergarten")`), `backend/app/wardrobe.py` (`buy`: refuse `not_for_level` when the item's level isn't the child's — read from `game._row(db, person_id).level`, before `owned`), tests (`tests/test_wardrobe.py` or `tests/test_shop.py` as the existing ones, `src/core/outfits.test.ts`)
- [ ] **Step 1: Failing tests:** catalogue: 11 Oberstufe items with the table's values, all with `en`/`fr`, unique ids, prices on shelves 1–3; her 15 sold + 4 gifts unchanged and without `level`. Rules: `forLevel('kindergarten')` = her 15, `forLevel('oberstufe')` = his 11; at Oberstufe two of her shelf-1 items don't open his shelf 2, two of his do. Server: at Oberstufe buying `hoodie` works (after the goal), buying `kleid` → 409 `not_for_level` with Stars unchanged; at Kindergarten buying `hoodie` → `not_for_level`; at Oberstufe owning `kappe` + `schal` and buying `kopfhoerer` → `shelf_locked`; owning `baseballkappe` + `hoodie` → bought. The wardrobe still lists and wears an owned item of the other level.
- [ ] **Step 2–4:** red, implement, green (`venv/bin/pytest -q`, `npm test`). **Step 5:** Commit `feat: his own range in the Kleiderladen catalogue`

### Task 3: His items on the character

**Files:** Modify `src/city/dress.ts` (a builder for each of the 11 ids), its test
- [ ] **Step 1: Failing test:** every outfit in `OUTFITS` (all levels) gives at least one mesh from `dressParts` when worn in its place.
- [ ] **Step 2–4:** red, implement in her style (simple spheres, shells, boxes, capsules): cap (her cap's shape, navy), beanie (a shell over the top with a small pompom), headphones (a band over the top and two discs at the sides), scarf (a ring with a hanging end, blue/white), medal (a gold disc on a red band), hoodie (a body shell in grey with a hood ring at the back), football shirt (a red body shell with a white cross: two flat boxes on the front), jacket (a dark green shell with a zip line), backpack (her backpack's shape, orange), skateboard (a flat rounded board with four wheels, on the back at an angle), guitar (a body of two spheres, a neck box, on the back at an angle). **Step 5:** Commit `feat: his clothes on the character`

### Task 4: The Kleiderladen at Oberstufe

**Files:** Create `src/core/vocab/lastLang.ts` (`lastPickedLang(owner: number | null, storage?: Storage): Lang` — the value `LanguagePick` stores, `en` when missing, unreadable or not `en`/`fr`), Modify `src/buildings/vokabeln/LanguagePick.vue` (use the same key constant), `src/buildings/laden/Laden.vue` (items = `forLevel(player.level)`; `shelfOpen` with the level; at Oberstufe a label), `src/buildings/shop/ShopShelves.vue` (optional `label?: (item) => { main: string; lang: string; de: string } | null` prop: rendered under the emoji, `data-test="item-label"`, main with its `lang` attribute, German smaller), tests (`Laden.test.ts`, `lastLang.test.ts`)
- [ ] **Step 1: Failing tests:** Kindergarten: exactly her 15 items, no labels (unchanged). Oberstufe: exactly his 11, labels "le sweat à capuche" / "der Hoodie" after French was last picked, "hoodie" / "der Hoodie" with nothing picked or a stored "de"; his shelf 2 locked while he owns only her items; buying his item works through the store. `lastPickedLang` reads what `LanguagePick` wrote.
- [ ] **Step 2–4:** red, implement, green (lint, types). **Step 5:** Commit `feat: the Kleiderladen at Oberstufe, labelled in his language`

### Task 5: Docs and browser check

**Files:** Modify `README.md`, `docs/roadmap.md`
- [ ] **Step 1:** README (the new looks; his range at Oberstufe, labelled), roadmap (piece 5 done).
- [ ] **Step 2:** Browser check on 5188: the look screen with the new hair and glasses (screenshots of each), the Kleiderladen at Oberstufe with labels (EN and FR), trying on each of his items (screenshot), the Kindergarten shop unchanged; no console errors.
- [ ] **Step 3:** `npm test && npm run lint && npx vue-tsc --noEmit && venv/bin/pytest -q` → clean. Commit `docs: README and roadmap for his own look`
