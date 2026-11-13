# Stage 8 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Her room in Mein Haus: a trophy shelf with her stickers, a proper wardrobe, seven furniture spots, and a Möbelhaus in the town where furniture costs Stars (Kleiderladen rules, one purchase a day across both shops).

**Architecture:** Furniture mirrors the clothes of stage 7: a shared catalogue `shared/furniture.json`, rules written twice (`src/core/furniture.ts`, `backend/app/furniture.py`) on top of the generic shop rules that stage 7's outfits already have, a server module `backend/app/room.py` beside `wardrobe.py` sharing one purchase routine, a Pinia store `room`, and one room drawing (`RoomPicture.vue`) used both in the house (interactive) and in the shop (preview). The Kleiderladen screen's logic moves into a composable both shops use.

**Tech Stack:** Vue 3, Pinia, TypeScript, Vitest; FastAPI with sqlite3, pytest.

**Spec:** `docs/superpowers/specs/2026-11-13-brightville-stage8-design.md`

## Global Constraints

- German voice and pictures, English code; nothing needs reading; instructions through `instruct()` (🔊); leave and 🔊 buttons cover nothing.
- Spots: `bild`, `vorhang`, `lampe`, `bett`, `teppich`, `pflanze`, `spielzeug`; one piece per spot.
- Shelves: 1 open, 15–25 ⭐; 2 with 2 owned from shelf 1, 40–60 ⭐; 3 with 2 owned from shelf 2, 90–120 ⭐. Furniture and clothes open their shelves separately.
- One purchase a day **across both shops** (any event of kind `buy` today); learn first; play time no reason; saved Stars count half (`outfits.pay`); a key so a purchase sent twice buys once.
- Catalogue ids are forever and never equal a clothes id.
- Layout checked in Chrome at 1024×768 (touch) and 1440×900; new tables only through a new `MIGRATIONS` step; all checks green before each PR; merge commits.

## Review Focus

1. A purchase in one shop, then the other shop open in the same session: its ✔️ must not stay ready; the server's `bought_today` must be said and the page catch up. → test in Task 7 (`after a purchase in the Kleiderladen, the Möbelhaus knows`).
2. A spot holding a piece she doesn't own (old data, an id that left the catalogue): the room still draws, the spot shows its outline. → tests in Task 4 (`test_placed_must_be_owned_and_known`) and Task 5 (`draws an unknown piece as an empty spot`).
3. The trophy shelf at 1024×768 with all 17 stickers earned: every trophy tappable, nothing under the 🔊/leave buttons. → Chrome check in Task 2, and `shows all 17 places` in Task 1.
4. Placing furniture while the server is away, then the device changing hands: the change stays with the child who made it. → test in Task 5 (`keeps a placement with the child who made it`).
5. The Möbelhaus door before today's learning, after play time: same as the Kleiderladen. → test in Task 7 (`access` cases for the second shop).

---

## PR A: branch `stage8-room` (the room: trophies and the wardrobe)

### Task 1: The trophy shelf

**Files:**
- Create: `src/buildings/haus/Trophaeen.vue`, test cases in `src/buildings/haus/Haus.test.ts`
- Modify: `src/buildings/haus/Haus.vue`

**Interfaces:**
- `Trophaeen.vue`: no props; reads `usePlayerStore().stickers` and `STICKERS` (`@/core/stickers`). One button per catalogue sticker, `data-test="trophy"`, `data-id`, `data-earned`; earned: the sticker's emoji on a pedestal in its colour; not earned: a faint outline. A tap speaks `${name}. ${for}` when earned, `for` when not (as `Stickerheft` does).
- `Haus.vue`: the shelf stands in the room next to the album (the album button and `Stickerheft` stay).

