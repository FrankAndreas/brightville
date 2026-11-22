<script lang="ts">
/** World units to screen pixels where the world can't be measured (tests): the iPad's 100 units are about 700 px */
export const PX_PER_UNIT = 7
</script>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import Confetti from '@/components/Confetti.vue'
import ProgressStars from '@/components/ProgressStars.vue'
import { buildRaumSession, exampleFor, type RaumExample, type RaumTask } from '@/core/raum'
import {
  CAR, OBJECTS, objectsWith, settle, startArrangement, THINGS, wrap, WORLD_WIDTH, type Arrangement, type Place,
} from '@/core/world'
import { askedAgain } from '@/services/sayAgain'
import { playBeat } from '@/services/sound'
import { forgetInstruction, hasVoice, instruct, instruction, speak, voiceCount } from '@/services/tts'
import type { Lang } from '@/core/vocab/types'
import { GERMAN_TEXTS, worldTexts } from '@/core/worldWords'
import type { BuildingResult } from '../types'
import { ladderVisit, useVisit } from '../visit'
import { createRaumFlow, type RaumEffect } from './flow'
import WorldScene from './WorldScene.vue'

// The Spielwelt: a wide world to scroll through, things to carry and a car to drive. Five position-word tasks on the
// Raum ladder (Lehrplan 21 MA.2, Zugang 4), then free play for as long as she likes.
const props = defineProps<{
  /** The tasks of this visit; made up at her Raum step when not given */
  tasks?: RaumTask[]
  /** The example before the first task; from her step and answers when not given (null: none) */
  example?: RaumExample | null
  /** Where her arrangement is kept; the browser's storage when not given */
  storage?: Storage
  /**
   * The Oberstufe: the tasks in English or French (every position word from the start, no example, nothing recorded on
   * the Raum ladder), spoken in that language's voice and written on the screen. Left out: her German Spielwelt.
   */
  lang?: Lang
}>()
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

const AFTER_CHEER_MS = 500
const CONFETTI_MS = 3000
/** A press that moves less than this is a tap */
const TAP_PX = 8
/** Carrying a thing this close to the screen's side scrolls the world */
const EDGE = 0.08
const TICK_MS = 16
const EDGE_SPEED = 1.2
const CAR_SPEED = 1.2
const START_CAR_X = OBJECTS.find(o => o.id === CAR)?.x ?? 0
/** Bump when objects move in world.ts: an arrangement saved for another layout starts afresh */
const LAYOUT = 1

// Her step, her answers at it and the child who plays, as the visit starts
const ladder = ladderVisit('raum')
const step = ladder.step
const visit = useVisit(leave)
const { later } = visit
const key = `brightville.spielwelt.${ladder.player ?? 'anyone'}`
const store = () => props.storage ?? window.localStorage

/** Her arrangement from last time, or the start one if there is none or it is broken */
function load(): { arrangement: Arrangement; carX: number } {
  const fresh = { arrangement: startArrangement(), carX: START_CAR_X }
  try {
    const raw = JSON.parse(store().getItem(key) ?? 'null') as
      { layout?: unknown; arrangement?: Record<string, unknown>; carX?: unknown } | null
    if (!raw || typeof raw !== 'object' || raw.layout !== LAYOUT) return fresh
    const ids = new Set(OBJECTS.map(o => o.id))
    const ok = (p: unknown): p is Place => {
      const q = p as Place
      return typeof q === 'object' && q !== null && Number.isFinite(q.x) && Number.isFinite(q.y)
        && ['back', 'mid', 'front'].includes(q.lane)
        && [q.on, q.inside, q.under].every(r => r === undefined || ids.has(r))
    }
    const arrangement = { ...fresh.arrangement }
    for (const [id, p] of Object.entries(raw.arrangement ?? {})) {
      if (!(id in arrangement)) continue
      if (!ok(p)) return fresh
      arrangement[id] = { ...p, x: wrap(p.x) }
    }
    return { arrangement, carX: typeof raw.carX === 'number' && Number.isFinite(raw.carX) ? wrap(raw.carX) : START_CAR_X }
  } catch {
    return fresh
  }
}
function save() {
  try {
    store().setItem(key, JSON.stringify({ layout: LAYOUT, arrangement: arrangement.value, carX: carX.value }))
  } catch {
    // Not kept: it's only where things lie
  }
}

