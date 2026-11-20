<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import Confetti from '@/components/Confetti.vue'
import {
  buildZeitSession, DAY_COLOURS, DAYS, exampleFor, weekdayOf, type Activity, type ClockTime, type ZeitExample,
  type ZeitTask,
} from '@/core/kalender'
import { askedAgain } from '@/services/sayAgain'
import { playBeat } from '@/services/sound'
import { forgetInstruction, instruct, instruction, speak, stopSpeaking } from '@/services/tts'
import { useSchoolStore } from '@/stores/school'
import { onLeaveRequest } from '../leave'
import type { BuildingResult } from '../types'
import ClockFace from './ClockFace.vue'
import { createZeitFlow, type ZeitEffect } from './flow'
import SunSky from './SunSky.vue'

// The Kalender: finding her way in time. The order of a day, morning to night, the week, yesterday and tomorrow from
// the real day, the seasons and the clock, on the Zeit ladder (Lehrplan 21 MA.3, Zugang 3); all of it said aloud.
const props = defineProps<{
  /** The tasks of this visit; made up at her Zeit step when not given */
  tasks?: ZeitTask[]
  /** The example before the first task; from her step and answers when not given (null: none) */
  example?: ZeitExample | null
  /** "Heute"; the device's date when not given. Read once: a visit over midnight keeps its day */
  today?: Date
}>()
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

const AFTER_CHEER_MS = 500
// After each lit line, before the next
const BETWEEN_MS = 200
const CONFETTI_MS = 3000
// A picture tapped too early wiggles this long
const WIGGLE_MS = 600

const today = props.today ?? new Date()
const todayIndex = weekdayOf(today)
const school = useSchoolStore()
// Her step as the visit starts: the answers are counted at it, even if it changes meanwhile
const step = school.ladders.zeit.step
// And the child who plays: if the device changes hands meanwhile, they still count for her
const player = school.who
const tasks = props.tasks ?? buildZeitSession(step, today)
const example = props.example !== undefined ? props.example : exampleFor(step, school.ladders.zeit.window.length, today)
const flow = createZeitFlow(tasks, example)
const view = reactive({ ...flow.state, wrong: [...flow.state.wrong], placed: [...flow.state.placed] })
/** What is lit while it is said */
const lit = ref<string | null>(null)
/** The picture wiggling after a tap too early */
const wiggling = ref<string | null>(null)
/** The example's pictures already in their places, and its clock */
const examplePlaced = ref<string[]>([])
const exampleClock = ref<ClockTime | null>(null)

const inExample = computed(() => view.phase === 'example' && !!example)
const showing = computed<ZeitTask | null>(() => (inExample.value && example ? example.task : view.task))
const order = computed(() => (showing.value?.type === 'order' ? showing.value : null))
const pickTask = computed(() => (showing.value?.type === 'pick' ? showing.value : null))
const placedIds = computed(() => (inExample.value ? examplePlaced.value : view.placed))
const slots = computed<(Activity | null)[]>(() => {
  const o = order.value
  if (!o) return []
  return o.items.map((_, n) => o.items.find(i => i.id === placedIds.value[n]) ?? null)
})
const loose = computed(() => order.value?.shown.filter(i => !placedIds.value.includes(i.id)) ?? [])

let closed = false
const timers = new Set<ReturnType<typeof setTimeout>>()
function later(fn: () => void, ms: number) {
  const id = setTimeout(() => {
    timers.delete(id)
    if (!closed) fn()
  }, ms)
  timers.add(id)
}
const pause = (ms: number) => new Promise<void>(resolve => later(resolve, ms))

function sync() {
  Object.assign(view, flow.state, { wrong: [...flow.state.wrong], placed: [...flow.state.placed] })
}

/** Each run is numbered: what an older one still had to say is dropped when a newer one starts (she answered) */
let current = 0

