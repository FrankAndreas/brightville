# Brightville – Implementation Strategy and Stage 1 Design

Nov 12, 2026 · Andreas Frank

Source of the game idea: `Learning City – Gameplay Design.md` in the repo root.
This document says how we build it, in which order, and what exactly stage 1 contains.

Lines marked **(call)** are decisions made by Claude, not by Andreas. Everything else comes from Andreas or the gameplay document.

## Intent

A kindergarten-age child walks a wobbly character through a small, friendly town, goes into buildings, and earns Stars there by learning and moving.
Later, Stars are spent on play.
The existing game collection Spielzeugkiste (`../kids-games`) is absorbed into this repo: its ideas, and where useful its tested logic and content, become the buildings of the town.

The first player is about 5 years old and cannot read yet.

## Goals

- A child can play without reading: icons, colours and a German voice carry everything.
- Walking around is fun in itself: wobble, bounce, tumble.
- One code base that runs on this Linux PC now and on an iPad later.
- Works offline once loaded. Camera images never leave the device and are never stored.
- Each building is a separate, small piece that can be added without touching the others.

## Non-goals for the whole project

- No accounts, no chat, no other players, no ads.
- No native desktop packaging (Electron) for now. **(call)**

## Anti-goals

- Anything scary or punishing. A fall is funny. A wrong answer never costs Stars.
- A screen the child cannot use without reading.
- Needing the internet while playing (the later Cinema is the one exception).

## Strategy

### One web app **(call)**

Brightville is a web app opened in the browser, on the PC first and on the iPad later.
This is the only form that covers both devices with one code base, and the camera, speech and sound all work there.

| Part | Choice | Why |
|---|---|---|
| Language | TypeScript | Catches mistakes early in a project that will grow |
| Build and tests | Vite, Vitest | Same as Spielzeugkiste |
| Menus, overlays, 2D games | Vue 3 with Pinia | Same as Spielzeugkiste, so its game screens port with little rewriting |
| 3D town | Three.js | Small, runs well in iPad Safari |
| Physics | Rapier (`@dimforge/rapier3d-compat`) | Fast, runs in every browser |
| Body tracking | MediaPipe Pose Landmarker (`@mediapipe/tasks-vision`), lite model | Runs in the browser on PC and iPad |
| Voice | Web Speech API, `de-DE` | Ported from Spielzeugkiste `tts.js` |
| Sound | Web Audio tones | Ported from Spielzeugkiste `sound.js` |

All of these, including the pose model file and the WebAssembly files, are served from the app itself, not from a CDN.

All text and voice shown to the child is German. **(call, based on Spielzeugkiste)**
Code, comments and documents are English.

### Three layers

```
src/
  core/        Pure logic, no browser, fully unit-tested: Stars, save data, pose rules
  input/       Turns keyboard (later: touch, gamepad) into intents: move, jump, interact, leave
  city/        Three.js + Rapier: town, character, camera, doors
  buildings/   One folder per building: a Vue screen plus its own logic
  services/    Voice, sound, webcam, storage
  App.vue      Switches between the city and the building the child is in
```

Rules between the layers:

- `core` imports nothing from the other folders.
- The city knows buildings only as a list: id, icon, spoken name, door position.
- A building is a Vue component that receives nothing but a "finished" callback and reports `{ stars: number }`. It never touches the city.
- While a building is open the city is paused and its sound is silent.
- The city never reads the keyboard directly, only intents. This is what lets touch controls be added later without changing the city.
- Each building states what it needs from the device: camera, touch, keyboard. The city opens only the doors the current device can serve; the others are shown closed. Example: Schreiben needs touch (iPad), Yoga needs a camera (laptop or iPad).
- Saving goes through one small storage interface in `services`. Stage 1 implements it with the browser's local storage; stage 4 replaces it with the server.

### Hosting and the family hub

Agreed with Andreas on Nov 12, 2026:

- Brightville is hosted on the NAS like the other family apps and gets a tile in family-hub (`../family-hub`).
- It uses the family login instead of its own profiles and PIN. The hub says who is playing and whether they are a parent or a child (`GET <hub>/api/session?app=<key>`, described in the family-hub README).
- Stars and progress are then stored on the NAS under the hub's `person.id`, so laptop and iPad show the same state. This needs a small server part in Brightville. **(call: built in stage 4, not before)**
- The camera works only over HTTPS or on `localhost`, so the NAS address must be HTTPS.

### How Spielzeugkiste is absorbed

One game at a time, each as a building, in a later stage.
For each game: copy its logic file and tests from `../kids-games/src/logic`, convert to TypeScript, copy its content from `public/content`, and rebuild the screen to fit the building contract.
The home menu, theme picker and routing of Spielzeugkiste are not carried over; the town replaces them.
`../kids-games` itself is not changed. Whether and when it is retired is for Andreas to decide.

### Stages

Each stage gets its own short design and plan before it is built.

