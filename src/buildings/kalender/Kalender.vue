<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import Confetti from '@/components/Confetti.vue'
import ProgressStars from '@/components/ProgressStars.vue'
import {
  buildZeitSession, DAY_COLOURS, DAYS, exampleFor, weekdayOf, type Activity, type ClockTime, type ZeitExample,
  type ZeitTask,
} from '@/core/kalender'
import { askedAgain } from '@/services/sayAgain'
import { playBeat } from '@/services/sound'
import { forgetInstruction, instruct, instruction, speak } from '@/services/tts'
import type { BuildingResult } from '../types'
import { ladderVisit, useVisit } from '../visit'
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
// Her step, her answers at it and the child who plays, as the visit starts
const ladder = ladderVisit('zeit')
const step = ladder.step
const visit = useVisit(leave)
const { later, pause } = visit
const tasks = props.tasks ?? buildZeitSession(step, today)
const example = props.example !== undefined ? props.example : exampleFor(step, ladder.windowLength, today)
const flow = createZeitFlow(tasks, example)
const view = reactive({ ...flow.state, wrong: [...flow.state.wrong], placed: [...flow.state.placed] })
/** What is lit while it is said: one or more keys, apart by spaces ('choice-day-4 strip-4') */
const lit = ref<string | null>(null)
const isLit = (key: string) => lit.value?.split(' ').includes(key) ?? false
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

function sync() {
  Object.assign(view, flow.state, { wrong: [...flow.state.wrong], placed: [...flow.state.placed] })
}


/** Carries out what the flow asks for, one after the other. Resolves true when all of it was said. */
function run(effects: ZeitEffect[]): Promise<boolean> {
  sync()
  // Each run is numbered: what an older one still had to say is dropped when a newer one starts
  const live = visit.newRun()
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
      // 🔊's text is this run's question from the start, even while something before it is said: a tap on a day may
      // cut the run short, and 🔊 must not keep the question as it was before (with a card now faded)
      if (effect.ask && flow.state.phase === 'asking') instruction.value = effect.again ?? effect.text
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
  if (!visit.isClosed()) carryOn(flow.choose(id))
}
function tap(id: string) {
  if (!visit.isClosed()) carryOn(flow.tap(id))
}

/** What closing the visit must undo besides its timers and voice */
function cleanUp() {
  window.removeEventListener('keydown', onKey)
}
visit.onShutDown(cleanUp)

function leave() {
  if (visit.isClosed()) return
  visit.shutDown()
  ladder.record(flow.state.results)
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

/**
 * A tap on a day of the week while she is asked says its name, the day lit. Only the name: what is next to it is hers to
 * find. Whatever was still being said stops.
 */
function sayDay(i: number) {
  if (visit.isClosed() || view.phase !== 'asking') return
  const live = visit.newRun()
  lit.value = `strip-${i}`
  void speak(DAYS[i]).then(() => {
    if (live()) lit.value = null
  })
}

// 🔊 while something is being said: it stops, so the whole instruction is heard
watch(askedAgain, () => {
  if (visit.isClosed() || flow.state.phase !== 'asking') return
  visit.dropRuns()
  lit.value = null
})

onMounted(() => {
  window.addEventListener('keydown', onKey)
  carryOn(flow.start())
})
</script>

<template>
  <div class="kalender" data-test="kalender" :data-phase="view.phase">
    <ProgressStars :total="tasks.length" :solved="view.solved" :big="view.phase === 'done'" edge="#c6cbec" />

    <div class="board">
      <div v-if="inExample" class="badge" data-test="example" aria-hidden="true">👀</div>

      <template v-if="order">
        <div class="slots">
          <div v-for="(s, n) in slots" :key="n" class="slot" :data-test="`slot-${n}`" :data-filled="!!s">
            <span v-if="s" :data-lit="isLit(`item-${s.id}`)">{{ s.emoji }}<span v-if="s.badge" class="badge-small">{{ s.badge }}</span></span>
          </div>
        </div>
        <div class="loose" :data-shown-only="inExample">
          <button
            v-for="i in loose" :key="i.id" class="item" :data-test="`item-${i.id}`" :data-wiggle="wiggling === i.id"
            :data-lit="isLit(`item-${i.id}`)" :aria-label="i.say" tabindex="-1" @pointerdown="tap(i.id)"
          >{{ i.emoji }}<span v-if="i.badge" class="badge-small">{{ i.badge }}</span></button>
        </div>
      </template>

      <template v-else-if="pickTask">
        <div v-if="pickTask.topic === 'day'" class="strip" aria-hidden="true">
          <span
            v-for="(d, i) in DAYS" :key="d" class="day" :data-test="`strip-${i}`"
            :data-today="!!pickTask.aboutToday && i === todayIndex" :data-lit="isLit(`strip-${i}`)"
            :style="{ background: DAY_COLOURS[i] }" @pointerdown="sayDay(i)"
          ><span v-if="pickTask.aboutToday && i === todayIndex" class="sun">☀️</span></span>
        </div>

        <div v-if="inExample && exampleClock" class="big-clock"><ClockFace :clock="exampleClock" /></div>

        <!-- In the example only the suns show, lit as they are named, and nothing to tap -->
        <div
          v-if="!inExample || pickTask.topic === 'time'" class="choices" :data-topic="pickTask.topic"
          :data-shown-only="inExample"
        >
          <button
            v-for="c in pickTask.choices" :key="`${view.index}-${c.id}`" class="choice" :data-test="`choice-${c.id}`"
            :data-faded="view.wrong.includes(c.id)" :data-lit="isLit(`choice-${c.id}`)" :aria-label="c.say"
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
.item { position: relative; }
.badge-small { position: absolute; right: 6%; top: 4%; font-size: 0.42em; }
.slot span { position: relative; }
.loose[data-shown-only='true'], .choices[data-shown-only='true'] { pointer-events: none; }
.loose[data-shown-only='true'] .item, .choices[data-shown-only='true'] .choice { box-shadow: none; opacity: 0.85; }
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