const loaded = load()
const arrangement = ref<Arrangement>(loaded.arrangement)
const carX = ref(loaded.carX)
const objects = computed(() => objectsWith(carX.value))
const viewX = ref(0)
/** The world's size on screen: pixels per unit and the view's width in units */
const scale = ref(PX_PER_UNIT)
const viewW = ref(1180 / PX_PER_UNIT)
const worldEl = ref<SVGSVGElement | null>(null)
const stripEl = ref<HTMLElement | null>(null)

/** The Oberstufe's tasks use every position word (the last step); its visit has no example */
const ALL_WORDS_STEP = 6
const VOICE: Record<Lang, string> = { en: 'en-GB', fr: 'fr-FR' }
const tasks = props.tasks ?? buildRaumSession(props.lang ? ALL_WORDS_STEP : step)
const example = props.lang ? null : props.example !== undefined ? props.example : exampleFor(step, ladder.windowLength)
const flow = createRaumFlow(
  tasks, example, () => arrangement.value, () => wrap(viewX.value + viewW.value / 2), props.lang ? ALL_WORDS_STEP : step,
  () => objects.value, props.lang ? worldTexts(props.lang) : GERMAN_TEXTS,
)
/** At Oberstufe: the instruction on the screen (and for 🔊), in the language */
const written = ref<string | null>(null)
const canSay = computed(() => {
  void voiceCount.value
  return !!props.lang && hasVoice(VOICE[props.lang])
})
function sayAgain() {
  if (props.lang && written.value) void speak(written.value, VOICE[props.lang])
}
const view = reactive({ ...flow.state })
const lit = ref<string | null>(null)
const confetti = ref(false)
const driving = ref(false)

/** The thing being carried, where it is now (world units) */
const carried = ref<{ id: string; x: number; y: number } | null>(null)

function measure() {
  const r = worldEl.value?.getBoundingClientRect()
  if (r && r.height > 0) {
    // Turning the iPad keeps the middle of what she sees where it was (where a task was put in view)
    const middle = viewX.value + viewW.value / 2
    scale.value = r.height / 100
    viewW.value = r.width / scale.value
    centreOn(middle)
  }
}

/** A thing's drawn spot: on or in the car it rides along */
function spot(id: string): { x: number; y: number; lane: Place['lane']; ghost: boolean; small: boolean } {
  if (carried.value?.id === id) return { x: carried.value.x, y: carried.value.y, lane: 'front', ghost: false, small: false }
  const p = arrangement.value[id]
  const host = p.on ?? p.inside
  const x = host === CAR ? carX.value : p.x
  return { x, y: p.y, lane: p.lane, ghost: p.lane === 'back', small: !!p.inside || !!p.under || p.lane === 'back' }
}
/** In/under/on/mid and behind first, then the ones in front, then the one to find, then the one being carried */
const order = computed(() => {
  const toFind = view.task?.type === 'find' && view.phase === 'asking' ? view.task.thing : null
  const rank = (id: string) =>
    (carried.value?.id === id ? 4 : id === toFind ? 3 : arrangement.value[id].lane === 'front' ? 2 : 1)
  return [...THINGS].sort((a, b) => rank(a.id) - rank(b.id))
})
const COPIES = [-WORLD_WIDTH, 0, WORLD_WIDTH]

function sync() {
  Object.assign(view, flow.state)
}


function centreOn(x: number) {
  viewX.value = wrap(x - viewW.value / 2)
}

