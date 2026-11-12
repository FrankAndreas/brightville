# Brightville – Stage 3 Design: iPad and NAS

Nov 12, 2026 · Andreas Frank

Stage 3 of the strategy in `2026-11-12-brightville-stage1-design.md`: the game becomes playable on the iPad and is served from the NAS.

Lines marked **(call)** are decisions made by Claude, not by Andreas.
Andreas asked to "continue with the next stage" and did not review this design before it was built.

## Intent

The child plays Brightville on the iPad at home, with fingers only, and finds a writing building there that the laptop cannot offer.
The laptop keeps working as before.

## Goals

- Everything that works with keys also works with one finger: walking, jumping, going in, answering, leaving.
- The app is published as a container image and runs on the NAS like the other family apps.
- Schreiben from Spielzeugkiste becomes the first building that needs touch.

## Non-goals

- Family login and Stars shared between devices (stage 4). Until then the laptop and the iPad each keep their own Stars.
- Playing without a network connection to the NAS. No service worker yet. **(call)**
- Access from outside the house. The app is home-only. **(call)**
- A gamepad.

## Anti-goals

- Controls that need two hands on the glass at exact spots. A 5-year-old holds the iPad with one hand or lays it down.
- A touch layout that changes the game on the laptop.

## Delivered in two parts **(call)**

Each part is its own pull request and leaves a working game.

1. **Touch and NAS.** After it, the iPad can play School, Yoga and Arcade from the NAS.
2. **Schreiben.** The writing building.

## Part 1: touch controls

### In the town

- **Walking:** a stick that appears where the finger lands, anywhere in the left half of the screen. Dragging away from that spot walks in that direction; the further, the faster, up to full speed at about 60 px. Lifting the finger stops. **(call: a floating stick instead of a fixed one, so small hands need not aim)**
- **Jumping:** a large round button at the bottom right with an up arrow.
- **Going in:** the picture that appears in front of an open door is itself the button. It also takes a mouse click on the laptop.
- The stick and the jump button are shown only on devices with a touch screen, and only while walking around.
- Keys and touch work at the same time; neither switches the other off.

### In the buildings

- **Leaving:** a round button with a door-and-arrow picture at the top left of every building, on every device. It does what Esc does. This closes the gap noted in stage 2.
- School and Arcade already take taps. The Yoga screen for a missing camera takes a tap to go back.

### Help

On a device with touch and no mouse, the help shows the touch pictures (stick, jump button, door picture, leave button) and speaks matching sentences. With a mouse it stays as it is.

### iPad details

- The page fills the screen without scrolling, zooming, text selection or the long-press menu, and keeps clear of the rounded corners and the home bar.
- It can be saved to the home screen with its own icon and then opens without Safari's bars.
- The camera works only over HTTPS, so the NAS address must be HTTPS (below).

## Part 1: on the NAS

Same pattern as Spielzeugkiste, which is already there on port 8084:

- **Image:** CI builds `ghcr.io/frankandreas/brightville:latest` on every push to `main` after the tests pass. Pull requests build the image without publishing it, so a broken Dockerfile is caught before merging.
- **Container:** nginx serving the built files as a non-root user, port 8080 inside, **8087** outside **(call; 8081–8086 are taken)**. No data, no `.env`, nothing to back up.
- **Headers:** long cache for hashed files, none for `index.html`; the camera is allowed for the page itself only.
- **Updates:** `scripts/nas-update.sh` (nightly, with `:previous` for rolling back) and `scripts/deploy-nas.sh`, taken from Spielzeugkiste.
- **HTTPS at home:** a DSM reverse-proxy entry `brightville.local.<domain>` with the existing wildcard certificate, as for the other apps.
- **Family-hub tile:** added by a parent in the hub's settings with the home address. No app key yet: the login comes in stage 4.
- `docs/deploy-nas.md` describes the steps. Andreas carries them out; they need SSH and sudo on the NAS.

## Part 2: Schreiben

### What the child experiences

1. A fourth building with a pencil on its sign. On the laptop its door is grey and the picture is crossed out.
2. Inside, a large letter stands in the lines of the Schreibhaus. A dot shows where to start, an arrow which way to go.
3. The child traces the letter stroke by stroke with a finger or a pen. The line follows in colour. A resting hand is ignored.
4. Lifting too early starts that stroke again, with no comment. Starting at the wrong end makes the start dot blink.
5. Each letter is written three times with less help each time: the whole path, then dots, then only the start.
6. After two letters there is confetti and the child is back in the town.

### Rules

- Letters and digits are the Deutschschweizer Basisschrift from Spielzeugkiste (`basisschrift.json`), with its tracing rules and tests.
- A visit is two letters drawn at random from capitals A–Z, Ä, Ö, Ü and the digits. **(call)**
- **Stars:** 1 per letter written, so 6 for the six tracings, plus 4 for a full visit: 10, the same as a School visit. **(call)**
- The voice says "Schreib ein A" and cheers after each one. Mistakes never cost Stars.
- Needs touch. A mouse would work but teaches nothing about writing. **(call)**

### Left out of the Spielzeugkiste version **(call)**

Writing whole names and words, choosing the letter from a menu, free drawing, and sending pen traces to the server.

## How we know it works

- Unit tests for the stick, the combined input, the leave button and every ported writing rule.
- The touch controls are driven in headless Chrome with a touch screen emulated: walk, jump, go in, answer, leave.
- CI builds the image.
- Not possible here: a real iPad, and the NAS itself. Andreas checks both.

## Left to the builder

- Sizes, colours and positions of the touch controls.
- Where the fourth building stands.
