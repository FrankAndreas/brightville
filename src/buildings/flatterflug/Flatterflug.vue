<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import Confetti from '@/components/Confetti.vue'
import { createFlyer, type Flyer } from '@/city/flyer'
import {
  GATE_WIDTH, GROUND, HEARTS, RADIUS, SPEEDS, createFlight, flap, flyerX, setWidth, tilt, update, type Flight, type FlightSpeed,
} from '@/core/flight'
import { useGameLoop } from '@/services/gameLoop'
import { instruct, instruction, speak, stopSpeaking } from '@/services/tts'
import { useSessionStore } from '@/stores/session'
import { useWardrobeStore } from '@/stores/wardrobe'
import { onLeaveRequest } from '../leave'
import type { BuildingResult } from '../types'

// The Flatterflug: her wobbly gets wings. Each tap (or Space) makes it flap; it flies through the gaps between columns
// of clouds (core/flight.ts). One round per visit, bought at the door; she picks the speed before the start.
const props = defineProps<{
  /** Where the gaps go; for tests */
  random?: () => number
  /** Whose speed is remembered; the person playing when not given */
  owner?: number
  /** The speed, instead of the remembered one; for tests */
  startSpeed?: FlightSpeed
  /** Gates for the round; for tests */
  toWin?: number
}>()
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

// After the last word, before going back to the town
const END_MS = 3500
/** The flying wobbly's canvas, in field heights: wide enough for its wings */
const FLYER_SIZE = 0.42

const SPEED_BUTTONS: { speed: FlightSpeed; icon: string; label: string }[] = [
  { speed: 'langsam', icon: '🐢', label: 'Langsam' },
  { speed: 'mittel', icon: '🐇', label: 'Mittel' },
  { speed: 'schnell', icon: '🐆', label: 'Schnell' },
]

const wardrobe = useWardrobeStore()

// The child's last speed, on this device
const speedKey = `brightville.flatterflug.speed.${props.owner ?? useSessionStore().person?.id ?? 0}`
function lastSpeed(): FlightSpeed {
  if (props.startSpeed) return props.startSpeed
  try {
    const saved = window.localStorage.getItem(speedKey)
    return SPEED_BUTTONS.some(b => b.speed === saved) ? (saved as FlightSpeed) : 'langsam'
  } catch {
    return 'langsam'
  }
}
const speed = ref<FlightSpeed>(lastSpeed())
const newFlight = (s: FlightSpeed, width = 1.6) => createFlight({ speed: s, width, random: props.random, toWin: props.toWin })
let flight: Flight = newFlight(speed.value)

const phase = ref<'ready' | 'playing' | 'won' | 'over'>('ready')
const hearts = ref(HEARTS)
const passed = ref(0)
const sky = ref<HTMLCanvasElement | null>(null)
const flyerCanvas = ref<HTMLCanvasElement | null>(null)
/** Where the flying wobbly's canvas is, in px */
const flyerBox = ref({ left: 0, top: 0, size: 0, faded: false })

let flyer: Flyer | null = null
let closed = false
let height = 1
let width = 1
let clock = 0
let resizer: ResizeObserver | null = null
const timers = new Set<ReturnType<typeof setTimeout>>()
function later(fn: () => void, ms: number) {
  const id = setTimeout(() => {
    timers.delete(id)
    if (!closed) fn()
  }, ms)
  timers.add(id)
}

function chooseSpeed(next: FlightSpeed) {
  if (closed || phase.value !== 'ready') return
  speed.value = next
  flight = newFlight(next, flight.width)
  void speak(SPEED_BUTTONS.find(b => b.speed === next)!.label)
  try {
    window.localStorage.setItem(speedKey, next)
  } catch {
    // Not remembered; slow again next time
  }
}

function onFlap() {
  if (closed || flight.over) return
  if (phase.value === 'ready') {
    phase.value = 'playing'
    flyer?.hover(false)
    // The speed is chosen: from now on the 🔊 says the goal
    instruction.value = 'Tipp, dann flattert dein Wobbel! Flieg durch die Lücken zwischen den Wolken.'
  }
  flap(flight)
  flyer?.flap()
}

function onKey(e: KeyboardEvent) {
  if (e.repeat) return
  if (e.code === 'Escape') return leave()
  // A button with the focus (a speed, 🔊) takes its own Space
  if (e.target instanceof HTMLButtonElement && e.code === 'Space') return
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault()
    onFlap()
  }
}

const loop = useGameLoop(dt => {
  clock += dt
  for (const event of update(flight, dt)) {
    if (event === 'hit' && !flight.over) void speak('Hoppla!')
    if (event === 'half') void speak('Super, schon die Hälfte!')
    if (event === 'won') end('won', 'Geschafft!')
    if (event === 'over') end('over', 'Oh! Das nächste Mal klappt es.')
  }
  hearts.value = flight.hearts
  passed.value = flight.passed
  draw(dt)
})

function end(how: 'won' | 'over', line: string) {
  phase.value = how
  void speak(line)
  later(leave, END_MS)
}

