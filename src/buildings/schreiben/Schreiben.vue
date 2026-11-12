<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Confetti from '@/components/Confetti.vue'
import { seededRandom } from '@/core/numbers'
import { BOX, GLYPHS, fitView, viewBox, type Glyph, type Point } from '@/core/writing/letters'
import { buildWritingSession, starsFor, type Help, type WritingTask } from '@/core/writing/session'
import { createTracer, penDown, penMove, penUp, type MissReason, type Tracer } from '@/core/writing/tracing'
import { playBeat } from '@/services/sound'
import { speak, stopSpeaking } from '@/services/tts'
import { onLeaveRequest } from '../leave'
import type { BuildingResult } from '../types'
import { drawLetter, drawLines } from './letterCanvas'

// Writing letters with a finger or a pen: one letter at a time in the lines of
// the Schreibhaus, traced stroke by stroke from the green dot.
const props = defineProps<{
  /** The letters of this visit; drawn at random when not given */
  tasks?: WritingTask[]
}>()
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

// The pause after the cheer, before the next letter
const AFTER_CHEER_MS = 500
const CONFETTI_MS = 3000
// The start-dot hint is not repeated more often than this
const HINT_GAP_MS = 4000
// Guide points; lifting before this is just a tap and gets no comment
const SMALL_TRY = 8

// Spoken for a touch on the letter that missed the start dot; nothing beside the letter
const HINTS: Partial<Record<MissReason, string>> = {
  'wrong-end': 'Andersherum! Fang beim grünen Punkt an.',
  'far-from-start': 'Fang beim grünen Punkt an.',
}
const capital = (text: string) => text[0].toUpperCase() + text.slice(1)

// A visit that names a glyph we can't draw is no visit: better straight back than a letter short
const tasks = known(props.tasks ?? buildWritingSession(seededRandom(Date.now())))
function known(visit: WritingTask[]): WritingTask[] {
  return visit.every(t => GLYPHS[t.glyph]) ? visit : []
}
// One size for every letter of the visit
const view = viewBox(tasks.map(t => t.glyph))

const area = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
/** Letters written so far */
const written = ref(0)
const phase = ref<'writing' | 'cheering' | 'done'>('writing')
/** The letter on the board, for tests and browser checks */
const glyphName = ref('')

let letter: Glyph | null = null
let tracer: Tracer | null = null
/** The child's lines for the current letter, in letter space */
let ink: Point[][] = []
let fit = { scale: 1, ox: 0, oy: 0 }
let lastHint = -Infinity
/** How much of the letter on the board is shown */
let help: Help = 'full'
let sizeWatch: ResizeObserver | null = null
let stopLeaveRequests = () => {}

let closed = false
const timers = new Set<ReturnType<typeof setTimeout>>()
function later(fn: () => void, ms: number) {
  // Speech that ends because the child left must not start anything new
  if (closed) return
  const id = setTimeout(() => {
    timers.delete(id)
    if (!closed) fn()
  }, ms)
  timers.add(id)
}

function startTask() {
  letter = GLYPHS[tasks[written.value].glyph]
  help = tasks[written.value].help
  glyphName.value = letter.name
  // The pen's size carries over, so a resting hand stays known
  tracer = createTracer(letter, tracer?.smallest)
  ink = []
  phase.value = 'writing'
  draw()
}

/** The board as large as fits; without a layout, one pixel per letter unit. */
function resize() {
  const el = area.value
  const c = canvas.value
  if (!el || !c) return
  const w = el.clientWidth
  const h = el.clientHeight
  if (w > 0 && h > 0) {
    const dpr = window.devicePixelRatio || 1
    c.width = w * dpr
    c.height = h * dpr
    fit = fitView(view, w, h)
  }
  draw()
}

function draw() {
  const c = canvas.value
  const ctx = c?.getContext('2d')
  if (!c || !ctx || !letter || !tracer) return
  const dpr = window.devicePixelRatio || 1
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, c.width, c.height)
  ctx.setTransform(fit.scale * dpr, 0, 0, fit.scale * dpr, fit.ox * dpr, fit.oy * dpr)
  drawLines(ctx, BOX, view)
  drawLetter(ctx, { letter, tracer, help, ink })
}

function toLetter(e: PointerEvent): Point {
  const r = canvas.value!.getBoundingClientRect()
  return { x: (e.clientX - r.left - fit.ox) / fit.scale, y: (e.clientY - r.top - fit.oy) / fit.scale }
}

const contact = (e: PointerEvent) => Math.max(e.width || 0, e.height || 0)