function run(effects: RaumEffect[]): Promise<boolean> {
  sync()
  // Each run is numbered: what an older one still had to say is dropped when a newer one starts
  const live = visit.newRun()
  lit.value = null
  let chain: Promise<void> = Promise.resolve()
  for (const effect of effects) {
    if (effect.type === 'chime') {
      playBeat('chime')
      forgetInstruction()
    } else if (effect.type === 'free') {
      confetti.value = true
      later(() => { confetti.value = false }, CONFETTI_MS)
    } else if (effect.type === 'setup') {
      // Whatever she still holds is let go: the task needs things where it put them
      dropPress()
      arrangement.value = effect.arrangement
      save()
      // At steps 1–3 a task happens on her screen: a placing task shows its object (the thing waits next to it), a
      // finding task where the thing hides, so she needn't know yet that the world scrolls. Later the thing to carry
      // starts where she looks and she carries it there, and a thing to find is hers to look for.
      const task = flow.state.task
      if (task && step <= 3) {
        if (task.type === 'find') centreOn(effect.arrangement[task.thing].x)
        else {
          const obj = OBJECTS.find(o => o.id === task.clues[0].object)
          if (obj) centreOn(obj.x)
        }
      }
    } else if (effect.type === 'show') {
      chain = chain.then(() => {
        if (!live()) return
        arrangement.value = { ...arrangement.value, [effect.thing]: effect.place }
        centreOn(effect.place.x)
      })
    } else if (effect.type === 'speak') {
      chain = chain.then(async () => {
        if (!live()) return
        lit.value = effect.light ?? null
        let said: Promise<void>
        if (props.lang) {
          // The language's own voice; the town's German 🔊 stays out of it
          if (effect.ask) written.value = effect.again ?? effect.text
          said = canSay.value ? speak(effect.text, VOICE[props.lang]) : Promise.resolve()
        } else {
          said = effect.ask ? instruct(effect.text) : speak(effect.text)
          if (effect.ask) instruction.value = effect.again ?? effect.text
        }
        await said
        if (live()) lit.value = null
      })
    }
  }
  return chain.then(() => live())
}

function carryOn(effects: RaumEffect[]) {
  sync()
  if (effects.length === 0) return
  void run(effects).then(finished => {
    if (!finished) return
    if (flow.state.phase === 'example') carryOn(flow.exampleDone())
    else if (flow.state.phase === 'cheering') later(() => carryOn(flow.next()), AFTER_CHEER_MS)
  })
}

// ---- Pointer: carrying things, swiping the world, tapping the car ----

type Press = { pointer: number; x0: number; y0: number; view0: number; moved: boolean } & (
  | { kind: 'thing'; id: string }
  | { kind: 'world' }
  | { kind: 'car' }
  | { kind: 'strip' })
/** One finger at a time: another one is ignored while a press lasts */
let press: Press | null = null
let lastPointer = { x: 0, y: 0 }
let edgeLoop = false

function rect() {
  const r = worldEl.value?.getBoundingClientRect()
  return r && r.width > 0 ? r : { left: 0, top: 0, width: viewW.value * scale.value, height: 100 * scale.value }
}
const toWorld = (cx: number, cy: number) => {
  const r = rect()
  return { x: wrap(viewX.value + (cx - r.left) / scale.value), y: (cy - r.top) / scale.value }
}

const begin = (e: PointerEvent) => ({ pointer: e.pointerId, x0: e.clientX, y0: e.clientY, view0: viewX.value, moved: false })

function onThing(id: string, e: PointerEvent) {
  e.stopPropagation()
  if (visit.isClosed() || press || view.phase === 'example') return
  press = { ...begin(e), kind: 'thing', id }
  listen()
}
function onObject(id: string, e: PointerEvent) {
  if (visit.isClosed() || id !== CAR || view.phase === 'example') return
  e.stopPropagation()
  if (press) return
  press = { ...begin(e), kind: 'car' }
  listen()
}
function onWorld(e: PointerEvent) {
  if (visit.isClosed() || press) return
  press = { ...begin(e), kind: 'world' }
  listen()
}
/** Lets go of whatever she holds, without placing it */
function dropPress() {
  press = null
  carried.value = null
  unlisten()
}
function listen() {
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onUp)
}
function unlisten() {
  window.removeEventListener('pointermove', onMove)
  window.removeEventListener('pointerup', onUp)
  window.removeEventListener('pointercancel', onUp)
}

function onMove(e: PointerEvent) {
  if (!press || e.pointerId !== press.pointer) return
  lastPointer = { x: e.clientX, y: e.clientY }
  if (Math.hypot(e.clientX - press.x0, e.clientY - press.y0) > TAP_PX) press.moved = true
  if (press.kind === 'strip') stripTo(e.clientX)
  // Swiping on the background, or on the car, scrolls
  else if (press.kind === 'world' || (press.kind === 'car' && press.moved)) {
    viewX.value = wrap(press.view0 - (e.clientX - press.x0) / scale.value)
  } else if (press.kind === 'thing' && press.moved) {
    carried.value = { id: press.id, ...toWorld(e.clientX, e.clientY) }
    if (!edgeLoop) {
      edgeLoop = true
      edgeScroll()
    }
  }
}

