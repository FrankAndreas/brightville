<script lang="ts">
/** World units to screen pixels where the world can't be measured (tests): the iPad's 100 units are about 700 px */
export const PX_PER_UNIT = 7
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import Confetti from '@/components/Confetti.vue'
import { buildRaumSession, exampleFor, type RaumExample, type RaumTask } from '@/core/raum'
import {
  CAR, OBJECTS, objectsWith, settle, startArrangement, THINGS, wrap, WORLD_WIDTH, type Arrangement, type Place,
} from '@/core/world'
import { askedAgain } from '@/services/sayAgain'
import { playBeat } from '@/services/sound'
import { forgetInstruction, instruct, instruction, speak, stopSpeaking } from '@/services/tts'
import { useSchoolStore } from '@/stores/school'
import { onLeaveRequest } from '../leave'
import type { BuildingResult } from '../types'
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
}>()
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

const AFTER_CHEER_MS = 500
const CONFETTI_MS = 3000
/** A press that moves less than this is a tap */
const TAP_PX = 8
/** Carrying a thing this close to the screen's side scrolls the world */
const EDGE = 0.08
const TICK_MS = 16
const EDGE_SPEED = 2.5
const CAR_SPEED = 1.2
const START_CAR_X = OBJECTS.find(o => o.id === CAR)?.x ?? 0

const school = useSchoolStore()
// Her step as the visit starts: the answers are counted at it, even if it changes meanwhile
const step = school.ladders.raum.step
// And the child who plays: if the device changes hands meanwhile, they still count for her
const player = school.who
const key = `brightville.spielwelt.${player ?? 'anyone'}`
const store = () => props.storage ?? window.localStorage