function onDown(e: PointerEvent) {
  if (closed || phase.value !== 'writing' || !tracer) return
  const p = toLetter(e)
  const result = penDown(tracer, e.pointerId, p, contact(e))
  if (result.accepted) {
    canvas.value?.setPointerCapture?.(e.pointerId)
    ink.push([p])
  } else {
    // On the letter but not at the start dot: probably the pen in the wrong place
    const hint = HINTS[result.reason]
    if (hint && Date.now() - lastHint > HINT_GAP_MS) {
      lastHint = Date.now()
      void speak(hint)
    }
  }
  draw()
}

function onMove(e: PointerEvent) {
  if (closed || phase.value !== 'writing' || !tracer || e.pointerId !== tracer.pen) return
  // The iPad bundles several pen positions into one event
  const samples = e.getCoalescedEvents?.() ?? []
  let result: ReturnType<typeof penMove> = null
  for (const s of samples.length ? samples : [e]) {
    const q = toLetter(s)
    ink[ink.length - 1]?.push(q)
    result = penMove(tracer, e.pointerId, q) ?? result
    if (result) break
  }
  if (result === 'letter-done') finishLetter()
  draw()
}

function onUp(e: PointerEvent) {
  if (closed || phase.value !== 'writing' || !tracer || e.pointerId !== tracer.pen) return
  const progress = tracer.progress
  const result = penUp(tracer, e.pointerId)
  if (result === 'letter-done') {
    // A tapped dot can end the letter (Ä, Ö, Ü)
    finishLetter()
  } else if (result === 'too-short') {
    // Only the unfinished stroke goes; finished strokes stay
    ink.pop()
    if (progress >= SMALL_TRY) void speak('Fast! Fang nochmal beim grünen Punkt an.')
  }
  draw()
}

function finishLetter() {
  const finished = letter!
  written.value++
  phase.value = 'cheering'
  playBeat('chime')
  const cheer = speak(`Super! ${capital(finished.say)}!`)
  // Let the cheer finish before the next letter appears
  void cheer.then(() => later(() => {
    if (written.value >= tasks.length) {
      phase.value = 'done'
      void speak('Super geschrieben!')
      later(leave, CONFETTI_MS)
      return
    }
    startTask()
    void speak(letter === finished ? `Und nochmal ${letter.say}.` : `Jetzt ${letter!.say}.`)
  }, AFTER_CHEER_MS))
}

function shutDown() {
  if (closed) return
  closed = true
  for (const id of timers) clearTimeout(id)
  timers.clear()
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', resize)
  sizeWatch?.disconnect()
  stopLeaveRequests()
  stopSpeaking()
}

function leave() {
  if (closed) return
  shutDown()
  emit('finished', { stars: starsFor(written.value, tasks.length) })
}

function onKey(e: KeyboardEvent) {
  if (!e.repeat && e.code === 'Escape') leave()
}

onMounted(() => {
  if (tasks.length === 0) {
    leave()
    return
  }
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', resize)
  // The board can change size without the window doing so
  if (typeof ResizeObserver === 'function' && area.value) {
    sizeWatch = new ResizeObserver(resize)
    sizeWatch.observe(area.value)
  }
  stopLeaveRequests = onLeaveRequest(leave)
  startTask()
  resize()
  void speak(`Schreib ${letter!.say}! Fang beim grünen Punkt an.`)
})
onBeforeUnmount(shutDown)
</script>

<template>
  <div class="schreiben" data-test="schreiben" :data-phase="phase" :data-glyph="glyphName">
    <div class="progress" aria-hidden="true">
      <svg v-for="n in tasks.length" :key="n" viewBox="0 0 24 24" data-test="progress-star" :data-done="n <= written">
        <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
      </svg>
    </div>
    <div ref="area" class="area">
      <canvas
        ref="canvas" class="board" data-test="board"
        @pointerdown="onDown" @pointermove="onMove" @pointerup="onUp" @pointercancel="onUp"
      />
    </div>
    <Confetti v-if="phase === 'done'" />
  </div>
</template>

<style scoped>
.schreiben {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2vh;
  padding: 2vh 4vw 3vh;
  box-sizing: border-box;
  background: #fff4dd;
}
.progress { display: flex; gap: 14px; }
.progress svg { width: 46px; }
.progress path { fill: rgb(255 255 255 / 70%); stroke: #e6cf9c; stroke-width: 1.2; stroke-linejoin: round; transition: fill 0.3s ease; }
.progress svg[data-done='true'] path { fill: #ffd93d; stroke: #e0a800; }
.progress svg[data-done='true'] { animation: pop 0.5s ease; }
.area {
  flex: 1;
  min-height: 0;
  width: min(100%, 1000px);
  border-radius: 36px;
  background: #fffdf8;
  overflow: hidden;
}
/* The pen must draw, not scroll or select */
.board { width: 100%; height: 100%; display: block; touch-action: none; }
@keyframes pop { 0% { transform: scale(0.3); } 70% { transform: scale(1.3); } }
</style>