/** Carries out what the flow asks for, one after the other. Resolves true when all of it was said. */
function run(effects: ZeitEffect[]): Promise<boolean> {
  sync()
  const mine = ++current
  const live = () => !closed && mine === current
  // Whatever an older run had lit goes dark
  lit.value = null
  let chain: Promise<void> = Promise.resolve()
  for (const effect of effects) {
    if (effect.type === 'chime') {
      playBeat('chime')
      // Solved: 🔊 has nothing to ask until the next question
      forgetInstruction()
    } else if (effect.type === 'confetti') later(leave, CONFETTI_MS)
    else if (effect.type === 'wiggle') {
      wiggling.value = effect.id
      later(() => { if (wiggling.value === effect.id) wiggling.value = null }, WIGGLE_MS)
    } else if (effect.type === 'place') {
      if (flow.state.phase !== 'example') playBeat('sparkle')
      else chain = chain.then(() => { if (live()) examplePlaced.value = [...examplePlaced.value, effect.id] })
    } else if (effect.type === 'clock') chain = chain.then(() => { if (live()) exampleClock.value = effect.clock })
    else if (effect.type === 'speak') {
      chain = chain.then(async () => {
        if (!live()) return
        lit.value = effect.light ?? null
        const said = effect.ask ? instruct(effect.text) : speak(effect.text)
        if (effect.ask) instruction.value = effect.again ?? effect.text
        await said
        if (effect.light) await pause(BETWEEN_MS)
        if (live()) lit.value = null
      })
    }
  }
  return chain.then(() => live())
}

/** After what was said: the example leads to the first question, a cheer to the next */
function carryOn(effects: ZeitEffect[]) {
  sync()
  if (effects.length === 0) return
  void run(effects).then(finished => {
    if (!finished) return
    if (flow.state.phase === 'example') carryOn(flow.exampleDone())
    else if (flow.state.phase === 'cheering') later(() => carryOn(flow.next()), AFTER_CHEER_MS)
  })
}

function choose(id: string) {
  if (!closed) carryOn(flow.choose(id))
}
function tap(id: string) {
  if (!closed) carryOn(flow.tap(id))
}

/** Takes back this building's answer to the leave button */
let stopLeaveRequests = () => {}

function shutDown() {
  if (closed) return
  closed = true
  for (const id of timers) clearTimeout(id)
  timers.clear()
  window.removeEventListener('keydown', onKey)
  stopLeaveRequests()
  stopSpeaking()
}

function leave() {
  if (closed) return
  shutDown()
  school.record(flow.state.results, { zeit: step }, player)
  emit('finished', { stars: flow.state.stars })
}

function onKey(e: KeyboardEvent) {
  if (e.repeat) return
  const digit = /^(?:Digit|Numpad)([1-4])$/.exec(e.code)
  if (e.code === 'Escape') leave()
  else if (digit && pickTask.value) {
    const c = pickTask.value.choices[Number(digit[1]) - 1]
    if (c) choose(c.id)
  }
}

// 🔊 while something is being said: it stops, so the whole instruction is heard
watch(askedAgain, () => {
  if (closed || flow.state.phase !== 'asking') return
  current++
  lit.value = null
})

onMounted(() => {
  window.addEventListener('keydown', onKey)
  stopLeaveRequests = onLeaveRequest(leave)
  carryOn(flow.start())
})
onBeforeUnmount(shutDown)
</script>

<template>
  <div class="kalender" data-test="kalender" :data-phase="view.phase">
    <div class="progress" aria-hidden="true">
      <svg v-for="n in tasks.length" :key="n" viewBox="0 0 24 24" data-test="progress-star" :data-done="n <= view.solved">
        <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
      </svg>
    </div>

    <div class="board">
      <div v-if="inExample" class="badge" data-test="example" aria-hidden="true">👀</div>

      <template v-if="order">
        <div class="slots">
          <div v-for="(s, n) in slots" :key="n" class="slot" :data-test="`slot-${n}`" :data-filled="!!s">
            <span v-if="s" :data-lit="lit === `item-${s.id}`">{{ s.emoji }}</span>
          </div>
        </div>
        <div class="loose">
          <button
            v-for="i in loose" :key="i.id" class="item" :data-test="`item-${i.id}`" :data-wiggle="wiggling === i.id"
            :data-lit="lit === `item-${i.id}`" :aria-label="i.say" tabindex="-1" @pointerdown="tap(i.id)"
          >{{ i.emoji }}</button>
        </div>
      </template>

      <template v-else-if="pickTask">
        <div v-if="pickTask.topic === 'day'" class="strip" aria-hidden="true">
          <span
            v-for="(d, i) in DAYS" :key="d" class="day" :data-test="`strip-${i}`" :data-today="i === todayIndex"
            :data-lit="lit === `strip-${i}`" :style="{ background: DAY_COLOURS[i] }"
          ><span v-if="i === todayIndex" class="sun">☀️</span></span>
        </div>

        <div v-if="inExample && exampleClock" class="big-clock"><ClockFace :clock="exampleClock" /></div>

        <!-- In the example only the suns show, lit as they are named, and nothing to tap -->
        <div
          v-if="!inExample || pickTask.topic === 'time'" class="choices" :data-topic="pickTask.topic"
          :data-shown-only="inExample"
        >
          <button
            v-for="c in pickTask.choices" :key="`${view.index}-${c.id}`" class="choice" :data-test="`choice-${c.id}`"
            :data-faded="view.wrong.includes(c.id)" :data-lit="lit === `choice-${c.id}`" :aria-label="c.say"
            tabindex="-1" @pointerdown="choose(c.id)"
          >
            <SunSky v-if="c.kind === 'sun'" :time="c.time" />
            <span v-else-if="c.kind === 'day'" class="card" :style="{ background: DAY_COLOURS[c.day] }" />
            <span v-else-if="c.kind === 'season'" class="season">{{ c.emoji }}</span>
            <ClockFace v-else :clock="c.clock" />
          </button>
        </div>
      </template>
    </div>

    <Confetti v-if="view.phase === 'done'" />
  </div>