/** Her arrangement from last time, or the start one if there is none or it is broken */
function load(): { arrangement: Arrangement; carX: number } {
  const fresh = { arrangement: startArrangement(), carX: START_CAR_X }
  try {
    const raw = JSON.parse(store().getItem(key) ?? 'null') as { arrangement?: Record<string, unknown>; carX?: unknown } | null
    if (!raw || typeof raw !== 'object') return fresh
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
    store().setItem(key, JSON.stringify({ arrangement: arrangement.value, carX: carX.value }))
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

const tasks = props.tasks ?? buildRaumSession(step)
const example = props.example !== undefined ? props.example : exampleFor(step, school.ladders.raum.window.length)
const flow = createRaumFlow(tasks, example, () => arrangement.value, () => viewX.value, step)
const view = reactive({ ...flow.state })
const lit = ref<string | null>(null)
const confetti = ref(false)
const driving = ref(false)

/** The thing being carried, where it is now (world units) */
const carried = ref<{ id: string; x: number; y: number } | null>(null)

function measure() {
  const r = worldEl.value?.getBoundingClientRect()
  if (r && r.height > 0) {
    scale.value = r.height / 100
    viewW.value = r.width / scale.value
  }
}

/** A thing's drawn spot: on or in the car it rides along */
function spot(id: string): { x: number; y: number; lane: Place['lane']; ghost: boolean; small: boolean } {
  if (carried.value?.id === id) return { x: carried.value.x, y: carried.value.y, lane: 'front', ghost: false, small: false }
  const p = arrangement.value[id]
  const host = p.on ?? p.inside
  const x = host === CAR ? carX.value : p.x
  return { x, y: p.y, lane: p.lane, ghost: p.lane === 'back', small: !!p.inside || p.lane === 'back' }
}
/** Behind things come first, then in/under/on/mid, then the ones in front */
const order = computed(() => {
  const rank = (id: string) => (carried.value?.id === id ? 3 : arrangement.value[id].lane === 'front' ? 2 : 1)
  return [...THINGS].sort((a, b) => rank(a.id) - rank(b.id))
})
const COPIES = [-WORLD_WIDTH, 0, WORLD_WIDTH]

let closed = false
const timers = new Set<ReturnType<typeof setTimeout>>()
function later(fn: () => void, ms: number) {
  const id = setTimeout(() => {
    timers.delete(id)
    if (!closed) fn()
  }, ms)
  timers.add(id)
}

function sync() {
  Object.assign(view, flow.state)
}

/** Each run is numbered: what an older one still had to say is dropped when a newer one starts */
let current = 0

function centreOn(x: number) {
  viewX.value = wrap(x - viewW.value / 2)
}

function run(effects: RaumEffect[]): Promise<boolean> {
  sync()
  const mine = ++current
  const live = () => !closed && mine === current
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
      arrangement.value = effect.arrangement
      save()
      // A placing task shows its object; a finding task leaves her to look
      const task = flow.state.task
      const obj = task?.type === 'place' ? OBJECTS.find(o => o.id === task.clues[0].object) : undefined
      if (obj) centreOn(obj.x)
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
        const said = effect.ask ? instruct(effect.text) : speak(effect.text)
        if (effect.ask) instruction.value = effect.again ?? effect.text
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

type Press =
  | { kind: 'thing'; id: string; x0: number; y0: number; moved: boolean }
  | { kind: 'world'; x0: number; view0: number; moved: boolean }
  | { kind: 'car'; x0: number; y0: number; moved: boolean }
let press: Press | null = null
let lastPointer = { x: 0, y: 0 }

function rect() {
  const r = worldEl.value?.getBoundingClientRect()
  return r && r.width > 0 ? r : { left: 0, top: 0, width: viewW.value * scale.value, height: 100 * scale.value }
}
const toWorld = (cx: number, cy: number) => {
  const r = rect()
  return { x: wrap(viewX.value + (cx - r.left) / scale.value), y: (cy - r.top) / scale.value }
}

function onThing(id: string, e: PointerEvent) {
  if (closed || view.phase === 'example') return
  e.stopPropagation()
  press = { kind: 'thing', id, x0: e.clientX, y0: e.clientY, moved: false }
  listen()
}
function onObject(id: string, e: PointerEvent) {
  if (closed || id !== CAR || view.phase === 'example') return
  e.stopPropagation()
  press = { kind: 'car', x0: e.clientX, y0: e.clientY, moved: false }
  listen()
}
function onWorld(e: PointerEvent) {
  if (closed) return
  press = { kind: 'world', x0: e.clientX, view0: viewX.value, moved: false }
  listen()
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
  if (!press) return
  lastPointer = { x: e.clientX, y: e.clientY }
  const far = Math.hypot(e.clientX - press.x0, e.clientY - ('y0' in press ? press.y0 : e.clientY)) > TAP_PX
  if (far) press.moved = true
  if (press.kind === 'world') viewX.value = wrap(press.view0 - (e.clientX - press.x0) / scale.value)
  else if (press.kind === 'thing' && press.moved) {
    const at = toWorld(e.clientX, e.clientY)
    if (!carried.value) edgeScroll()
    carried.value = { id: press.id, ...at }
  }
}

/** While she carries a thing near a side, the world scrolls that way */
function edgeScroll() {
  if (!carried.value || closed) return
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
  press = null
  unlisten()
  if (!p || closed) return
  if (p.kind === 'car' && !p.moved) {
    driving.value = !driving.value
    if (driving.value) playBeat('bell')
    return
  }
  if (p.kind !== 'thing') return
  if (!p.moved) {
    carryOn(flow.tapThing(p.id))
    return
  }
  const at = carried.value ?? toWorld(e.clientX, e.clientY)
  carried.value = null
  const place = settle(at.x, at.y, objects.value)
  arrangement.value = { ...arrangement.value, [p.id]: place }
  save()
  carryOn(flow.released(p.id, place))
}

// ---- The car ----

let driveDir = 0
function drive(dir: number) {
  driveDir = dir
  const tick = () => {
    if (driveDir === 0 || closed) return
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

// ---- The strip: the whole world, small ----

function onStrip(e: PointerEvent) {
  const r = stripEl.value?.getBoundingClientRect()
  if (!r || r.width <= 0) return
  centreOn(((e.clientX - r.left) / r.width) * WORLD_WIDTH)
}

// ---- Leaving ----

let stopLeaveRequests = () => {}

function shutDown() {
  if (closed) return
  closed = true
  for (const id of timers) clearTimeout(id)
  timers.clear()
  unlisten()
  window.removeEventListener('resize', measure)
  stopLeaveRequests()
  stopSpeaking()
  save()
}

function leave() {
  if (closed) return
  shutDown()
  school.record(flow.state.results, { raum: step }, player)
  emit('finished', { stars: flow.state.stars })
}

watch(askedAgain, () => {
  if (closed || flow.state.phase !== 'asking') return
  current++
  lit.value = null
})

onMounted(() => {
  measure()
  window.addEventListener('resize', measure)
  stopLeaveRequests = onLeaveRequest(leave)
  carryOn(flow.start())
})
onBeforeUnmount(shutDown)
</script>

<template>
  <div class="spielwelt" data-test="spielwelt" :data-phase="view.phase">
    <div class="top">
      <div class="progress" aria-hidden="true">
        <svg v-for="n in tasks.length" :key="n" viewBox="0 0 24 24" data-test="progress-star" :data-done="n <= view.solved">
          <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
        </svg>
      </div>
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
.progress { display: flex; gap: 10px; }
.progress svg { width: 38px; }
.progress path { fill: rgb(255 255 255 / 70%); stroke: #9cc7e8; stroke-width: 1.2; stroke-linejoin: round; }
.progress svg[data-done='true'] path { fill: #ffd93d; stroke: #e0a800; }
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
</style>
