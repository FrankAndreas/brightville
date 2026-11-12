# Brightville Stage 3 Part 1 (Touch and NAS) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the town and every building playable with one finger, and publish the app as a container image for the NAS.

**Architecture:** Touch is a second `IntentSource` next to the keyboard; the town reads both through one merged source and does not change. Leaving a building goes through one small module that buildings subscribe to, so Esc and the on-screen button share a path. Deployment is a static nginx image built by CI.

**Tech Stack:** unchanged, plus Docker (nginx-unprivileged) and GitHub Container Registry.

**Spec:** `docs/superpowers/specs/2026-11-12-brightville-stage3-design.md`

## Global Constraints

- The Global Constraints of the stage 1 and stage 2 plans still hold.
- Nothing changes for a device without touch, except the leave button and the clickable door picture.
- Touch controls are shown only when `device.touch` is true and the child is walking around.
- No local `docker build`: the root partition has under 6 GB free. CI builds the image.
- Port 8087. Image `ghcr.io/frankandreas/brightville`.
- Every task ends with `npm test`, `npm run lint`, `npm run typecheck` and `npm run build` passing.

## Review Focus

1. **A finger lifted outside the page or a second finger on the stick** leaves the character walking forever, or makes it jump direction.
2. **The stick while a building or the help opens** (finger still down): the character must not keep walking when the town resumes.
3. **Tapping the door picture twice quickly** at the Arcade charges once.
4. **The leave button during a School cheer or a Memory miss** behaves exactly like Esc: Stars so far are kept, no timers stay behind.
5. **A laptop with a touch screen** (touch and mouse): both control sets work, help shows the keys.

---

### Task 1: Touch input source and merging

**Files:** Create `src/input/stick.ts`, `src/input/touch.ts`, `src/input/merge.ts` and their tests.

**Interfaces — produces:**

```ts
// stick.ts
export const STICK_RADIUS = 60      // px for full speed
export const STICK_DEAD = 10        // px that count as no movement
/** Movement for a finger at `point` when the stick started at `origin`; length 0…1. Screen down is +z. */
export function stickVector(origin: Point, point: Point): { x: number; z: number }

// touch.ts
export interface TouchIntents extends IntentSource {
  setStick(x: number, z: number): void
  press(what: 'jump' | 'interact' | 'leave'): void
}
export function touchIntents(): TouchIntents      // reset() centres the stick and forgets presses

// merge.ts
export function mergeIntents(...sources: IntentSource[]): IntentSource
// axes are summed and clamped to -1…1; a press in any source counts once; reset/dispose reach all
```

- [ ] Tests first: dead zone gives 0; 30 px right gives x 0.5 beyond the dead-zone rule as implemented linearly from dead zone to radius; beyond the radius the length is 1; diagonal keeps its direction. Touch presses are true for exactly one `read()`. Merge clamps keyboard 1 + stick 0.8 to 1 and ORs presses.
- [ ] Implement, run, commit `feat: touch input source`.

### Task 2: Touch controls in the town

**Files:** Create `src/components/TouchControls.vue` (+ test). Modify `src/city/CityView.vue` (+ test), `src/components/DoorPrompt.vue` (+ test), `src/App.vue` (+ test).

- `TouchControls` takes `source: TouchIntents`. The left half is the stick area: `pointerdown` sets the origin and captures the pointer, `pointermove` of that pointer calls `setStick`, `pointerup`/`pointercancel`/`lostpointercapture` centre it. Other pointers in the area are ignored while one is down. A knob and ring are drawn at the origin while held. The jump button (`data-test="jump"`) calls `press('jump')` on `pointerdown`.
- `CityView` creates `touchIntents()` and `mergeIntents(keyboard, touch)`, and renders `TouchControls` when its new prop `touch` is true and it is not paused. Pausing resets the source (the loop already does).
- `DoorPrompt` emits `enter` on `pointerdown` when `state === 'open'`, has `pointer-events: auto` only then, and shows a tapping-finger picture instead of the Enter key when its new prop `touch` is true.
- `App` passes `device.touch` to both and calls `onEnter(near.id)` on the prompt's `enter`.