- [ ] **Step 1: Write the failing tests** (`Haus.test.ts`, `describe('the trophy shelf')`): `shows all 17 places, earned ones as trophies` (with `api.stickers_ = [row('rechenprofi')]`: 17 `trophy`, exactly one `data-earned="true"`); `says a trophy\'s name and what it was for, and what an outline is for`.
- [ ] **Step 2: Run** `npx vitest run src/buildings/haus`. Expected: FAIL.
- [ ] **Step 3: Implement** `Trophaeen.vue` and place it in the room.
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat: a trophy shelf with her stickers in Mein Haus`.

### Task 2: The room laid out anew, with a proper wardrobe

**Files:**
- Create: `src/buildings/haus/Schrank.vue` (the wardrobe drawing, inline SVG), `src/buildings/haus/RoomPicture.vue`
- Modify: `src/buildings/haus/Haus.vue`, `Haus.test.ts`

**Interfaces:**
- `RoomPicture.vue`: props `placed: Partial<Record<Spot, string>>`, `interactive?: boolean`, `small?: boolean`; emits `spot: [spot: Spot]` (interactive only). Draws the room (wall, floor, window) and the seven spots at fixed positions in percent of the room: an empty spot is a faint dashed outline (`data-test="spot"`, `data-spot`, `data-empty="true"`), a placed piece its emoji, large (`data-empty="false"`). `Spot` comes from Task 3; until then this task defines `type Spot` in `src/core/furniture.ts` with the seven ids and `SPOTS` in the spec's order (Task 3 adds the rest of the module).
- `Haus.vue`: the room is `RoomPicture` (interactive) with the book (Tagebuch), the album, the trophy shelf and `Schrank.vue` laid over it; the wardrobe is a drawn wardrobe about as tall as the bed spot, `data-test="open-wardrobe"` unchanged. Until Task 6, `placed` is `{}` (every spot an outline) and taps on spots do nothing.

- [ ] **Step 1: Write the failing tests:** `shows seven spots, empty as outlines`; `opens the wardrobe from the drawn wardrobe` (existing test keeps passing with the new button); `keeps book, album, shelf and wardrobe separate buttons`.
- [ ] **Step 2: Run** them. Expected: FAIL (no spots).
- [ ] **Step 3: Implement** `Schrank.vue`, `RoomPicture.vue`, the new room in `Haus.vue`.
- [ ] **Step 4: Run** all checks; screenshot the room in Chrome at 1024×768 and 1440×900 with 0 and 17 trophies: nothing overlaps, nothing under the top-left buttons or 🏠.
- [ ] **Step 5: Commit** `feat: her room: seven spots, the trophy shelf and a proper wardrobe`; review, open PR A.

## PR B: branch `stage8-furniture` (after PR A)

### Task 3: The furniture catalogue and its rules

**Files:**
- Create: `shared/furniture.json`, `src/core/furniture.test.ts`, `backend/app/furniture.py`, `tests/test_furniture_rules.py`
- Modify: `src/core/furniture.ts` (from Task 2), `src/core/outfits.ts` (generic shelf rule), `backend/app/outfits.py`

**Interfaces:**
- `shelfOpenIn(defs: { id: string; shelf?: number }[], shelf: 1|2|3, owned: string[]): boolean` in `core/outfits.ts`; `shelfOpen` becomes `shelfOpenIn(OUTFITS, …)`. Python: `outfits.shelf_open_in(items, shelf, owned)`, `shelf_open` uses it.
- `core/furniture.ts`: `type Spot`, `SPOTS`, `interface FurnitureDef { id; name; article: 'der'|'die'|'das'|'pl'; emoji; spot: Spot; shelf: 1|2|3; price: number }`, `FURNITURE`, `furnitureDef(id)`, `furnitureShelfOpen(shelf, owned)`.
- `backend/app/furniture.py`: `Piece` dataclass, `catalogue()` (env `FURNITURE_FILE`), `piece(id)`, `SPOTS`, `shelf_open(shelf, owned)`.
- `shared/furniture.json`: the spec's 18 pieces, ids `sonnenbild`, `kaktus`, `teppichrund`, `punktevorhang`, `pilzlampe`, `holzbett`, `einhornbild`, `sonnenblume`, `regenbogenteppich`, `sternenvorhang`, `teddykiste`, `zeltbett`, `weltallbild`, `palme`, `fliegenderteppich`, `mondlampe`, `burgbett`, `riesenteddy`; spots: bilder → `bild`, Vorhänge → `vorhang`, Lampen → `lampe`, Betten → `bett`, Teppiche → `teppich`, Kaktus/Sonnenblume/Palme → `pflanze`, Teddykiste/Riesenteddy → `spielzeug`; prices shelf 1: 15, 15, 20, 20, 25, 25; shelf 2: 40, 40, 45, 50, 55, 60; shelf 3: 90, 90, 100, 100, 120, 110.

- [ ] **Step 1: Write the failing tests**, the same cases in both languages: every piece on a known spot, priced within its shelf's range, 6 per shelf; no id equals a clothes id; `furnitureShelfOpen(2, ['sonnenbild', 'kaktus'])` true; `(2, ['sonnenbild', 'schal'])` false (clothes don't count); `shelfOpen` for clothes unchanged (existing tests).
- [ ] **Step 2: Run** `npx vitest run src/core` and `venv/bin/pytest tests/test_furniture_rules.py tests/test_outfit_rules.py`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** them. Expected: PASS.
- [ ] **Step 5: Commit** `feat: the furniture catalogue and its rules`.

### Task 4: The server: her room, placing, buying furniture

**Files:**
- Create: `backend/app/room.py`, `backend/app/shop.py`, `tests/test_room.py`
- Modify: `backend/app/db.py` (migration), `backend/app/wardrobe.py` (buy through `shop.purchase`), `backend/app/main.py`, `backend/app/people.py`

**Interfaces:**
- Migration step: `CREATE TABLE furniture (person_id, item_id, got_at, PRIMARY KEY (person_id, item_id))`, `CREATE TABLE rooms (person_id INTEGER PRIMARY KEY, placed TEXT NOT NULL DEFAULT '{}')`.
- `shop.py`: `bought_today(db, person_id) -> bool` (any `buy` event today: both shops); `purchase(db, person_id, key, item_id, price, shelf_ok: bool, owned: bool, record: Callable[[], None]) -> game.State`: the stage 7 sequence in one `writing()` transaction (same key today → unchanged; other kind → `key_used`; owned → `owned`; goal → `locked`; `bought_today`; `shelf_locked`; `outfits.pay` → `poor`; take Stars; `record()`; log `buy` event with `building=item_id`). `wardrobe.buy` keeps its checks for `unknown` and `not_for_sale` and then calls it (its tests stay green unchanged).
- `room.py`: `state(db, person_id) -> {placed, owned: [{id, got_at}], bought_today}` (unknown or unowned ids left out); `place(db, person_id, changes: dict[str, Optional[str]])` (merge by spot; only owned, known pieces on their own spot); `buy(db, person_id, item_id, key) -> game.State` (unknown → `unknown`; then `shop.purchase`; record = insert into `furniture` and place it on its spot); `owned_ids`.
- Endpoints: `GET /api/room`, `PUT /api/room/placed {placed}`, `POST /api/moebel/buy {item, key}` → `{state, room}` (404 `unknown`, 409 the codes); `/api/wardrobe`'s `bought_today` and `/api/room`'s both come from `shop.bought_today`; `GET /api/players` rows gain `furniture: [ids]`.

- [ ] **Step 1: Write the failing tests** (`tests/test_room.py`, fixtures like `test_wardrobe.py`): `test_an_empty_room_until_something_is_bought`; `test_buying_places_the_piece_and_logs_it`; `test_one_purchase_a_day_across_both_shops` (clothes then furniture → `bought_today`, and the other way round; `/api/wardrobe` says `bought_today: true` after furniture); `test_furniture_shelves_ignore_clothes`; `test_saved_stars_count_half_for_furniture_too`; `test_swapping_pieces_on_a_spot` (two beds owned, place either; the other stays owned); `test_placed_must_be_owned_and_known`; `test_play_time_used_up_does_not_close_the_moebelhaus`; `test_parents_see_her_furniture`; `test_migration_adds_the_tables`.
- [ ] **Step 2: Run** `venv/bin/pytest tests/test_room.py`. Expected: FAIL.
- [ ] **Step 3: Implement** the migration, `shop.py` (moving the purchase sequence out of `wardrobe.buy`), `room.py`, the endpoints.
- [ ] **Step 4: Run** `venv/bin/pytest` (all: `test_wardrobe.py` unchanged and green), black, flake8, mypy.
- [ ] **Step 5: Commit** `feat: her room and buying furniture on the server`; review, open PR B.

## PR C: branch `stage8-moebelhaus` (after PR B)

### Task 5: The room store and API

**Files:**
- Create: `src/stores/room.ts`, `src/stores/room.test.ts`
- Modify: `src/services/api.ts`, `src/services/fakeApi.ts`, `src/stores/wardrobe.ts` (shared "bought today")

**Interfaces:**
- `api.ts`: `RoomState { placed: Partial<Record<Spot, string>>; owned: { id: string; got_at: string }[]; bought_today: boolean }`; `room()`, `setPlaced(changes)`, `buyFurniture(item, key) → { state, room }`; `PlayerRow.furniture?: string[]`. `fakeApi` mirrors the server (one `buy` a day shared with clothes: one flag for both).
- `useRoomStore()`: like `useWardrobeStore` (owner checks, `known`, `loaded`, laying waiting changes over answers, sending them on `load()`, dropping refusals for good, clearing only what was sent, the 5 s patience, newer answers winning) for `placed` only, key `brightville.room.<personId>`; `owned`, `boughtToday`, `placed` (filtered to owned once `known`), `load()`, `place(spot, id | null)`, `buy(item) → BuyResult` (keeps its key per item and day).
- Both stores: a successful purchase in one sets `boughtToday = true` in the other.
- `App.vue`: `room.init`/`load` beside the wardrobe store, and on every refresh.

- [ ] **Step 1: Write the failing tests:** `takes the server\'s room`; `places a piece at once while the server is away, and sends it later`; `keeps a placement with the child who made it`; `draws an unknown piece as an empty spot` (placed id unknown → `placed` without it); `buys furniture; then the wardrobe knows something was bought today`; `answers why a purchase is refused`.
- [ ] **Step 2: Run** `npx vitest run src/stores`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** all frontend checks. Expected: PASS.
- [ ] **Step 5: Commit** `feat: her room on the page`.

