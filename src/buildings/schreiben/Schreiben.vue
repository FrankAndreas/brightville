<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Confetti from '@/components/Confetti.vue'
import { seededRandom } from '@/core/numbers'
import { BOX, GLYPHS, fitView, viewBox, type Glyph, type Point, type ViewBox } from '@/core/writing/letters'
import { helpFor } from '@/core/writing/levels'
import { buildDailyRound, starsFor, textTasks, type Help, type WritingTask } from '@/core/writing/session'
import { createTracer, penDown, penMove, penUp, type MissReason, type Tracer } from '@/core/writing/tracing'
import { playBeat } from '@/services/sound'
import { instruct, speak, stopSpeaking } from '@/services/tts'
import { useWritingStore } from '@/stores/writing'
import { onLeaveRequest } from '../leave'
import type { BuildingResult } from '../types'
import InkRow from './InkRow.vue'
import { drawLetter, drawLines } from './letterCanvas'
import WritingMenu from './WritingMenu.vue'

// Writing letters with a finger or a pen: one letter at a time in the lines of
// the Schreibhaus, traced stroke by stroke from the green dot. She chooses one
// of her words or sentences (the parents write them), or today's letters (🎲).
const props = defineProps<{
  /** The letters of this visit, without the choice (tests); otherwise she chooses */
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
/** As the voice should say it: "ICH MAG DICH" spelled out letter by letter would be no sentence */
const spoken = (text: string) => capital(text.toLowerCase())

// A visit that names a glyph we can't draw is no visit: better straight back than a letter short
function known(visit: WritingTask[]): WritingTask[] {
  return visit.every(t => GLYPHS[t.glyph]) ? visit : []
}
const visit = ref<WritingTask[]>([])
/** Her word or sentence, when she chose one; null for today's letters */
const text = ref<string | null>(null)
/** Waiting for her letters, choosing, or writing */
const stage = ref<'waiting' | 'menu' | 'board'>('waiting')
/** Her lines for each letter written, for the row along the top */
const inks = ref<Point[][][]>([])
// One size for every letter of the visit
let view: ViewBox = viewBox([])
/** In a sentence: the letter that starts each word after the first, and that word */
let wordAt = new Map<number, string>()

const area = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
/** Letters written so far */
const written = ref(0)
const phase = ref<'writing' | 'cheering' | 'done'>('writing')
/** The letter on the board, for tests and browser checks */
const glyphName = ref('')
/** How much of the letter on the board is shown, for tests and browser checks */
const shownHelp = ref<Help>('full')
const writing = useWritingStore()

let letter: Glyph | null = null
let tracer: Tracer | null = null
/** The child's lines for the current letter, in letter space */
let ink: Point[][] = []
let fit = { scale: 1, ox: 0, oy: 0 }
let lastHint = -Infinity
/** How much of the letter on the board is shown */
let help: Help = 'full'
/** The level the letter is shown at, when this write counts towards it */
let countingLevel: number | null = null
/** A wrong start or a real try lifted early: this write wasn't smooth */
let bumpy = false
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
  const task = visit.value[written.value]
  letter = GLYPHS[task.glyph]
  // A letter she has met gets the help her level gives now (it may have changed earlier in this visit)
  const known = task.counts ? writing.letters[task.glyph] : undefined
  countingLevel = known ? known.level : null
  help = known ? helpFor(known.level) : task.help
  shownHelp.value = help
  bumpy = false
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
    // With nothing shown, any touch but a hand's means she didn't know where to start: show the dot
    const missed = result.reason === 'wrong-end' || result.reason === 'far-from-start'
    const lost = help === 'none' && (missed || result.reason === 'off-letter')
    if (lost || missed) bumpy = true
    if (lost) {
      help = 'start'
      shownHelp.value = help
    }
    // On the letter but not at the start dot: probably the pen in the wrong place
    const hint = lost ? HINTS['far-from-start'] : HINTS[result.reason]
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
    if (progress >= SMALL_TRY) {
      bumpy = true
      void speak('Fast! Fang nochmal beim grünen Punkt an.')
    }
  }
  draw()
}

