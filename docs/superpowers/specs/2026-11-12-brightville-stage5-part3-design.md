# Brightville – Stage 5, Part 3: Cinema, Paintings on the Server, a Bigger Town

Nov 12, 2026 · Andreas Frank

Follows `2026-11-12-brightville-stage5-design.md`. Andreas asked for four things after reading the stage 5 report:

1. "add the Cinema. let the parents configure them on a settings page. specific youtube urls for now"
2. "Bonbonjagd is fine - but add the different difficulties again"
3. "Move the paintings to the server so the kid can re-use them on a different device"
4. "add more buildings, more jump elements, ... and let the character turn around (e.g. use the keys jkli)"

Lines marked **(call)** are decisions made by Claude, not by Andreas. He did not review this design before it was built.

## 1. Cinema 🎬

- A play building on the right side: it costs 3 Stars per film and counts as play time, like the other play buildings. **(call: the gameplay design said 1 Star per 2 minutes; one price per round keeps the door simple)**
- Inside: big pictures (YouTube's thumbnails) of the films the parents chose. A tap starts the film full size in YouTube's privacy-enhanced player (`youtube-nocookie.com`). When it ends, the child is back in the town. One film per payment. The leave button works any time.
- The door stays grey while the list is empty, so nobody pays for an empty cinema. **(call)**
- **Parents** get a "Kino" section in the parent area: paste a YouTube link, give it a name, remove it. The list is the same for every child, at most 30 films. **(call)** Links in every common form are accepted (`watch?v=`, `youtu.be/`, `shorts/`, `embed/`, `live/`); anything else is refused with "Das ist kein YouTube-Link".
- The server keeps the list (`films` table) and checks the links; the page asks YouTube for nothing but the player and the thumbnails.
- The page's security rules allow exactly that: frames from `www.youtube-nocookie.com`, pictures from `i.ytimg.com`. The player gets the page's address as referrer, which YouTube now requires; everything else keeps sending none.

## 2. Bonbonjagd speeds

Before the first direction, three big buttons choose the speed: 🐢 langsam, 🐇 mittel, 🐆 schnell (Spielzeugkiste's speeds). The child's last choice is remembered on the device. **(call: chosen by the child, as in Spielzeugkiste, not by the parents)**

## 3. Paintings on the server

- Malen keeps each child's paintings on the server, so the gallery is the same on the laptop and the iPad.
- The newest 30 per child are kept. **(call: up from 20, now that they don't fill a device)**
- The server stores the picture and a small thumbnail in its database, so the nightly backup includes them. A painting is at most 6 MB.
- If the server can't be reached when a sheet is kept, the painting waits on the device and is sent the next time the gallery opens; until then the gallery shows it too. Nothing drawn is lost to a network hiccup.
- Stage 5 part 1 kept paintings only on the device; it was never deployed, so there is nothing to move.

## 4. A bigger town that turns

### Turning around

- **J** and **L** turn the view left and right while held; **K** turns around; **I** looks back at the learning row. **(call: the keys as Andreas suggested; what each does is Claude's)**
- Walking follows the view: the up arrow always walks away from the camera.
- On a touch screen: two round turn buttons ↺ ↻ above the jump button.
- The help shows the turn keys (or buttons).

### Bigger, with more to jump on

- The square grows from 40 m to 60 m across. **(call)**
- Learning stays at the back (six houses now), making things on the left, playing on the right (four houses with the Cinema).
- A playground in the front half: a big trampoline (about 6 m high), a small one, a staircase of blocks up to a high platform, and a row of low hurdles to hop over. **(call: what the jump elements are)**

### Two new learning buildings **(call: which)**

| Building | What happens inside | Stars |
|---|---|---|
| 📚 Bibliothek | The voice reads a short story, scene by scene with pictures; then three questions, answered by tapping a picture | +3 per question, at most 9 |
| 🧪 Farblabor | Two paint pots pour into a bowl: "Rot und Gelb – was gibt das?"; five mixes, answered by tapping a colour | +2 per mix, at most 10 |

A wrong answer fades its button and the question stays, as in the School. Four stories and six colour mixes to start with, written for Brightville.

Käseklicker from Spielzeugkiste is still left out: an idle clicker doesn't fit a town where play follows learning. **(call)**

## Delivered in three parts **(call)**

Stacked on stage 5 part 2 (#6), each its own pull request:

1. Cinema and the parents' film list, and the square grows to 60 m (the Cinema didn't fit on the old one).
2. Bonbonjagd speeds and paintings on the server.
3. Turning, the playground, Bibliothek and Farblabor.

## How we know it works

- Server tests for the film list (who may change it, link forms, limits) and the paintings (each child only their own, limits, sizes).
- Component tests for the Cinema, the parent's film list, the speed buttons, the painting outbox, turning, and both new buildings.
- Headless Chrome walks the bigger town, turns, jumps on the new things, and visits every new building.
- Not checked here: a film actually playing from YouTube in the town, and a real iPad.
