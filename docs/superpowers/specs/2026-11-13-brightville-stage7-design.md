# Brightville – Stage 7 Design: Her Own Character, the Shop and the Wardrobe

Nov 13, 2026 · Andreas Frank

Roadmap item 1 of `docs/roadmap.md`: "Dressing up the character: colours, hats, outfits, some unlocked by stickers. Gives the stickers a use."
Lines marked **(call)** are decisions made by Claude, not by Andreas. Everything else comes from Andreas, from the roadmap or from earlier stages.

## Intent

The wobbly character in the town becomes hers. On her first visit she designs how it looks, for free. After that, things to put on it (add-ons) are something she earns: they cost Stars in a new shop in the town, so the Stars she saves have something to save for, beyond rounds in the Arcade.
What she has bought is hers to keep. It waits in her house, where she puts it on and takes it off as she likes.

In Andreas' words: it doesn't matter what she is wearing herself; this is the dress for the wobbly avatar. The add-ons come on top of the look she chose.

## Goals

- **Her look, on the first visit:** before the first walk in the town, each player designs her character: body colour, hair (style and colour), glasses. Free. **(call: these four choices cover Andreas' "colour, hair, glasses, …")**
- **The shop (Kleiderladen):** a new building in the town where add-ons cost Stars.
  - Small things about one day of playing, big ones about a week.
  - Progression: simple things first, fancier ones unlock later, on three shelves.
  - The shop follows "learn first": its door opens only once today's learning visits are done, even with Stars enough.
- **Sticker gifts:** some add-ons are never sold; they come with a sticker. This gives the stickers a use.
- **The wardrobe in Mein Haus:** everything she owns, to put on and take off, free and as often as she likes.
- **What she wears shows on her character in the town**, on every device (kept on the server).

## Non-goals

- No decorating the house, no furniture, no trophy shelf (roadmap item 2, later).
- Parents can't give, take away or price add-ons. **(call)** The catalogue lives in a file.
- Nothing can be sold back; no refunds. **(call)** A child who regrets a purchase still has it in the wardrobe.
- Add-ons give no advantage in any game. They are only for looking at.
- No real-money anything, no ads, no random packs: every add-on is seen, with its price, before buying.

## Anti-goals

- A shop that pushes: no "only today", no countdowns, no flashing "buy" calls, no voice nagging her to spend.
- Spending that skips learning: Stars alone never open the shop.
- An add-on that, once bought, can be lost.
- Anything that needs reading. Prices are shown as a number next to a Star, and the voice says them.

## Constraints

- Everything from earlier stages holds: German voice and pictures for the child, English code, no CDN, works offline once loaded (except the Cinema), the server is the truth for Stars.
- The character is a 3D blob built from three.js primitives in `src/city/blob.ts`. Hair, glasses and add-ons are built the same way, in code, from simple shapes: no model files. **(call)**
- New buildings follow the building contract: a Vue component reporting `{ stars }`, listed in `src/buildings/registry.ts` and `shared/buildings.json`.
- The server gains tables only through a new step in `MIGRATIONS` in `backend/app/db.py`.
- Buying takes Stars on the server, like a round of play: the page never decides alone that something was paid for.
- The 🔊 button (`instruct()`), the leave button and the parent gate from earlier today apply to the new screens too.

## Part A: her look

### When

- The first time a player enters the town and has no look yet, the look screen comes before the town. This includes children who already play today (they have no look yet) and parents who play. **(call)**
- She can change her look again later in the wardrobe, for free. **(call)**
- Until a look is saved, the character is the orange blob of today. **(call)**

### What she chooses **(call)**

| Choice | Options |
|---|---|
| Body colour | 8 bright colours, today's orange first |
| Hair style | none, short spiky, ponytail, two buns, curly |
| Hair colour | 6 colours (brown, black, blond, red, blue, pink) |
| Glasses | none, round, star-shaped, heart-shaped |

- One row of big picture buttons per choice, all on one screen. Her character, large, turns slowly in the middle and changes at once with each tap.
- A big ✔️ finishes. The voice explains: "So siehst du aus! Tipp auf die Farben und Haare, dann auf den Haken." (exact words: builder's choice).
- A 🎲 button picks a random look, for a child who doesn't want to choose. **(call)**

## Part B: the catalogue

One shared file, `shared/outfits.json`, read by the page and the server (as `buildings.json` and `stickers.json` are). Each add-on: id, German name (spoken), emoji (for the shop and wardrobe tiles), place, shelf or sticker, price.

### Places

One add-on per place at a time: **head** (hats, crowns, bows, headbands), **neck** (scarves, necklaces, medals), **body** (dresses, shirts, costumes), **back** (wings, capes, backpacks). Hair stays visible under head add-ons where it can; a hat may hide hair. **(call)**

### Shelves (agreed with Andreas)

| Shelf | Opens | Price | Add-ons |
|---|---|---|---|
| 1 | from the start | 15–25 ⭐ (about one day) | 🎀 Schleife (head), 🧢 Kappe (head), 🧣 Schal (neck), 👕 T-Shirt (body), 🎒 Rucksack (back) |
| 2 | once she owns 2 add-ons from shelf 1 | 40–60 ⭐ (2–3 days) | 🌸 Blumenkranz (head), 📿 Perlenkette (neck), 👗 Kleid (body), 🦸 Umhang (back), 🎩 Zylinder (head) |
| 3 | once she owns 2 add-ons from shelf 2 | 90–120 ⭐ (about a week) | 👑 Krone (head), 🩰 Ballettkleid (body), 🧚 Feenflügel (back), 🚀 Astronautenanzug (body), 🦄 Einhorn-Mütze (head) |

Exact prices within each range: builder's choice, written in the catalogue file. Sticker gifts never count towards opening a shelf. **(call)**

### Sticker gifts (agreed with Andreas)

Never sold. When she earns the sticker, the add-on goes straight into her wardrobe, and the sticker celebration in the town shows it too.

| Sticker | Add-on |
|---|---|
| ⭐ Sternensammler | ✨ Glitzer-Stirnband (head) |
| 🧘 Yoga-Meister | 🧘 Yoga-Stirnband (head) |
| 💃 Tanzstern | 🪩 Discokugel-Kette (neck) |
| 🏅 Eine ganze Woche | 🏅 Medaille (neck) |

A child who already has one of these stickers gets the gift on her next visit. **(call)**

## Part C: the shop (Kleiderladen)

- **In the town:** a new building with a 👗 sign, in the "playing" row on the right. Exact spot: builder's choice. **(call: it belongs with the buildings that cost Stars)**
- **Door:** follows "learn first" like the Arcade. The door stays closed until today's learning visits are done, with the same closed-door look and voice. When she's done and has fewer Stars than the cheapest add-on she doesn't own, the door is still open: she can look, and save up. **(call)** Time in the shop is not play time, and entering costs nothing.
- **Play time (Andreas):** the shop stays open after today's play time is used up. The parents' play-time limit means "no more games today", not "no more shop". So the shop is a building kind of its own (not `play`): it has the "learn first" lock but no moon.
- **One purchase per day (Andreas):** after buying one add-on, she can still look and try things on, but the ✔️ is greyed until tomorrow, and the voice says so ("Heute hast du schon etwas gekauft. Morgen kannst du wieder etwas aussuchen."). The new day starts at midnight at home, as the daily goal does. This, with the shelves, spreads the shop over weeks even for a child with many Stars saved.
- **Inside:**
  - Three shelves, one above the other. Each add-on is a tile with its emoji and its price as a number next to a ⭐. Owned ones show a ✔️ instead of a price.
  - A locked shelf is greyed with a 🔒; tapping it says how many more from the shelf above open it ("Kauf noch ein Teil von oben, dann geht dieses Regal auf.").
  - Her character stands next to the shelves.
- **Trying on:** tapping an add-on puts it on her character there and then, and the voice says its name and price ("Die Krone. Hundert Sterne."). A big ✔️ with the price buys it; tapping another add-on or the character again takes it off. **(call)**
- **Too few Stars:** the ✔️ is greyed; the voice says how many more she needs ("Dafür brauchst du noch zwanzig Sterne."). Nothing else happens. **(call)**
- **Buying:** the server takes the Stars. On success: a cheer, the add-on goes into her wardrobe and she wears it right away. **(call)** A shelf that opens with this purchase is celebrated ("Ein neues Regal!").
- **The logbook** shows a purchase like a round of play (the add-on's emoji and the Stars spent). **(call)**

### Saved Stars count half (Andreas: "saved stars count less, things should feel expensive")

Stars have piled up since stage 4; without this, a child with a few hundred saved would buy her way through the shelves in days. Andreas wants the Stars saved before the shop count for less, so things feel expensive.

How it works **(call: Andreas, please check this one)**:

- **The savings are fixed once.** When stage 7 arrives, each player's Star count at that moment is noted as her savings. It is noted the first time the server meets her after the update, before she can buy anything.
- **In the shop, savings count half.** An add-on is paid first from savings, at two saved Stars per price Star. The rest is paid from Stars earned since, one for one.
  - Example: with 60 saved and 30 earned since, the Schal for 20 takes 40 of the savings.
  - What's left of the savings stays savings until it's used up.
- **What she sees:**
  - The price on the tile is always the real price.
  - What decides whether she can buy is her shop money: half her remaining savings plus everything earned since. The ✔️ greys and the voice says what's missing by that count.
  - The Star counter in the town keeps showing all her Stars, so after buying the Schal from savings it drops by 40, not 20. The cheer says the price ("Der Schal ist deiner!"), not the Stars taken.
- **Everywhere else, Stars count as before.** The Arcade, Schlange, Bonbonjagd and Kino still take saved Stars one for one, and the parents' page sets the Star count as before.
- **When a parent changes the Star count,** the savings become the lower of the old savings and the new count. Stars a parent adds count fully in the shop; only the original savings count half.
- **The parents' page** shows each child's remaining savings next to her Stars ("davon gespart: 140"), so the numbers can be explained.
- A player who first plays after the update has no savings: everything she earns counts fully.

## Part D: the wardrobe in Mein Haus

- A third thing in the room, next to the book and the sticker album: a wardrobe (🚪👚). Mein Haus' voice line names all three. **(call)**
- **Inside:** her character, large, and below it her add-ons as tiles, grouped by place. Tapping a tile puts it on (taking off what was in that place); tapping a worn one takes it off. Free, any number of times.
- A ✏️ button opens the look screen of Part A to change colour, hair or glasses. **(call)**
- Nothing to buy here, and no prices.
- The wardrobe is empty at first. Then it shows a picture of the shop's 👗 sign and the voice says that she can buy things in the shop. **(call)**

## Part E: the character in the town

- The blob in `src/city/blob.ts` takes a look (colour, hair, glasses) and what she wears, and builds them from simple 3D shapes. Add-ons move with the body: head things on the head, back things on the back, so they wobble along.
- The same character is shown, smaller, in the look screen, the shop and the wardrobe (a small three.js view). **(call: one model everywhere, so what she sees in the shop is what walks in the town)**
- Each player sees her own character. Only the person playing on a device is shown; there are no other players in the town.

## Part F: the server

- **Tables (one new migration step):**
  - a player's look and what she wears;
  - what she owns, with when and how she got it (bought or gift).
- **Endpoints:** read her look, owned and worn add-ons; save her look; put on or take off (only owned add-ons); buy an add-on.
- **Buying** is one transaction, refused with a reason the page turns into voice:
  - today's learning not done (`locked`);
  - something bought already today (`bought_today`);
  - the shelf isn't open (`shelf_locked`);
  - she already owns it (`owned`);
  - too little shop money, with savings counting half (`poor`);
  - a sticker gift, which isn't for sale (`not_for_sale`).

  Play time used up is not a reason. A purchase takes the Stars (from savings first, at two for one), records ownership and writes an event for the logbook. Like a round of play, it has a key, so sending it twice buys once.
- **Savings:** each player's savings are kept next to her Stars, noted once as described in Part C. The parents' Star setting lowers them when it goes below them.
- **Sticker gifts** are given where stickers are awarded today (`stickers.award`).
- **Parents' page:** each child's card shows what she owns (emojis) and her remaining savings, read-only. **(call)**
- **Without the server:** changing the look or what she wears shows at once and is sent when the server answers again, like a waiting visit. Buying needs the server: without it, the ✔️ says nothing happened and nothing is taken. **(call)**
- **Parents who play** follow the same rules as children, including "learn first" for the shop, as they do for the Arcade. **(call)**
- **The cool-down** from the security review doesn't apply to buying: one purchase per day is the limit. **(call)**
- **Local mode** works the same: a look and add-ons per local person.

## What's left to the builder

- Exact prices within each shelf's range, the colour values, and the exact German words the voice says.
- How each add-on, hair style and pair of glasses is modelled from simple shapes, as long as it reads as that thing on a small wobbling blob, from behind as well as from the front.
- Where the shop stands in the town (right side, with the play buildings) and its building colour.
- The layout of the look screen, the shop and the wardrobe on the iPad (1024×768, touch) and the laptop, following the earlier stages' style.
- Splitting the work into PRs (e.g. look and wardrobe first, then the shop and gifts).