1. **Tiny town, yoga, Stars.** This document.
2. **First absorbed games and the full loop.** School (Zahlen) earns Stars, Arcade (Memory) costs Stars, the Arcade door opens once the daily goal is met.
3. **iPad and NAS.** On-screen joystick and buttons, layout for touch, Schreiben as the first touch-only building, deployment on the NAS with a family-hub tile.
4. **Family login and parents.** Family-hub login, a small server that stores Stars and progress per child, parent area (daily goal, screen-time cap) for people the hub marks as parents.
5. **More buildings.** Schreiben, Ausmalen, Malen, Unterschiede, Schlange, Pac-Man, Cinema.
6. **More movement and rewards.** Jump Arena, Dance Hall, stickers, the house.

## Stage 1: what gets built

### What the child experiences

1. The app opens straight into the town. There is no menu. A big "tap or press any key" picture starts sound and voice (browsers need this).
2. A round jelly character stands on a small town square. Arrow keys make it wobble around, Space makes it jump.
3. On the square are a trampoline, a few big balls to push, and one building with a yoga icon above a glowing door.
4. Standing in front of the door, a large key picture appears and the voice says "Yoga". Pressing Enter goes in.
5. Inside, the child sees themselves mirrored, with an outline to stand in. When head to knees are visible the outline turns green.
6. A yoga teacher figure shows a pose and the voice names it. A ring fills while the child holds the pose. When it is full: chime, three Stars fly to the counter.
7. After three poses there is confetti and the child is back on the square, with the Star counter at the top of the screen showing the new total.

### The town

- One square of about 40 × 40 metres with a low wall around it, so nobody can fall off the world.
- Built from simple shapes in code: pastel colours, soft shadows, no downloaded art. **(call)**
- One enterable building (Yoga Studio). Two or three plain houses as scenery.
- Camera follows behind and above the character at a fixed angle. The child does not control the camera. **(call)**

### The wobbly character **(call)**

Full physics-driven ragdoll walking is hard to steer for a 5-year-old and hard to build.
Stage 1 fakes it:

- Movement uses Rapier's character controller on a capsule: reliable, never gets stuck.
- The visible body is a soft blob with eyes that squashes, stretches and leans with a spring, and two floppy arms that swing behind the motion.
- Hitting something fast, or landing from a height such as the trampoline, makes the character tumble as a free physics body for about 1.5 seconds, then pop back up.
- Balls and the trampoline are real physics objects.

### Controls

| Intent | Keyboard |
|---|---|
| Move | Arrow keys or W A S D |
| Jump | Space |
| Go in / confirm | Enter or E |
| Leave building | Esc |

Run, grab, map and quest board from the gameplay document are left for later stages.

### Yoga Studio

- **Camera start.** The browser asks for permission. If it is refused or no camera exists, the studio shows a friendly picture, the voice says the camera is missing, and Enter leads back to the square. The keyboard version of sports is a later stage.
- **Camera choice.** The browser's default camera is used. (This PC reports four video devices; a picker belongs in the later parent area.)
- **Calibration.** Passed when nose, shoulders, hips and knees are all seen with good confidence for one second.
- **Poses.** Three per visit, drawn at random from five **(call)**:

  | Pose | Voice | Rule in words |
  |---|---|---|
  | Stern | "Mach einen Stern!" | Arms out sideways, feet wide apart |
  | Riese | "Mach dich gross wie ein Riese!" | Both hands high above the head, feet together |
  | Baum | "Steh wie ein Baum!" | One foot lifted to the other leg, hands above the head or together |
  | Frosch | "Hock dich hin wie ein Frosch!" | Deep squat, hands down between the knees |
  | Flieger | "Flieg wie ein Flugzeug!" | Arms out sideways, upper body leaning to one side |

- **Detection.** Each pose is a set of rules on joint angles and relative positions, computed from the tracked body points. Left and right are interchangeable. The rules are pure functions in `core`, tested with recorded body-point data.
- **Being generous.** The ring fills over 5 seconds of holding. If the pose is lost the ring drains slowly rather than resetting. After 30 seconds without success the teacher moves on to the next pose with no comment and no Stars.
- **Reward.** 3 Stars per pose held.
- **Privacy.** Video frames are processed in the page and thrown away. Nothing is recorded or sent.

### Stars and saving

- One number, shown as a star with a count at the top of the screen.
- Saved in the browser's local storage together with a save-format version, so later stages can migrate it.
- One player. No profiles, no spending, no daily goal yet.

### Not in stage 1

Profiles, parent area, quest board, spending Stars, the Fun Boulevard gate, any absorbed Spielzeugkiste game, touch controls, wave-to-confirm, avatar customising, music, deployment.

## How we know it works

- Unit tests for everything in `core` (Stars, save and load, each pose rule) and for the input mapping.
- The app is run in the browser on this PC and each step of "What the child experiences" is walked through, including the refused-camera path.
- 60 frames per second in the town on this PC; pose tracking at 15 or more per second.
- The real test: the child plays it. What they enjoy and where they get stuck shapes stage 2.

## Left to the builder

- Exact sizes, colours, spring strengths and jump heights: tune by feel.
- Exact angle thresholds for the poses: start loose, tighten only if poses are confused with each other.
- How the yoga teacher figure is drawn. It needs visible arms and legs so the poses can be read; a simple figure with stick limbs is enough.
- File and component names inside the folders above.
