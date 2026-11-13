# Brightville – Stage 8 Design: Her Room – Trophy Shelf, Furniture and a Proper Wardrobe

Nov 13, 2026 · Andreas Frank

Roadmap item 2 of `docs/roadmap.md`: "Decorating the house: furniture and a trophy shelf."
Lines marked **(call)** are decisions made by Claude, not by Andreas. Everything else comes from Andreas, from the roadmap or from earlier stages.

## Intent

Mein Haus becomes her own room, something she shows off. When she proudly shows someone her room, she points at her stickers and trophies on a shelf (Andreas). The stickers she earned stand there as trophies.
The room can be furnished: furniture costs Stars, like the clothes, and what she bought is hers to keep and arrange.

## Goals

- **A trophy shelf** in the room, next to the sticker album: her stickers stand on it as trophies. Nothing to buy; it shows what she earned.
- **Furniture on fixed spots** (at least for now): each piece has its spot in the room. She can own several pieces for one spot and choose which one stands there, as with clothes in the wardrobe.
- **A new furniture shop in the town** where furniture costs Stars, with the Kleiderladen's rules: learn first, saved Stars count half, simple pieces first and fancier ones later on three shelves.
- **One purchase a day across both shops** together: something bought in the Kleiderladen means nothing more in the furniture shop that day, and the other way round.
- **The wardrobe becomes a proper, bigger wardrobe** in the room, drawn as a piece of furniture, instead of the small 🚪.

## Non-goals

- Placing furniture freely (dragging it anywhere). Fixed spots for now.
- Furniture as sticker gifts **(call)**: only clothes come with stickers.
- Selling back or refunds; parents giving or pricing furniture. **(call, as for clothes)**
- Furniture doesn't change any game or give anything; it's only for looking at.
- More rooms, or a house you walk into in 3D.

## Anti-goals

- A room that looks broken or empty before she bought anything.
- A shop that pushes (no countdowns, no nagging), and spending that skips learning: as for the Kleiderladen.
- A bought piece that can be lost.
- Anything that needs reading.

## Constraints

- Everything from earlier stages holds: German voice and pictures, English code, no CDN, the server is the truth for Stars and purchases, the 🔊 button and the leave button on every new screen, layout fit at 1024×768 (touch) and 1440×900.
- The Kleiderladen's rules and code (`shared/outfits.json`, `core/outfits.ts`, `backend/app/outfits.py`, `wardrobe.py` buy) are the model. Saved Stars and the half-value rule are shared: one savings, one Star count.
- New tables only through a new step in `MIGRATIONS`. Ids in the catalogue are forever (never renamed or removed), as for clothes.
- The room is the 2D house screen of today (`src/buildings/haus/`), not 3D. **(call)**

## Part A: the trophy shelf