/** While she carries a thing near a side, the world scrolls that way */
function edgeScroll() {
  if (!carried.value || visit.isClosed()) {
    edgeLoop = false
    return
  }
  const r = rect()
  const rel = (lastPointer.x - r.left) / r.width
  const dir = rel < EDGE ? -1 : rel > 1 - EDGE ? 1 : 0
  if (dir) {
    viewX.value = wrap(viewX.value + dir * EDGE_SPEED)
    carried.value = { ...carried.value, ...toWorld(lastPointer.x, lastPointer.y) }
  }
  later(edgeScroll, TICK_MS)
}

function onUp(e: PointerEvent) {
  const p = press
  if (!p || e.pointerId !== p.pointer) return
  press = null
  unlisten()
  if (visit.isClosed()) {
    carried.value = null
    return
  }
  if (p.kind === 'car' && !p.moved) {
    driving.value = !driving.value
    if (driving.value) playBeat('bell')
    return
  }
  if (p.kind !== 'thing') return
  const at = carried.value ?? toWorld(e.clientX, e.clientY)
  // Never left in the air
  carried.value = null
  if (!p.moved) {
    carryOn(flow.tapThing(p.id))
    return
  }
  const place = settle(at.x, at.y, objects.value)
  arrangement.value = { ...arrangement.value, [p.id]: place }
  save()
  carryOn(flow.released(p.id, place))
}

// ---- The car ----

let driveDir = 0
let driveLoop = false
/** One loop drives the car, however many arrows are held */
function drive(dir: number) {
  driveDir = dir
  if (driveLoop) return
  driveLoop = true
  const tick = () => {
    if (driveDir === 0 || visit.isClosed() || !driving.value) {
      driveLoop = false
      return
    }
    carX.value = wrap(carX.value + driveDir * CAR_SPEED)
    centreOn(carX.value)
    later(tick, TICK_MS)
  }
  tick()
}
function stopDriving() {
  if (driveDir !== 0) save()
  driveDir = 0
}
// Getting out stops the car, even while an arrow is held (its button is gone, so its pointerup never comes)
watch(driving, on => { if (!on) stopDriving() })

// ---- The strip: the whole world, small ----

function stripTo(clientX: number) {
  const r = stripEl.value?.getBoundingClientRect()
  if (!r || r.width <= 0) return
  centreOn(((clientX - r.left) / r.width) * WORLD_WIDTH)
}
/** A tap on the strip jumps there; dragging along it scrolls */
function onStrip(e: PointerEvent) {
  stripTo(e.clientX)
  if (visit.isClosed() || press) return
  press = { ...begin(e), kind: 'strip' }
  listen()
}

// ---- Leaving ----

/** What closing the visit must undo besides its timers and voice */
function cleanUp() {
  unlisten()
  window.removeEventListener('resize', measure)
  save()
}
visit.onShutDown(cleanUp)

function leave() {
  if (visit.isClosed()) return
  visit.shutDown()
  if (!props.lang) ladder.record(flow.state.results)
  emit('finished', { stars: flow.state.stars })
}

watch(askedAgain, () => {
  if (visit.isClosed() || flow.state.phase !== 'asking') return
  visit.dropRuns()
  lit.value = null
})

onMounted(() => {
  measure()
  window.addEventListener('resize', measure)
  carryOn(flow.start())
})
</script>

