# Brightville – Stage 4 Design: Family Login and Parents

Nov 12, 2026 · Andreas Frank

Stage 4 of the strategy in `2026-11-12-brightville-stage1-design.md`.

Lines marked **(call)** are decisions made by Claude, not by Andreas.
Andreas asked for stage 4 with "an option to start it without the hub so we can try it here as a dev-server", and did not review this design before it was built.

## Intent

Each child has their own Stars, the same on the laptop and the iPad, and a parent can set the rules of the day.
Who is playing comes from the family hub's login; without a hub the game still runs, with a simple "who plays?" picture choice.

## Goals

- Stars, today's visits and play time live on the NAS per person, not in a browser.
- The family hub says who is playing and who is a parent. No own PINs.
- A parent can set, per child: the daily goal, a daily play-time limit, and the Star count.
- The whole thing can be started on this PC without a hub, to try it.

## Non-goals

- Access from outside the house. Requests through the Cloudflare tunnel are refused. **(call)**
- A weekly report, video lists, playing hours, camera on/off per child (later stages).
- Playing with no connection to the server. Earned Stars are kept and sent later; spending needs the server. **(call)**

## Anti-goals

- A child losing Stars they earned because the network hiccupped.
- A child reaching the parent settings.
- A second set of rules in the browser that can disagree with the server.

## Two ways to run it

| | With the family hub | Without (trying it out) |
|---|---|---|
| Switched on by | `HUB_URL` set | `HUB_URL` empty |
| Who plays | the person logged in at the hub | chosen on a picture screen, no PIN |
| People | those the hub lets use the app | `LOCAL_PEOPLE`, default `Kind:CHILD,Eltern:PARENT` |
| Parent area | hub parents | whoever picks a parent **(so: not for the NAS)** |

The start page, the game and the parent area are the same in both. Without a hub the backend logs a warning at start that anybody can be a parent.

## The server **(call)**

A small backend in `backend/`, in the family apps' stack: Python, FastAPI, SQLite, the hub's own client package.
The game rules that touch Stars move to the server; the browser asks and shows.

### What it stores

- **People:** a copy of the hub's people for this app (id, name, role, colour), refreshed from the hub; people who left are hidden, not deleted.
- **Per person:** Stars, the day of the last visit with its visits and play seconds, and the parent's settings (daily goal, play minutes per day or no limit).
- **Events:** every earning visit and every round bought, with a key made up by the browser, so a request sent twice counts once. This is also the raw material for a later weekly report.

"Today" is the server's day in `TZ` (default Europe/Zurich).

### What it offers

| Request | Who | What |
|---|---|---|
| `GET /api/me` | anyone | who is logged in, the mode, and for a missing login where to log in |
| `GET /api/state` | player | Stars, today's visits and play time, the settings that apply |
| `POST /api/visits` | player | an earning visit `{building, stars, key}`; Stars are capped at what the building can give |
| `POST /api/plays` | player | buy a round `{building, key}`; refused when the goal is not reached, Stars are short or today's play time is used up |
| `POST /api/playtime` | player | seconds played since the last report |
| `GET /api/children` | parent | every child with Stars, today's numbers and settings |
| `PUT /api/children/{id}` | parent | daily goal (1–5), play minutes (none, or 5–180), Stars (0–9999) |
| `POST /api/local/choose` | no-hub mode only | pick who plays |

Changes need the header `X-Requested-With: brightville`, as in the other family apps.
What each building is (earn or play, price, most Stars per visit) is one file, `shared/buildings.json`, read by both the browser and the server.

## In the game

- **Start:** the page asks the server who is playing.
  Not logged in → the browser goes to the hub's login and comes back.
  No access → a locked-door picture and one line for the parent.
  Server not reachable → a sleeping-cloud picture; the page tries again by itself.
- **Who plays:** a coloured circle with the first letter of the name next to the Star counter. Without a hub, tapping it opens the picture choice again.
- **Earning:** on leaving a building the visit is sent. If that fails it is kept in the browser and sent again later; the Stars already show. **(call)**
- **Spending:** the server decides at the door. No answer means no entry and no Stars taken.
- **Play-time limit:** time inside play buildings counts. When today's minutes are used up, the Arcade door shows a moon and the voice says "Für heute ist genug gespielt. Morgen wieder!". A round already started may be finished. **(call)**
- **The daily goal** is the child's own number from the parent area (default 2).
- **Stars from before:** Stars saved in the browser by stages 1–3 are not carried over by themselves; a parent types the number in once. **(call: one browser's Stars can't be tied to one child safely)**

## Parent area

A gear button next to the "?" in the town, shown only to parents.
It opens a plain German page (parents read): one card per child with Stars, today's visits and play minutes, and three settings: daily goal, play minutes per day, Stars.
With a hub, a link leads to the hub's logout.

## On the NAS

Two containers, as in the other family apps: `ghcr.io/frankandreas/brightville/frontend` (nginx, forwards `/api`) and `.../backend`, with `./data` for the database.
The single image from stage 3 is replaced; `docs/deploy-nas.md` says how to switch.
The hub tile gets the app key `brightville` and the people who may play.

## How we know it works

- Backend tests in-process against a temporary database, with the hub client's own fake hub: login, access, roles, every rule above, requests sent twice, a new day.
- Frontend tests against a fake server: start states, earning with a failing network, the door answers, the parent area.
- On this PC without a hub: backend and Vite started together, a full day played in headless Chrome as a child, limits changed as a parent.
- Not possible here: the real hub and the NAS. Andreas checks both.

## Left to the builder

- Table layout, file names, the look of the picture choice and the parent area.
- How often the browser asks the server again (state is refreshed at least when a building is left and once a minute).