- In the room, next to the sticker album (which stays as it is).
- Every sticker of the catalogue has its place on the shelf: earned ones stand as trophies (the sticker's picture on a small pedestal or cup **(call)**), not yet earned ones as faint outlines **(call)**, so she sees there is more to earn.
- Tapping a trophy says its name and what it was for, as in the album. Tapping an outline says what it is for **(call)**.
- A new sticker gets its trophy at once; the album's "new" glow is unchanged.
- With 17 stickers the shelf has two or three boards **(call)**; it must stay readable at iPad size.

## Part B: the furniture catalogue

One shared file, `shared/furniture.json`, read by page and server (like `outfits.json`): id, German name (spoken), article (der/die/das/pl), emoji, spot, shelf, price.

### Spots

Seven fixed spots (agreed): **Bild** (picture, on the wall), **Vorhang** (curtain, at the window), **Lampe** (lamp, from the ceiling), **Bett**, **Teppich** (rug), **Pflanze** (plant), **Spielzeug** (toy). One piece per spot at a time.

### Shelves (agreed with Andreas)

| Shelf | Opens | Price | Pieces |
|---|---|---|---|
| 1 | from the start | 15–25 ⭐ | 🌞 Sonnenbild, 🌵 Kaktus, ⭕ runder Teppich, 🔵 Punktevorhang, 🍄 Pilzlampe, 🛏️ Holzbett |
| 2 | once she owns 2 pieces from shelf 1 | 40–60 ⭐ | 🦄 Einhornbild, 🌻 Sonnenblume, 🌈 Regenbogenteppich, ⭐ Sternenvorhang, 🧸 Teddykiste, 🏕️ Zeltbett |
| 3 | once she owns 2 pieces from shelf 2 | 90–120 ⭐ | 🪐 Weltallbild, 🌴 Palme, 🧞 fliegender Teppich, 🌙 Mondlampe, 🏰 Burgbett, 🐻 Riesenteddy |

Furniture ids never equal a clothes id **(call)**: the Tagebuch and the parents' page look up both catalogues by id. Shelf 1 has nothing for the Spielzeug spot, so it shows its outline until shelf 2 opens. Which spot each piece goes on follows from its name (e.g. Teddykiste and Riesenteddy → Spielzeug, Kaktus/Sonnenblume/Palme → Pflanze); exact prices within each range are the builder's, written in the catalogue. The shelves count only furniture: clothes don't open furniture shelves and furniture doesn't open clothes shelves. **(call)**

## Part C: the furniture shop

- **In the town:** a new building with its own sign (🛋️ **(call)**), name **Möbelhaus** **(call)**. Its place is the builder's: near Mein Haus and the Kleiderladen if the town has room, passing every layout test (doors 3 m from other houses, clear of the playground and trampolines, inside the 60 m square). If no spot passes, see "What's left to the builder".
- **Door and rules:** exactly the Kleiderladen's: closed until today's learning visits are done ("Erst lernen, dann einkaufen!"), open after the play time is used up, entering costs nothing and counts no play time.
- **Inside:** like the Kleiderladen: three shelves of tiles (emoji, price next to a ⭐, ✔️ when owned, locked shelves greyed with 🔒 and the same hints); tapping a piece tries it; ✔️ with the price buys it; the same lines for too few Stars, already bought today, owned, catching up with the server.
- **Trying, before buying:** instead of her character, a small picture of her room shows the piece on its spot (with what else stands in the room). **(call: the room picture is the same drawing as the house's room, smaller)**
- **Buying:** the server takes the Stars (savings first, two for one) and the piece goes into her room on its spot at once, replacing what stood there (which she keeps). Cheer: "<Der/Die/Das Name> ist deiner/deine/deins!", confetti; "Ein neues Regal!" when a shelf opens.
- **One purchase a day across both shops** (agreed): the server refuses a second purchase of either kind the same day (`bought_today`), and both shops show the "Heute hast du schon etwas gekauft…" line.
- **The logbook** shows a furniture purchase like a clothes purchase (the piece's emoji, Stars spent, grey).

## Part D: her room

- **Layout:** the room of today (window, book on the table for the Tagebuch, album on a shelf for the stickers) with:
  - the **trophy shelf** next to the album (Part A);
  - the **wardrobe** as a proper, bigger wardrobe drawn as furniture (agreed), opening the Kleiderschrank as today;
  - the **seven spots**, each showing the piece placed there, drawn big enough to see from across the room (emoji-based or simple drawings **(call: emoji on the spot, large)**).
- **Empty spots** show a faint dashed outline, so she sees where something could go and the room never looks broken. **(call)**
- **Without the server:** placing a piece shows at once and is sent when the server answers again, as in the wardrobe; buying needs the server. **(call)**
- **Choosing a piece:** tapping a spot shows the pieces she owns for it (and "nothing"); a tap puts one there, as wearing in the wardrobe. Free, as often as she likes. Tapping a spot with nothing owned for it says that the Möbelhaus has things for it. **(call)**
- Everything (the book, album, shelf, wardrobe, spots) must remain tappable without overlapping at 1024×768 and 1440×900, below the leave and 🔊 buttons.

## Part E: the server

- **Catalogue rules** like `outfits.py`: shelves (2 from above), payment from savings two for one, the lone saved Star rule.
- **Tables (one new migration step):** what she owns (furniture, with when) and what stands on each spot. **(call: separate from clothes, or the existing tables with a kind column — builder's choice, as long as clothes keep working unchanged)**
- **Endpoints:** read her room (owned pieces, what stands where, bought today); place or remove a piece on a spot (only owned, only its own spot); buy a piece (same refusal codes as clothes: `locked`, `bought_today`, `shelf_locked`, `owned`, `poor`, `unknown`, `key_used`).
- **One purchase a day across both:** `bought_today` for either shop looks at any purchase today, clothes or furniture.
- **Parents' page:** each child's card also shows her furniture (emojis), read-only. **(call)**

## What's left to the builder

- Exact prices within each range, the spot of each piece, the room's drawing and the spots' positions, the trophy pedestal's look.
- The furniture shop's spot in the town. **If no spot passes the layout tests**, the builder may move the small trampoline or a hurdle of the playground, or widen the square a little, choosing the smallest change, and says which in the PR.
- How the room picture in the shop is shared with the house's room.
- Splitting the work into PRs (e.g. trophy shelf and wardrobe drawing first, then furniture server, then shop and room).