- [ ] Tests first: stick drag sets the source; lifting centres it; a second pointer does not move it; jump presses; controls absent without touch and while paused; prompt click enters only when open; a double tap at a play door charges once (App).
- [ ] Implement, run, commit `feat: touch controls in the town`.

### Task 3: Leaving a building by button

**Files:** Create `src/buildings/leave.ts` (+ test), `src/components/LeaveButton.vue` (+ test). Modify `School.vue`, `Arcade.vue`, `YogaStudio.vue`, `App.vue` and their tests.

```ts
// leave.ts
/** A building says how it is left; returns the function that takes this back. */
export function onLeaveRequest(fn: () => void): () => void
/** Asks the open building to end, exactly as Esc does. */
export function requestLeave(): void
```

- Each building registers its existing `leave` on mount and unregisters in its shutdown.
- `App` renders `LeaveButton` (`data-test="leave"`) over the building; `pointerdown` calls `requestLeave()`.
- Yoga's no-camera picture calls `leave` on `pointerdown`, after the same 1 s grace as Enter.

- [ ] Tests first, per building: `requestLeave()` emits `finished` with the Stars so far, once. App: the button exists only inside a building and leads back to the town.
- [ ] Implement, run, commit `feat: leave button in every building`.

### Task 4: Help and page for touch

**Files:** Modify `src/components/HelpOverlay.vue` (+ test), `src/App.vue`, `index.html`, `src/App.vue` styles. Create `public/icon-180.png`, `public/manifest.webmanifest`.

- `HelpOverlay` gets prop `touch: boolean`. When true, its four rows show the stick, the jump button, the door picture and the leave button, and it speaks: "Zieh mit dem Finger, dann läufst du. Tipp auf den Pfeil, dann springst du. Tipp auf das Bild an der leuchtenden Tür, dann gehst du hinein. Mit der Tür oben links gehst du wieder hinaus."
- `App` passes `device.touch && !device.keyboard`.
- The keyboard help's last row gains nothing; its spoken text is unchanged.
- `index.html`: `viewport-fit=cover`, `apple-mobile-web-app-capable`, `mobile-web-app-capable`, theme colour, manifest and touch icon. Global styles: `-webkit-touch-callout: none`, `-webkit-user-select: none`, `overscroll-behavior: none`, HUD and buttons offset by `env(safe-area-inset-*)`.

- [ ] Tests first for the two help variants; implement; commit `feat: help and page set up for touch`.

### Task 5: Container image and NAS scripts

**Files:** Create `Dockerfile`, `.dockerignore`, `nginx.conf`, `docker-compose.yml`, `scripts/nas-update.sh`, `scripts/deploy-nas.sh`, `.deploy.env.example`, `docs/deploy-nas.md`. Modify `.github/workflows/ci.yml`, `.gitignore`, `README.md`.

- Dockerfile: `node:26-slim` build stage running `npm ci --ignore-scripts`, `node scripts/fetch-pose-assets.mjs`, `npm run build`; serve stage `nginxinc/nginx-unprivileged:alpine` on 8080 with a `HEALTHCHECK`.
- nginx: `index.html` `no-cache`; `/assets/` one year immutable; `/mediapipe/` 30 days; `application/wasm` for `.wasm`; gzip; headers `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy: camera=(self), microphone=(), geolocation=()`.
- The two scripts are copied from `../kids-games/scripts` with the names changed.
- CI: a `publish` job as in Spielzeugkiste; on pull requests it builds without pushing.
- `docs/deploy-nas.md`: install, HTTPS reverse proxy `brightville.local.<domain>`, hub tile, home-screen icon, updates, rollback, troubleshooting.

- [ ] Verify: `bash -n` on both scripts; `docker compose config` if Docker is present; CI on the pull request builds the image.
- [ ] Commit `build: container image and NAS deployment`.

### Task 6: Browser check and review

- [ ] Headless Chrome with `hasTouch`: drag the stick to a door, tap the prompt, answer a School task by tap, tap leave, tap jump. No console errors.
- [ ] Whole-branch review by a fresh reviewer; fix Critical and Important findings test-first.