/** Where the wobbly is drawn: hovering gently before the start */
function flyerY(): number {
  return flight.started ? flight.y : flight.y + Math.sin(clock / 400) * 0.02
}

function draw(dt: number) {
  const y = placeFlyer()
  flyer?.draw(tilt(flight), dt)
  drawSky(y)
}

/** Moves the flying wobbly's canvas to where it is; returns its height in the field */
function placeFlyer(): number {
  const size = FLYER_SIZE * height
  const y = flyerY()
  flyerBox.value = {
    left: flyerX(flight) * height - size / 2,
    top: y * height - size / 2,
    size,
    // Just hit: it blinks while a cloud costs nothing
    faded: flight.graceMs > 0 && Math.floor(flight.graceMs / 150) % 2 === 0,
  }
  return y
}

function puff(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

/** A column of clouds from `top` to `bottom` (field units), rounded and puffy at both ends */
function cloudColumn(ctx: CanvasRenderingContext2D, x: number, top: number, bottom: number) {
  const h = height
  const w = GATE_WIDTH * h
  const left = x * h
  if (bottom - top <= 0) return
  ctx.save()
  // The puffs stay inside the column: the gap looks exactly as big as it is
  ctx.beginPath()
  ctx.rect(left - w, top * h, w * 3, (bottom - top) * h)
  ctx.clip()
  ctx.fillStyle = '#d9ecff'
  ctx.fillRect(left + w * 0.1, top * h, w * 0.8, (bottom - top) * h)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(left + w * 0.18, top * h, w * 0.64, (bottom - top) * h)
  // Puffs along both sides and at the ends
  const r = w * 0.28
  for (let yy = top + 0.04; yy < bottom; yy += 0.08) {
    ctx.fillStyle = '#d9ecff'
    puff(ctx, left + w * 0.15, yy * h, r)
    puff(ctx, left + w * 0.85, yy * h, r)
    ctx.fillStyle = '#ffffff'
    puff(ctx, left + w * 0.2, yy * h, r * 0.8)
    puff(ctx, left + w * 0.8, yy * h, r * 0.8)
  }
  ctx.restore()
}

function drawSky(y: number) {
  const el = sky.value
  const ctx = el?.getContext('2d')
  if (!el || !ctx) return
  const dpr = el.width / Math.max(1, width)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  const h = height
  const gradient = ctx.createLinearGradient?.(0, 0, 0, h)
  if (gradient) {
    gradient.addColorStop(0, '#9fd8ff')
    gradient.addColorStop(1, '#e8f6ff')
    ctx.fillStyle = gradient
  } else ctx.fillStyle = '#bfe7ff'
  ctx.fillRect(0, 0, width, h)

  // Far clouds, drifting slowly
  const pace = SPEEDS[flight.speed].pace
  const drift = (clock / 1000) * pace * 0.25 * h
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
  for (let i = 0; i < 6; i++) {
    const span = width + 0.6 * h
    const cx = ((i * 0.55 * h - drift) % span + span) % span - 0.3 * h
    const cy = (0.12 + ((i * 37) % 5) * 0.12) * h
    puff(ctx, cx, cy, 0.05 * h)
    puff(ctx, cx + 0.06 * h, cy - 0.02 * h, 0.06 * h)
    puff(ctx, cx + 0.12 * h, cy, 0.045 * h)
  }

  // The gates
  const { gap } = SPEEDS[flight.speed]
  for (const g of flight.gates) {
    cloudColumn(ctx, g.x, -0.05, g.centre - gap / 2)
    cloudColumn(ctx, g.x, g.centre + gap / 2, GROUND + 0.02)
    // A gate she got through shines
    if (g.counted) {
      ctx.font = `${0.06 * h}px system-ui, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('⭐', (g.x + GATE_WIDTH / 2) * h, g.centre * h)
    }
  }

  // The meadow, with flowers going by
  ctx.fillStyle = '#8fd17a'
  ctx.fillRect(0, GROUND * h, width, (1 - GROUND) * h)
  ctx.fillStyle = '#6dbb5a'
  ctx.fillRect(0, GROUND * h, width, 0.012 * h)
  const ground = (clock / 1000) * (flight.started && !flight.over ? pace : 0.05) * h
  ctx.font = `${0.045 * h}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < Math.ceil(width / (0.22 * h)) + 2; i++) {
    const fx = ((i * 0.22 * h - ground) % (width + 0.44 * h) + width + 0.44 * h) % (width + 0.44 * h) - 0.22 * h
    ctx.fillText(i % 3 === 0 ? '🌼' : i % 3 === 1 ? '🌷' : '🌸', fx, (GROUND + 0.06) * h)
  }

  // Without WebGL: the wobbly drawn flat, in her colour, with wings
  if (!flyer) {
    const x = flyerX(flight) * h
    ctx.save()
    ctx.translate(x, y * h)
    ctx.rotate(tilt(flight))
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.ellipse(-RADIUS * 0.6 * h, -RADIUS * 0.9 * h, RADIUS * 1.1 * h, RADIUS * 0.5 * h, -0.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = wardrobe.dress.look.body
    puff(ctx, 0, 0, RADIUS * h)
    ctx.fillStyle = '#ffffff'
    puff(ctx, RADIUS * 0.45 * h, -RADIUS * 0.25 * h, RADIUS * 0.28 * h)
    ctx.fillStyle = '#222222'
    puff(ctx, RADIUS * 0.55 * h, -RADIUS * 0.25 * h, RADIUS * 0.14 * h)
    ctx.restore()
  }
}

// The sky fills the whole screen; the field is as wide as the screen is, in field heights
function fit() {
  const el = sky.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  width = rect.width || 1
  height = rect.height || 1
  const dpr = window.devicePixelRatio || 1
  el.width = Math.round(width * dpr)
  el.height = Math.round(height * dpr)
  setWidth(flight, rect.width && rect.height ? rect.width / rect.height : 1.6)
  // The renderer is told the canvas's size: the canvas itself gets it with Vue's next update
  flyer?.resize(FLYER_SIZE * height)
  draw(0)
}

let stopLeaveRequests = () => {}

function shutDown() {
  if (closed) return
  closed = true
  loop.stop()
  for (const id of timers) clearTimeout(id)
  timers.clear()
  resizer?.disconnect()
  window.removeEventListener('resize', fit)
  window.removeEventListener('keydown', onKey)
  stopLeaveRequests()
  stopSpeaking()
  flyer?.dispose()
  flyer = null
}

function leave() {
  if (closed) return
  shutDown()
  // Playing costs Stars at the door; it never earns any
  emit('finished', { stars: 0 })
}

onMounted(async () => {
  window.addEventListener('keydown', onKey)
  stopLeaveRequests = onLeaveRequest(leave)
  void instruct('Tipp, dann flattert dein Wobbel los! Flieg durch die Lücken zwischen den Wolken. '
    + 'Wie schnell willst du sein? Tipp auf ein Tier.')
  try {
    flyer = createFlyer(flyerCanvas.value!)
    flyer.setDress(wardrobe.dress)
    flyer.hover(true)
  } catch {
    // No WebGL: the wobbly is drawn flat on the sky
    flyer = null
  }
  await nextTick()
  if (typeof ResizeObserver !== 'undefined' && sky.value) {
    resizer = new ResizeObserver(fit)
    resizer.observe(sky.value)
  }
  window.addEventListener('resize', fit)
  fit()
  loop.start()
})
onBeforeUnmount(shutDown)
</script>

<template>
  <div class="flatterflug" data-test="flatterflug" :data-phase="phase" :data-speed="speed">
    <canvas ref="sky" class="sky" data-test="sky" @pointerdown.prevent="onFlap" />
    <canvas
      ref="flyerCanvas" class="flyer" aria-hidden="true"
      :style="{
        left: `${flyerBox.left}px`, top: `${flyerBox.top}px`, width: `${flyerBox.size}px`, height: `${flyerBox.size}px`,
        opacity: flyerBox.faded ? 0.35 : 1,
      }"
    />
    <div class="flight-hud">
      <span class="hearts" :aria-label="`${hearts} Herzen`">
        <span v-for="i in hearts" :key="i" data-test="heart">❤️</span>
      </span>
      <span class="passed" data-test="passed">{{ passed }} / {{ flight.toWin }}</span>
    </div>
    <div v-if="phase === 'ready'" class="speeds">
      <button
        v-for="b in SPEED_BUTTONS" :key="b.speed" class="speed" data-test="speed" :data-speed="b.speed"
        :data-chosen="speed === b.speed" :aria-label="b.label" @click="chooseSpeed(b.speed)"
      >{{ b.icon }}</button>
    </div>
    <Confetti v-if="phase === 'won'" />
  </div>
</template>

<style scoped>
.flatterflug {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: #bfe7ff;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}
.sky { position: absolute; inset: 0; width: 100%; height: 100%; display: block; cursor: pointer; }
/* Taps go through the wobbly to the sky */
.flyer { position: absolute; pointer-events: none; transition: opacity 0.1s; }
/* Not "hud": the town's top bar has that class, and App's style for it is global */
.flight-hud {
  position: absolute;
  /* Right of the leave and 🔊 buttons in the top-left corner */
  top: calc(16px + env(safe-area-inset-top));
  right: calc(16px + env(safe-area-inset-right));
  display: flex;
  gap: 14px;
  align-items: center;
  padding: 8px 16px;
  border-radius: 24px;
  background: rgb(255 255 255 / 80%);
  font: 800 1.6rem system-ui, sans-serif;
  color: #4a6b8a;
  pointer-events: none;
}
.hearts { letter-spacing: 2px; }
.speeds {
  position: absolute;
  left: 50%;
  bottom: 18%;
  transform: translateX(-50%);
  display: flex;
  gap: 16px;
  padding: 12px 18px;
  border-radius: 26px;
  background: rgb(255 255 255 / 88%);
}
.speed {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  border: 5px solid transparent;
  background: #eaf6ff;
  font-size: 2.6rem;
  cursor: pointer;
}
.speed[data-chosen='true'] { border-color: #4f8fe8; transform: scale(1.1); }
</style>