<template>
  <div class="spielwelt" data-test="spielwelt" :data-phase="view.phase">
    <div class="top">
      <ProgressStars :total="tasks.length" :solved="view.solved" edge="#9cc7e8" :size="38" />
      <div ref="stripEl" class="strip" data-test="strip" aria-label="Die ganze Welt" @pointerdown="onStrip">
        <span v-for="o in objects" :key="o.id" class="dot" :style="{ left: `${(o.x / WORLD_WIDTH) * 100}%` }" />
        <span
          class="frame"
          :style="{ left: `${(viewX / WORLD_WIDTH) * 100}%`, width: `${(viewW / WORLD_WIDTH) * 100}%` }"
        />
        <span
          v-if="viewX + viewW > WORLD_WIDTH" class="frame"
          :style="{ left: '0%', width: `${((viewX + viewW - WORLD_WIDTH) / WORLD_WIDTH) * 100}%` }"
        />
      </div>
    </div>

    <div v-if="lang && written && view.phase !== 'free'" class="coach" :lang="lang">
      <p class="said" data-test="instruction">{{ written }}</p>
      <button v-if="canSay" type="button" class="again" data-test="say-again" aria-label="Nochmal hören" @click="sayAgain">🔊</button>
      <p v-if="view.index === 0" class="hint" data-test="coach-hint" lang="de">Mach, was der Coach sagt</p>
    </div>

    <svg
      ref="worldEl" class="world" data-test="world" :data-view-x="viewX" :data-view-w="viewW"
      :viewBox="`0 0 ${viewW} 100`" preserveAspectRatio="xMinYMin slice" @pointerdown="onWorld"
    >
      <g v-for="offset in COPIES" :key="offset" :transform="`translate(${offset - viewX} 0)`">
        <WorldScene :objects="objects" :lit="lit" @object="onObject" />
        <text
          v-for="t in order" :key="t.id" class="thing" :data-test="`thing-${t.id}`" :data-x="spot(t.id).x"
          :data-lifted="carried?.id === t.id" :x="spot(t.id).x" :y="spot(t.id).y"
          :font-size="spot(t.id).small ? 7.5 : 9" :opacity="spot(t.id).ghost ? 0.6 : 1" text-anchor="middle"
          @pointerdown="onThing(t.id, $event)"
        >{{ t.emoji }}</text>
      </g>
    </svg>

    <div v-if="view.phase === 'example'" class="badge" data-test="example" aria-hidden="true">👀</div>

    <div v-if="driving" class="drive">
      <button
        class="arrow" data-test="drive-left" aria-label="Nach links fahren" @pointerdown="drive(-1)"
        @pointerup="stopDriving" @pointerleave="stopDriving" @pointercancel="stopDriving"
      >◀</button>
      <button
        class="arrow" data-test="drive-right" aria-label="Nach rechts fahren" @pointerdown="drive(1)"
        @pointerup="stopDriving" @pointerleave="stopDriving" @pointercancel="stopDriving"
      >▶</button>
    </div>

    <Confetti v-if="confetti" />
  </div>
</template>

<style scoped>
.spielwelt {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #cfeaff;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}
button { border: 0; padding: 0; background: none; font: inherit; cursor: pointer; }

.top { display: flex; align-items: center; justify-content: center; gap: 24px; padding: 1.5vh 4vw 1vh 180px; }
.strip {
  position: relative;
  flex: 1;
  max-width: 420px;
  height: 22px;
  border-radius: 11px;
  background: #8fd17c;
  cursor: pointer;
}
.dot { position: absolute; top: 8px; width: 4px; height: 6px; border-radius: 2px; background: #2e7d32; }
.frame { position: absolute; top: -3px; bottom: -3px; border: 3px solid #fff; border-radius: 8px; box-sizing: border-box; }

.world { flex: 1; min-height: 0; width: 100%; display: block; cursor: grab; }
.thing { cursor: pointer; }
.thing[data-lifted='true'] { filter: drop-shadow(0 2px 1px rgb(0 0 0 / 35%)); }
.badge { position: absolute; top: 70px; right: 18px; font-size: 36px; }

.drive { position: absolute; bottom: 3vh; left: 0; right: 0; display: flex; justify-content: space-between; padding: 0 4vw; pointer-events: none; }
.arrow {
  pointer-events: auto;
  width: min(15vw, 120px);
  height: min(15vw, 120px);
  border-radius: 50%;
  background: rgb(255 255 255 / 85%);
  box-shadow: 0 6px 0 rgb(0 0 0 / 15%);
  font-size: min(8vw, 60px);
  color: #e53935;
}
.arrow:active { transform: translateY(4px); box-shadow: 0 2px 0 rgb(0 0 0 / 15%); }
.coach {
  position: absolute; left: 104px; right: 104px; top: 64px; z-index: 2; display: flex; flex-wrap: wrap; align-items: center;
  justify-content: center; gap: 4px 12px; padding: 8px 16px; border-radius: 14px; background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12); pointer-events: none;
}
.coach .said { margin: 0; font: 700 24px/1.3 system-ui, sans-serif; color: #23264a; text-align: center; }
.coach .again { pointer-events: auto; font-size: 24px; background: none; border: 0; }
.coach .hint { flex-basis: 100%; margin: 0; text-align: center; font: 500 15px/1.2 system-ui, sans-serif; color: #5a5f86; }
</style>
