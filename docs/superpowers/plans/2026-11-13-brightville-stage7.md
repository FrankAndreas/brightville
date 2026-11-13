# Stage 7 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Her own wobbly character (look on the first visit), a shop (Kleiderladen) with three shelves where add-ons cost Stars (one purchase a day, saved Stars count half), sticker gifts, and a wardrobe in Mein Haus.

**Architecture:** One catalogue `shared/outfits.json` read by page and server. The shop's rules (shelves, shop money, paying from savings) are pure functions written twice, `src/core/outfits.ts` and `backend/app/outfits.py`, tested against the same numbers; the server is the truth. The character's look and add-ons are built from three.js primitives in `src/city/dress.ts` and hung on the blob; one preview (`src/city/preview.ts`) shows the same model in the look screen, the shop and the wardrobe.

**Tech Stack:** Vue 3, Pinia, TypeScript, three.js, Vitest; FastAPI with sqlite3, pytest.

**Spec:** `docs/superpowers/specs/2026-11-13-brightville-stage7-design.md`

## Global Constraints

- German voice and pictures for the child, English code; nothing needs reading. Instructions go through `instruct()` (the 🔊 button).
- Shelves: 1 open from the start, 15–25 ⭐; 2 opens with 2 owned from shelf 1, 40–60 ⭐; 3 opens with 2 owned from shelf 2, 90–120 ⭐. Sticker gifts never count towards a shelf and are never for sale.
- One purchase per day (home time zone, `clock.today()`). The shop has "learn first" (closed until today's goal) but no moon: play time is no reason to refuse.
- Saved Stars count half in the shop; everywhere else Stars count as before.
- New tables only through a new step in `MIGRATIONS`. Buying is one server transaction with a key: sent twice, it buys once.
- `npm test`, `npm run lint`, `npm run typecheck`, `venv/bin/pytest`, `black --check backend tests`, `flake8`, `mypy` all green before each PR. PR titles in Conventional Commits; merge commits, not squash.

## Review Focus

1. Two taps on ✔️ (or two devices) at once: at most one add-on per day, Stars taken once. → test in Task 2 (`test_two_purchases_at_once_buy_one`).
2. Odd or small savings: 1 saved Star and a price of 20 is paid from new Stars; savings never exceed Stars, Stars never go negative. → tests in Task 1 (`pay` table) and Task 2 (`test_savings_never_exceed_stars`).
3. A worn add-on the catalogue no longer has, or one she doesn't own (old device, edited JSON): ignored by the server and the model, the character still shows. → tests in Task 2 (`test_worn_must_be_owned_and_in_its_place`) and Task 3 (`dress ignores unknown ids`).
4. Midnight: bought at 23:59, the next purchase at 00:01 is allowed. → test in Task 2 (`test_a_new_day_allows_a_new_purchase`).
5. A parent lowering the Stars below the savings: the savings follow down; raising them adds full-value Stars. → test in Task 2 (`test_parent_star_change_clamps_savings`).

---

## PR A: branch `stage7-server`

### Task 1: The catalogue and the shop's rules

**Files:**
- Create: `shared/outfits.json`, `src/core/outfits.ts`, `src/core/outfits.test.ts`, `backend/app/outfits.py`, `tests/test_outfit_rules.py`

**Interfaces:**
- Produces (TS, `src/core/outfits.ts`):
  - `type Place = 'head' | 'neck' | 'body' | 'back'`; `PLACES: Place[]` in that order
  - `interface OutfitDef { id: string; name: string; emoji: string; place: Place; shelf?: 1 | 2 | 3; price?: number; sticker?: string }` (sold ones have `shelf` and `price`; gifts have `sticker`)
  - `OUTFITS: OutfitDef[]`, `outfitDef(id): OutfitDef | undefined`, `giftFor(stickerId): OutfitDef | undefined`
  - `shelfOpen(shelf: 1 | 2 | 3, owned: string[]): boolean`
  - `shopMoney(stars: number, savings: number): number` = `Math.floor(savings / 2) + (stars - savings)`
  - `pay(price, stars, savings): { stars: number; savings: number } | null` (null: not enough)
- Produces (Python, `backend/app/outfits.py`): `Outfit` dataclass with the same fields; `catalogue() -> list[Outfit]` (lru_cache, env `OUTFITS_FILE` like `stickers.py`); `outfit(id) -> Optional[Outfit]`; `gift_for(sticker_id)`; `shelf_open(shelf, owned) -> bool`; `shop_money(stars, savings) -> int`; `pay(price, stars, savings) -> Optional[tuple[int, int]]` returning `(stars, savings)`.
- Paying: `k = min(savings // 2, price)` price-Stars come from savings at two each, the rest `price - k` from new Stars (`stars - savings`); refused when that rest is more than the new Stars.

- [ ] **Step 1: Write `shared/outfits.json`**: the 15 sold add-ons and 4 gifts of the spec's tables, ids in ASCII (`schleife`, `kappe`, `schal`, `tshirt`, `rucksack`, `blumenkranz`, `perlenkette`, `kleid`, `umhang`, `zylinder`, `krone`, `ballettkleid`, `feenfluegel`, `astronaut`, `einhornmuetze`, gifts `glitzerband` ← `sternensammler`, `yogaband` ← `yogameister`, `discokette` ← `tanzstern`, `medaille` ← `ganzewoche`). Prices: shelf 1 = 15, 20, 20, 25, 25; shelf 2 = 40, 45, 50, 55, 60; shelf 3 = 90, 100, 110, 120, 100 (in the order of the spec's table).
- [ ] **Step 2: Write the failing tests** in both test files, same cases:
  - every sold add-on has a shelf and a price in its shelf's range, every gift names an existing sticker in `shared/stickers.json` and has no price
  - `shelfOpen(1, [])` true; `shelfOpen(2, ['schleife'])` false; `shelfOpen(2, ['schleife', 'kappe'])` true; `shelfOpen(2, ['schleife', 'glitzerband'])` false (gifts don't count); `shelfOpen(3, ['schleife','kappe','kleid','umhang'])` true
  - `shopMoney(90, 60) === 60`; `shopMoney(10, 0) === 10`; `shopMoney(1, 1) === 0`
  - `pay(20, 90, 60)` → `{stars: 50, savings: 20}`; `pay(20, 21, 1)` → `{stars: 1, savings: 1}`; `pay(20, 19, 0)` → null; `pay(100, 150, 150)` → null (shop money 75); `pay(20, 40, 30)` → `{stars: 10, savings: 0}` (15 from savings = 30 saved Stars, 5 new)
- [ ] **Step 3: Run them**: `npx vitest run src/core/outfits.test.ts` and `venv/bin/pytest tests/test_outfit_rules.py`. Expected: FAIL (modules missing).
- [ ] **Step 4: Implement both modules** to the interfaces above.
- [ ] **Step 5: Run them again.** Expected: PASS.
- [ ] **Step 6: Commit** `feat: the outfit catalogue and the shop's rules`.

### Task 2: The server: look, wardrobe, buying, savings, gifts

**Files:**
- Modify: `backend/app/db.py` (new migration step), `backend/app/game.py`, `backend/app/stickers.py`, `backend/app/main.py`, `backend/app/buildings.py` (kind `shop`), `shared/buildings.json` (`{ "id": "laden", "kind": "shop" }`)
- Create: `backend/app/wardrobe.py`, `tests/test_wardrobe.py`

**Interfaces:**
- Migration step (appended to `MIGRATIONS`):
  - `ALTER TABLE players ADD COLUMN savings INTEGER NOT NULL DEFAULT 0;`
  - `UPDATE players SET savings = stars;`
  - `CREATE TABLE looks (person_id INTEGER PRIMARY KEY, look TEXT NOT NULL, worn TEXT NOT NULL DEFAULT '{}')`
  - `CREATE TABLE outfits (person_id INTEGER NOT NULL, item_id TEXT NOT NULL, how TEXT NOT NULL, got_at TEXT NOT NULL, PRIMARY KEY (person_id, item_id))`, with `how` being `bought` or `gift`
- `game.State` gains `savings: int`, read from `players.savings` and stored by `_store`. Rule, everywhere `_store` writes: `savings = min(savings, stars)`. The Arcade and the parents' Star setting use this clamp; nothing else changes.
- `wardrobe.py`:
  - `Look = dict`, with keys `body`, `hair`, `hairColor`, `glasses`; values validated against the option lists in Task 3, copied into `LOOK_OPTIONS`
  - `state(db, person_id) -> dict`: `{ look: dict | None, worn: dict[str, str], owned: [{id, how, got_at}], bought_today: bool }`
  - `save_look(db, person_id, look)`; `wear(db, person_id, worn: dict[str, Optional[str]])`, which keeps only owned, known add-ons, each in its own place
  - `buy(db, person_id, item_id, key) -> State`, which raises `game.Refused(code)` with `locked | bought_today | shelf_locked | owned | poor | not_for_sale | unknown`
  - `give_gifts(db, person_id) -> list[str]`: ids of newly given gifts
- `buy`, in one `writing()` transaction:
  1. A key seen today returns the state unchanged.
  2. Check the codes in this order: unknown → not_for_sale → owned → locked (goal not reached) → bought_today (an event of kind `buy` today) → shelf_locked → poor (`outfits.pay` gives None).
  3. Then: the new stars and savings from `pay`; insert into `outfits` (`bought`); put it on in its place; log the event `kind='buy'`, `building=item_id`, `stars=-(stars taken)`.
- `stickers.award`: after giving stickers (also when none are new), call `wardrobe.give_gifts` for every owned sticker whose gift isn't owned yet. Its answer is unchanged (sticker ids); gifts show through the wardrobe state.
- Endpoints in `main.py` (all `Depends(auth.current_person)`):
  - `GET /api/wardrobe` → `wardrobe.state`
  - `PUT /api/look` `{look}` → `wardrobe.state`; 422 `bad_look`
  - `PUT /api/worn` `{worn}` → `wardrobe.state`
  - `POST /api/shop/buy` `{item, key}` → `{ state, wardrobe }`; 409 with the codes above (404 for `unknown`)
  - `GET /api/players` rows gain `savings` and `owned: [ids]`, for the parents' page
- `buildings.py`: a `shop` kind is accepted. `building_of` callers don't need it, since the shop isn't a visit.

- [ ] **Step 1: Write the failing tests** in `tests/test_wardrobe.py`, using the `mia`/`papa` fixtures and `set_time`:
  - `test_no_look_until_saved_then_kept`: `GET /api/wardrobe` gives `look: None`; after `PUT /api/look`, it's the saved look; an unknown hair → 422 `bad_look`
  - `test_shop_waits_for_the_daily_goal`: 0 visits → 409 `locked`; after two visits → 200
  - `test_play_time_used_up_does_not_close_the_shop`: with `play_minutes` 5 and 300 s played, buying still works
  - `test_one_purchase_a_day`: the second buy the same day → 409 `bought_today`; the same key again → 200, nothing taken twice
  - `test_a_new_day_allows_a_new_purchase`: bought at 23:59, a buy at 00:01 the next day (goal reached again) → 200
  - `test_two_purchases_at_once_buy_one`: two threads, different keys, same moment → one 200, one 409, the Stars taken once
  - `test_shelves_open_with_two_from_above` and `test_gifts_are_not_for_sale_and_do_not_open_shelves`
  - `test_saved_stars_count_half`: Stars 90 with savings 60 (set in SQL) → buy `schal` (20) → Stars 50, savings 20; the event `buy` shows −40 in `/api/logbook`
  - `test_savings_never_exceed_stars`: savings 50, Stars 50, an Arcade round → Stars 47, savings 47
  - `test_parent_star_change_clamps_savings`: savings 60, parent sets 30 → savings 30; parent sets 100 → savings stay 30
  - `test_migration_notes_savings`: a database at the step before with a player of 140 Stars → after `connect()`, savings 140
  - `test_worn_must_be_owned_and_in_its_place`: wearing `krone` unowned, or `schal` as `head`, or `"weg"` → left out
  - `test_sticker_gifts_arrive_with_and_after_the_sticker`: 100 Stars earned → `sternensammler` and `glitzerband` owned (`how: gift`); a database where the sticker existed before → gift on the next `GET /api/stickers`
  - `test_parents_see_savings_and_owned`
- [ ] **Step 2: Run** `venv/bin/pytest tests/test_wardrobe.py`. Expected: FAIL.
- [ ] **Step 3: Implement** the migration, `game.State.savings` with the clamp, `wardrobe.py`, the gift call in `stickers.award` and the endpoints.
- [ ] **Step 4: Run** `venv/bin/pytest`, `black --check backend tests`, `flake8 …`, `mypy`. Expected: all green, older tests included (the `State` dict now has `savings`; fix any exact-dict assertions in older tests).
- [ ] **Step 5: Commit** `feat: wardrobe, shop and savings on the server`; open PR A.

## PR B: branch `stage7-look` (after PR A)

### Task 3: Her look on the 3D character

**Files:**
- Create: `src/core/look.ts`, `src/core/look.test.ts`, `src/city/dress.ts`, `src/city/dress.test.ts`
- Modify: `src/city/blob.ts`

**Interfaces:**
- `src/core/look.ts`:
  - `interface Look { body: string; hair: HairStyle; hairColor: string; glasses: Glasses }`
  - `type HairStyle = 'none' | 'spiky' | 'ponytail' | 'buns' | 'curly'`
  - `type Glasses = 'none' | 'round' | 'star' | 'heart'`
  - `BODY_COLORS` (8 hex strings, `#ff9a3c` first), `HAIR_COLORS` (6), `HAIR_STYLES`, `GLASSES`
  - `DEFAULT_LOOK` (orange, no hair, brown, none), `randomLook(rnd = Math.random): Look`
  - `isLook(x: unknown): x is Look`, the same rules as the server's `LOOK_OPTIONS`
- `interface Dress { look: Look; worn: Partial<Record<Place, string>> }`
- `src/city/dress.ts`: `dressParts(dress: Dress): { body: number; limbs: number; head: THREE.Object3D[]; face: THREE.Object3D[]; neck: THREE.Object3D[]; torso: THREE.Object3D[]; back: THREE.Object3D[] }`
  - Meshes are built from primitives, positioned in the blob's `lean` space (body sphere r 0.5 scaled y 1.15 at y 0.62; eyes at y 0.82, z 0.4).
  - Unknown ids are skipped.
  - The limb colour is the body colour darkened by 8 % (today `0xf07f1b` for orange).
- `createBlob(dress?: Dress)` returns `{ object, update, setDress(dress: Dress): void }`. `setDress` swaps the colour on the existing materials, and removes and adds the parts in groups that already ride on `lean`, so they wobble with it.

- [ ] **Step 1: Write the failing tests:**
  - `look.test.ts`: `isLook(DEFAULT_LOOK)`; `isLook({...DEFAULT_LOOK, hair: 'mohawk'})` false; `randomLook(() => 0)` is the first of each list
  - `dress.test.ts`, each counting meshes in the returned groups:
    - `dressParts({look: DEFAULT_LOOK, worn: {}})` has no hair, glasses or add-on parts
    - `hair: 'buns'` gives ≥ 2 head parts
    - `glasses: 'round'` gives face parts
    - `worn: {head: 'krone', back: 'feenfluegel'}` gives head and back parts
    - `worn: {head: 'gibtsnicht'}` gives none and doesn't throw
    - every catalogue id builds at least one part in its own place (loop over `OUTFITS`)
    - `createBlob().setDress(...)` twice leaves only the second dress's parts
- [ ] **Step 2: Run** `npx vitest run src/core/look.test.ts src/city/dress.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `look.ts`, `dress.ts` and the blob changes. Each add-on reads as itself from behind too: wings and capes stand out on the back, crowns and hats sit above the eyes.
- [ ] **Step 4: Run** the tests, plus `npx vitest run src/city`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: hair, glasses and add-ons on the wobbly character`.

### Task 4: The wardrobe store, the API and the preview

**Files:**
- Create: `src/stores/wardrobe.ts`, `src/stores/wardrobe.test.ts`, `src/city/preview.ts`, `src/components/CharacterView.vue`
- Modify: `src/services/api.ts`, `src/services/fakeApi.ts`, `src/city/city.ts`, `src/city/CityView.vue`, `src/App.vue`

**Interfaces:**
- `api.ts`:
  - `interface WardrobeState { look: Look | null; worn: Partial<Record<Place, string>>; owned: { id: string; how: 'bought' | 'gift'; got_at: string }[]; bought_today: boolean }`
  - `wardrobe(): Promise<WardrobeState>`, `saveLook(look): Promise<WardrobeState>`, `setWorn(worn): Promise<WardrobeState>`, `buy(item, key): Promise<{ state: ServerState; wardrobe: WardrobeState }>`
  - `ServerState` gains `savings: number`
  - `fakeApi` implements the same rules as the server, as it does for plays
- `useWardrobeStore()` (Pinia), with `init(api, personId, storage?)` like the player store:
  - state: `look`, `worn`, `owned`, `boughtToday`, `loaded`, and `dress: computed<Dress>` (`DEFAULT_LOOK` while `look` is null)
  - `load()`
  - `saveLook(look)` and `wear(place, id | null)`: both show at once; while the server is away they're kept in localStorage under `brightville.wardrobe.<personId>` and sent with the next `load()`
  - `buy(item): Promise<'ok' | 'offline' | code>`: no offline buying; it updates the player store's Stars from `state`
- `src/city/preview.ts`: `createPreview(canvas: HTMLCanvasElement): { setDress(d: Dress): void; dispose(): void }`, a small scene with the blob idling and turning slowly. In jsdom (no WebGL) it isn't called, because the tests mock it.
- `CharacterView.vue`: props `dress: Dress`, `size?: number`; mounts the preview and calls `setDress` on change.
- `City.setDress(dress: Dress)`; `CityView` takes a `dress` prop and calls it on change; `App.vue` passes `wardrobe.dress`.

- [ ] **Step 1: Write the failing tests** in `wardrobe.test.ts`:
  - `load` takes the server's state, and `dress` uses `DEFAULT_LOOK` while `look` is null
  - `wear('head', 'krone')` while offline shows at once; after going online, `load()` sends it (`api.calls` contains `setWorn`)
  - `buy` answers `bought_today` and `poor` as codes, and `offline` when the server is away (nothing changed)
  - a switch to another person while an answer is pending drops that answer (the owner check, as in the player store)
- [ ] **Step 2: Run** `npx vitest run src/stores/wardrobe.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the API methods, the fake, the store, the preview, `CharacterView`, and `City.setDress` with the `CityView` prop. In `App.vue`, init and load the wardrobe store where the player store is initialised.
- [ ] **Step 4: Run** `npx vitest run`, `npm run typecheck`. Expected: PASS (update `ServerState` literals in older tests with `savings: 0`).
- [ ] **Step 5: Commit** `feat: the wardrobe on the page, and the character's preview`.

### Task 5: The look screen on the first visit

**Files:**
- Create: `src/components/LookScreen.vue`, `src/components/LookScreen.test.ts`
- Modify: `src/App.vue`, `src/App.test.ts`

**Interfaces:**
- `LookScreen.vue`: prop `start: Look`; emits `done: [look: Look]`.
  - It has four rows of big picture buttons (body colour, hair style, hair colour, glasses), a `CharacterView` in the middle, a 🎲 button (`randomLook`) and a ✔️ button.
  - On mount it says `instruct('So siehst du aus! Tipp auf die Farben und Haare, dann auf den Haken.')`.
- `App.vue`: once the session is `ready` and the wardrobe is `loaded` with `look === null`, it shows `LookScreen` instead of the town. On `done` it calls `wardrobe.saveLook(look)`, and the town starts. Its existing help for new players (0 Stars) comes after the look screen.

- [ ] **Step 1: Write the failing tests:**
  - `LookScreen.test.ts` (with `@/city/preview` mocked):
    - tapping a colour, then ✔️, emits `done` with that colour
    - 🎲 changes the look
    - the instruction is spoken
  - `App.test.ts`:
    - with a fake wardrobe with `look: null`, the look screen shows and the town doesn't start; after `done`, `saveLook` was called and the town shows
    - with a saved look, no look screen
- [ ] **Step 2: Run** `npx vitest run src/components/LookScreen.test.ts src/App.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the screen and the App gate.
- [ ] **Step 4: Run** all checks. Check in Chrome at 1024×768 (touch) and 1440×900 that all four rows fit without scrolling, using the scratchpad test-page approach from the UX review.
- [ ] **Step 5: Commit** `feat: she designs her character on the first visit`; open PR B.

## PR C: branch `stage7-shop` (after PR B)

### Task 6: The shop building (Kleiderladen)

**Files:**
- Create: `src/buildings/laden/Laden.vue`, `src/buildings/laden/Laden.test.ts`
- Modify: `src/buildings/types.ts` (`kind: 'earn' | 'play' | 'free' | 'shop'`), `src/core/access.ts`, `src/core/access.test.ts`, `src/buildings/registry.ts`, `src/buildings/registry.test.ts`, `src/App.vue`

**Interfaces:**
- `doorState`: a `shop` building is `locked` before today's goal and `open` after. It's never `timeUp` or `poor`.
- Registry entry: `{ id: 'laden', spokenName: 'Kleiderladen', icon: '👗', kind: 'shop', needs: [] }`.
  - Its door goes on the right, if the layout tests allow a fifth door there. If not, front right of the house at a spot that passes all layout tests (`keeps … from overlapping`, `3 m to any other house`, the playground at x 5–16, z 20–24).
  - The registry side test maps `shop` to wherever it stands.
- `App.vue`: the closed door says what the Arcade's says ("Erst lernen, dann …"; reuse `doorLine`). The shop counts no play time and no visit. Its result `{ stars: 0 }` is ignored.
- `Laden.vue` (uses `useWardrobeStore`, `usePlayerStore`, `CharacterView`):
  - layout: three shelf rows (emoji tile, price as a number next to ⭐, ✔️ when owned), locked shelves greyed with 🔒, her character next to them
  - tapping an add-on tries it on and says `instruct('<Name>. <Zahlwort> Sterne.')`
  - a locked shelf says how many are still needed
  - the ✔️ shows the price; it's greyed when `shopMoney < price` (says the missing amount in words) or when `boughtToday` (says "Heute hast du schon etwas gekauft. Morgen kannst du wieder etwas aussuchen.")
  - buying cheers "<Der/Die/Das Name> ist deiner!" plus confetti, and "Ein neues Regal!" when a shelf opened

- [ ] **Step 1: Write the failing tests:**
  - `access.test.ts`: `shop` before the goal → `locked`; after the goal with 0 Stars and with play time used up → `open`
  - `Laden.test.ts` (fake API, preview mocked):
    - shelf 2 and 3 tiles are locked at first
    - tapping `schal` tries it on (the store's dress, the spoken price)
    - ✔️ buys and the tile shows owned; a second ✔️ on another add-on the same day says the "Heute …" line and calls nothing
    - with savings 60 and Stars 70, `kappe` (20) is buyable and the Star counter drops by 40
    - buying the second shelf-1 add-on says "Ein neues Regal!"
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement** the kind, `doorState`, the registry entry, the App lines and `Laden.vue`.
- [ ] **Step 4: Run** all checks, then screenshot the town and the shop at both sizes. The door and its 👗 sign must be visible with the new camera, and the top-left buttons must cover nothing.
- [ ] **Step 5: Commit** `feat: the Kleiderladen, three shelves, one purchase a day`.

### Task 7: The wardrobe in Mein Haus

**Files:**
- Create: `src/buildings/haus/Kleiderschrank.vue`, test cases in `src/buildings/haus/Haus.test.ts`
- Modify: `src/buildings/haus/Haus.vue`

**Interfaces:**
- `Haus.vue`:
  - `view` gains `'wardrobe'`; a third object in the room, a wardrobe 🚪👚, with key `Digit3`
  - the welcome line becomes "Willkommen zu Hause! Tipp auf das Buch, auf den Stern oder auf den Schrank."
- `Kleiderschrank.vue`:
  - `CharacterView` with the store's dress, and tiles of owned add-ons grouped by `PLACES`
  - a tap calls `wardrobe.wear(place, id)`, and a worn one calls `wear(place, null)`
  - a ✏️ button opens `LookScreen` with the current look; `done` calls `saveLook`
  - empty: the shop's 👗 and `instruct('Im Kleiderladen kannst du dir etwas aussuchen.')`

- [ ] **Step 1: Write the failing tests** in `Haus.test.ts`:
  - the third object opens the wardrobe
  - an owned `kappe` tile puts it on (`setWorn` called); tapping it again takes it off
  - empty wardrobe → the shop line
  - ✏️ → look screen → ✔️ saves the look
- [ ] **Step 2: Run** `npx vitest run src/buildings/haus`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the tests. Expected: PASS.
- [ ] **Step 5: Commit** `feat: the wardrobe in Mein Haus`.

### Task 8: Gifts in the parade, purchases in the logbook, the parents' page, the docs

**Files:**
- Modify: `src/components/StickerParade.vue`, `src/core/diary.ts`, `src/buildings/haus/Tagebuch.vue`, `src/components/ParentArea.vue`, their tests, `README.md`, `docs/roadmap.md`

**Interfaces:**
- `StickerParade`: when `giftFor(stickerId)` exists, its emoji shows next to the sticker, and the line adds "Und dazu: <Name>!". After a parade, `wardrobe.load()` refreshes the wardrobe.
- `diary.ts`:
  - an entry with `kind === 'buy'` names the add-on (`outfitDef(entry.building)`): `entrySaid` gives "<Name> gekauft, <Sterne>."; `dayLine` gives "<Name> −<n>"
  - `LogEntry['kind']` gains `'buy'`
  - `Tagebuch.vue` shows the add-on's emoji
- `ParentArea`: each child's card shows "davon gespart: <savings>" next to the Stars, and her owned add-ons as emojis (read-only).
- Docs:
  - `README.md`: the Kleiderladen row in the building table, plus a section on her look, the shop, savings and the wardrobe
  - `docs/roadmap.md`: stage 7 done, and the savings rule and prices under "Calls made"

- [ ] **Step 1: Write the failing tests:**
  - the parade with `sternensammler` shows ✨ and says "Und dazu: Glitzer-Stirnband!"
  - `entrySaid({kind: 'buy', building: 'krone', stars: -100, …})` → "Krone gekauft, hundert Sterne."
  - the parent card shows "davon gespart: 140" and 🎀
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement**, and update the docs.
- [ ] **Step 4: Run** all checks, then deploy to a scratch backend and walk through it end to end in Chrome: a new player, the look, two learning visits, the shop, a purchase, the wardrobe, the next day.
- [ ] **Step 5: Commit** `feat: gifts in the parade, purchases in the logbook, the parents see the wardrobe`; open PR C.