function finishLetter() {
  const finished = letter!
  const task = visit.value[written.value]
  if (countingLevel !== null) writing.recordWrite(finished.name, countingLevel, !bumpy)
  countingLevel = null
  // The third write of a new letter: she has met it now
  if (task.intro && !visit.value.slice(written.value + 1).some(t => t.intro && t.glyph === task.glyph)) writing.introduce(task.glyph)
  inks.value = [...inks.value, ink]
  written.value++
  phase.value = 'cheering'
  playBeat('chime')
  const cheer = speak(`Super! ${capital(finished.say)}!`)
  // Let the cheer finish before the next letter appears
  void cheer.then(() => later(() => {
    if (written.value >= visit.value.length) {
      phase.value = 'done'
      void speak(text.value ? `Super geschrieben! ${spoken(text.value)}!` : 'Super geschrieben!')
      later(leave, CONFETTI_MS)
      return
    }
    startTask()
    const word = wordAt.get(written.value)
    if (word) void instruct(`Jetzt das Wort ${spoken(word)}. Zuerst ${letter!.say}.`)
    else void instruct(letter === finished ? `Und nochmal ${letter.say}.` : `Jetzt ${letter!.say}.`)
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
  emit('finished', { stars: starsFor(written.value, visit.value.length) })
}

/** Starts writing `planned`: her word or sentence `chosen`, or today's letters (null) */
function begin(planned: WritingTask[], chosen: string | null) {
  visit.value = known(planned)
  if (visit.value.length === 0) {
    leave()
    return
  }
  text.value = chosen
  view = viewBox(visit.value.map(t => t.glyph))
  wordAt = new Map()
  if (chosen) {
    let at = 0
    for (const [i, word] of chosen.split(' ').entries()) {
      if (i > 0) wordAt.set(at, word)
      at += word.length
    }
  }
  stage.value = 'board'
  startTask()
  // The board shows now: as large as fits
  void nextTick(resize)
  void instruct(chosen
    ? `Wir schreiben: ${spoken(chosen)}! Zuerst ${letter!.say}.`
    : `Schreib ${letter!.say}! Fang beim grünen Punkt an.`)
}

function todaysLetters() {
  begin(buildDailyRound({
    letters: writing.letters, texts: writing.texts, newLeft: writing.newLeft, rand: seededRandom(Date.now()),
  }), null)
}

function choose(chosen: string | null) {
  if (closed || stage.value !== 'menu') return
  if (chosen === null) todaysLetters()
  else begin(textTasks(chosen, writing.letters), chosen)
}

/** Her letters are known (or the server took too long): her words to choose from, or today's letters at once */
function ready() {
  if (closed || stage.value !== 'waiting') return
  if (writing.texts.length === 0) {
    todaysLetters()
    return
  }
  stage.value = 'menu'
  void instruct('Was möchtest du schreiben? Tipp auf eine Karte.')
}

function onKey(e: KeyboardEvent) {
  if (!e.repeat && e.code === 'Escape') leave()
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', resize)
  // The board can change size without the window doing so
  if (typeof ResizeObserver === 'function' && area.value) {
    sizeWatch = new ResizeObserver(resize)
    sizeWatch.observe(area.value)
  }
  stopLeaveRequests = onLeaveRequest(leave)
  if (props.tasks) {
    begin(props.tasks, null)
    return
  }
  // Her letters may have changed on another device: asked again on every visit
  void writing.load()
  if (writing.loaded) ready()
  else watch(() => writing.loaded, now => { if (now) ready() })
})
onBeforeUnmount(shutDown)
</script>

<template>
  <div class="schreiben" data-test="schreiben" :data-stage="stage" :data-phase="phase" :data-glyph="glyphName" :data-help="shownHelp">
    <WritingMenu v-if="stage === 'menu'" :texts="writing.texts" @choose="choose" />
    <InkRow v-if="stage === 'board' && text" :text="text" :inks="inks" :current="written" :view="view" />
    <div v-else-if="stage === 'board'" class="progress" aria-hidden="true">
      <svg v-for="n in visit.length" :key="n" viewBox="0 0 24 24" data-test="progress-star" :data-done="n <= written">
        <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
      </svg>
    </div>
    <div v-show="stage === 'board'" ref="area" class="area">
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