### Task 6: Furniture in her room

**Files:**
- Create: `src/buildings/haus/SpotChooser.vue`
- Modify: `src/buildings/haus/Haus.vue`, `Haus.test.ts`

**Interfaces:**
- `Haus.vue`: `RoomPicture :placed="room.placed" interactive @spot="choose"`. `SpotChooser.vue`: props `spot: Spot`; shows her pieces for that spot (`data-test="piece"`, `data-id`, `data-placed`) and a "nothing" tile (`data-test="piece-none"`); a tap calls `room.place(spot, id | null)` and closes. No pieces for the spot: `instruct('Im Möbelhaus gibt es etwas dafür.')` and closes.

- [ ] **Step 1: Write the failing tests:** `shows what she placed on its spot`; `swaps the bed for the other one she owns`; `takes a piece away with "nothing"`; `says where to get something for an empty spot`.
- [ ] **Step 2: Run** `npx vitest run src/buildings/haus`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat: furniture on its spots in her room, swapped with a tap`.

### Task 7: The Möbelhaus

**Files:**
- Create: `src/buildings/shop/useShop.ts`, `src/buildings/shop/ShopShelves.vue`, `src/buildings/moebel/Moebelhaus.vue`, `src/buildings/moebel/Moebelhaus.test.ts`
- Modify: `src/buildings/laden/Laden.vue` (uses `useShop` and `ShopShelves`; its tests unchanged and green), `src/buildings/registry.ts` (+ test), `shared/buildings.json`, `src/core/access.test.ts`

**Interfaces:**
- `useShop({ items, owned, shelfOpen, boughtToday, buy, catchUp })`: everything `Laden.vue` does today between its tiles and the voice (trying, ✔️ states, the lines, the cheer with article, catching up, the lost-answer lookup, double-tap guard, leave guard), returning `{ trying, tap, buy, ready, canBuy, celebrating, open }`. `ShopShelves.vue`: the three shelves of tiles (`data-test="shelf"`/`"item"` as today).
- `Moebelhaus.vue`: `useShop` over `FURNITURE` with the room store; the preview is `RoomPicture :placed="{ ...room.placed, [trying.spot]: trying.id }" small`; welcome `instruct('Willkommen im Möbelhaus! Tipp auf etwas, dann siehst du es in deinem Zimmer.')`.
- Registry: `{ id: 'moebel', spokenName: 'Möbelhaus', icon: '🛋️', kind: 'shop', needs: [] }` at a spot passing every layout test, near Mein Haus and the Kleiderladen if possible; if none passes, the smallest change allowed by the spec (move the small trampoline or a hurdle, or widen the square), said in the PR. `shared/buildings.json` gains `{ "id": "moebel", "kind": "shop" }`.

- [ ] **Step 1: Write the failing tests** (`Moebelhaus.test.ts`, like `Laden.test.ts`): three shelves, first open; trying shows the piece in the room preview; buying places it in her room (`room.placed`); `after a purchase in the Kleiderladen, the Möbelhaus knows` (✔️ not ready, the "Heute …" line, no request); savings count half; `access`: `doorState` for the Möbelhaus before the goal `locked`, after play time `open`; registry: the entry and the layout tests.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement** `useShop`/`ShopShelves` by moving code out of `Laden.vue` (its tests must stay green untouched), then `Moebelhaus.vue`, the registry entry.
- [ ] **Step 4: Run** all checks; screenshot the Möbelhaus and its door in the town at both sizes.
- [ ] **Step 5: Commit** `feat: the Möbelhaus`.

### Task 8: The logbook, the parents' page, the docs

**Files:**
- Modify: `src/buildings/haus/Tagebuch.vue`, `src/components/ParentArea.vue`, their tests, `README.md`, `docs/roadmap.md`

**Interfaces:**
- Lookups for `kind === 'buy'`: `outfitDef(id) ?? furnitureDef(id)` for name and emoji (ids never clash).
- Parent card: her furniture as emojis next to her clothes (`data-test="furniture"`), unknown ids left out.
- README: the Möbelhaus row, the room section (trophies, spots, swapping); roadmap: stage 8 done, item 2 struck, the calls.

- [ ] **Step 1: Write the failing tests:** a furniture purchase in the Tagebuch (`🛏️−25`, "Holzbett gekauft, …"); the parent card shows 🌵.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement** and update the docs.
- [ ] **Step 4: Run** all checks; end-to-end in Chrome as a new player: learn, buy a bed in the Möbelhaus, see it in the room, swap it, next day a Schal in the Kleiderladen.
- [ ] **Step 5: Commit** `feat: furniture in the logbook and on the parents' page`; review, open PR C.