</template>

<style scoped>
.kalender {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2vh;
  padding: 2vh 4vw 4vh;
  box-sizing: border-box;
  background: #eef0fb;
}
button { border: 0; padding: 0; background: none; font: inherit; cursor: pointer; }

.progress { display: flex; gap: 14px; }
.progress svg { width: 46px; }
.progress path { fill: rgb(255 255 255 / 70%); stroke: #c6cbec; stroke-width: 1.2; stroke-linejoin: round; }
.progress svg[data-done='true'] path { fill: #ffd93d; stroke: #e0a800; }

.board {
  position: relative;
  flex: 1;
  min-height: 0;
  width: min(100%, 1000px);
  border-radius: 36px;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-evenly;
  padding: 2vh 2vw;
  box-sizing: border-box;
}
.badge { position: absolute; top: 12px; right: 18px; font-size: 36px; }
[data-lit='true'] { box-shadow: 0 0 0 7px #ffd93d; transform: scale(1.06); }

.slots { display: flex; gap: 2.5vw; }
.slot {
  width: min(18vw, 15vh, 130px);
  aspect-ratio: 1;
  border-radius: 22px;
  border: 5px dashed #c6cbec;
  display: grid;
  place-items: center;
  font-size: min(11vw, 9vh, 84px);
  box-sizing: border-box;
}
.slot[data-filled='true'] { border-style: solid; border-color: #7986cb; background: #f5f6ff; }
.slot span { border-radius: 18px; transition: all 0.15s ease; }
.loose { display: flex; gap: 3vw; min-height: min(16vh, 130px); align-items: center; }
.item {
  width: min(18vw, 15vh, 130px);
  aspect-ratio: 1;
  border-radius: 22px;
  background: #f5f6ff;
  box-shadow: 0 8px 0 #c6cbec;
  font-size: min(11vw, 9vh, 84px);
  line-height: 1;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.item[data-wiggle='true'] { animation: wiggle 0.6s ease; }
@keyframes wiggle { 20% { transform: rotate(-10deg); } 40% { transform: rotate(9deg); } 60% { transform: rotate(-6deg); } 80% { transform: rotate(3deg); } }

.strip { display: flex; gap: 1.4vw; }
.day {
  position: relative;
  width: min(9vw, 7vh, 64px);
  aspect-ratio: 3 / 4;
  border-radius: 12px;
  transition: all 0.15s ease;
}
.day[data-today='true'] { outline: 5px solid #3b3b58; outline-offset: 3px; }
.sun { position: absolute; top: -26px; left: 50%; transform: translateX(-50%); font-size: 26px; }

.big-clock { width: min(46vw, 40vh, 340px); aspect-ratio: 1; }

.choices { display: flex; gap: 3.5vw; }
.choice {
  width: min(20vw, 17vh, 150px);
  aspect-ratio: 1;
  border-radius: 24px;
  padding: 10px;
  box-sizing: border-box;
  background: #f5f6ff;
  box-shadow: 0 8px 0 #c6cbec;
  transition: all 0.15s ease;
}
.choices[data-topic='time'] .choice, .choices[data-topic='season'] .choice { width: min(19vw, 16vh, 140px); }
.choices[data-shown-only='true'] { pointer-events: none; }
.choice[data-faded='true'] { opacity: 0.3; box-shadow: none; transform: scale(0.9); }
.card { display: block; width: 70%; height: 90%; margin: 5% auto; border-radius: 14px; }
.season { font-size: min(12vw, 10vh, 90px); line-height: 1; display: grid; place-items: center; height: 100%; }
</style>
