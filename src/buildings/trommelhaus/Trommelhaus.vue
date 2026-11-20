<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import Confetti from '@/components/Confetti.vue'
import {
  beatTimes, buildRhythmSession, exampleFor, findOnsets, LEAD_IN, type Hit, type Mode, type RhythmTask,
} from '@/core/rhythm'
import { hasMicrophone, openMicrophone, type Level, type Microphone } from '@/services/microphone'
import { playBeat, unlockAudio } from '@/services/sound'
import { forgetInstruction, instruct, instruction, speak, stopSpeaking } from '@/services/tts'
import { useSchoolStore } from '@/stores/school'
import { onLeaveRequest } from '../leave'
import type { BuildingResult } from '../types'
import { createRhythmFlow, type RhythmEffect } from './flow'

// The Trommelhaus: rhythm. She taps the drums or claps (the microphone hears it), chosen at the door; the beat is
// always seen too. On the Rhythmus ladder (Lehrplan 21 MU, Zugänge 1 and 2). The house never listens while it plays.
const props = defineProps<{
  /** The tasks of this visit; made up at her Rhythmus step when not given */
  tasks?: RhythmTask[]
  /** Show a task once first; from her step and answers when not given */
  example?: boolean
  /** The microphone (tests give a fake) */
  openMic?: () => Promise<Microphone | null>
  /** Whether to offer clapping */
  micAvailable?: boolean
}>()
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

const AFTER_CHEER_MS = 500
const CONFETTI_MS = 3000
/** After the house's last sound, before listening: the drum has died away */
const QUIET_MS = 350
/** She has this long to start */
const START_MS = 6000
/** After her last beat, the answer is over */
const DONE_AFTER_MS = 1800
const PULSE_MS = 140
/** The room's noise is measured in the first readings, but never taken as louder than this (she may clap at once) */
const FLOOR_READINGS = 5
const FLOOR_AT_MOST = 0.02
/** Readings that never rise above this, or never change, come from a microphone that hears nothing */
const DEAD_LEVEL = 0.002

const school = useSchoolStore()
const step = school.ladders.rhythmus.step
const player = school.who
const tasks = props.tasks ?? buildRhythmSession(step)
const showFirst = props.example ?? exampleFor(step, school.ladders.rhythmus.window.length)
const flow = createRhythmFlow(tasks, showFirst)
const view = reactive({ ...flow.state })
const canClap = props.micAvailable ?? hasMicrophone()
/** The light pulses on every beat, the house's and hers */
const pulse = ref(0)
const pulsing = ref(false)
/** Whether her taps count right now */
const listening = ref(false)
const confetti = ref(false)

const dynamicsTask = computed(() => view.task?.type === 'dynamics')

let mic: Microphone | null = null
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
/** One clock for the house's beats, her taps and the microphone's readings */
const now = () => performance.now()

function sync() {
  Object.assign(view, flow.state)
}

function beatSeen() {
  pulse.value += 1
  pulsing.value = true
  later(() => { pulsing.value = false }, PULSE_MS)
}

/** Plays beats at their times (ms from now); `sound` false: only the light and the figure */
function playBeats(times: number[], loud: (i: number) => boolean, sound: (i: number) => boolean): Promise<void> {
  times.forEach((at, i) => later(() => {
    if (sound(i)) playBeat(loud(i) ? 'drum' : 'softDrum')
    beatSeen()
  }, at))
  return pause((times[times.length - 1] ?? 0) + QUIET_MS)
}

const loudness = (task: RhythmTask) => (i: number) => task.type !== 'dynamics' || task.order[i] === 'laut'

/** The house shows a task once */
function show(task: RhythmTask): Promise<void> {
  const times = beatTimes(task)
  return playBeats(times, loudness(task), () => true)
}

// ---- Her turn ----

let t0 = 0
let hits: Hit[] = []
let levels: Level[] = []
let stopLevels = () => {}
let endTimer: ReturnType<typeof setTimeout> | null = null
let finishTurn: (() => void) | null = null

function onDrum(big: boolean) {
  if (!listening.value || view.mode !== 'tap') return
  playBeat(big ? 'drum' : 'softDrum')
  beatSeen()
  hits.push({ t: now() - t0, big })
  waitForMore()
}

/** After a beat of hers, the answer ends when she stops (keeping a beat ends with the house's beats) */
function waitForMore() {
  if (view.task?.type === 'keep') return
  if (endTimer) clearTimeout(endTimer)
  endTimer = setTimeout(() => finishTurn?.(), DONE_AFTER_MS)
}

/** Her turn: the house plays (keeping a beat: two beats, then it goes on, silent when she claps), then she answers */
async function turn(task: RhythmTask, mode: Mode, live: () => boolean) {
  const times = beatTimes(task)
  hits = []
  levels = []
  let judgedFrom = 0
  let endsAt = 0
  if (task.type === 'keep') {
    const beat = times[1] - times[0]
    const start = now()
    // The two to listen to sound; the rest only sound when she taps (the microphone must not hear them)
    void playBeats(times, () => true, i => i < LEAD_IN || mode === 'tap')
    await pause(times[LEAD_IN - 1] + QUIET_MS)
    if (!live()) return
    judgedFrom = start + times[LEAD_IN]
    endsAt = start + times[times.length - 1] + beat
  } else {
    await playBeats(times, loudness(task), () => true)
    if (!live()) return
  }
  t0 = task.type === 'keep' ? judgedFrom : now()
  listening.value = true
  if (mode === 'clap' && mic) {
    // 🔊 would be heard as claps: it hides while the microphone listens
    forgetInstruction()
    stopLevels = mic.listen(l => { levels.push(l) })
  }
  const answer = await new Promise<'answered' | 'silent'>(resolve => {
    finishTurn = () => resolve(hits.length > 0 || levels.length > 0 ? 'answered' : 'silent')
    if (task.type === 'keep') later(() => finishTurn?.(), Math.max(0, endsAt - now()))
    else later(() => { if (hits.length === 0 && claps().length === 0) resolve('silent') }, START_MS)
    if (mode === 'clap') watchClaps(task)
  })
  stopLevels()
  stopLevels = () => {}
  listening.value = false
  finishTurn = null
  if (endTimer) clearTimeout(endTimer)
  endTimer = null
  if (!live()) return
  const heard = mode === 'clap' ? claps() : hits
  if (mode === 'clap' && heard.length === 0 && micIsDead()) {
    closeMic()
    carryOn(flow.micDead())
    return
  }
  carryOn(answer === 'silent' || heard.length === 0 ? flow.silent() : flow.answered(heard))
}

/** Nothing at all came in, not even the room: the microphone isn't working */
function micIsDead(): boolean {
  if (levels.length === 0) return true
  const all = levels.map(l => l.level)
  return Math.max(...all) < DEAD_LEVEL || Math.max(...all) - Math.min(...all) < 1e-6
}

function closeMic() {
  stopLevels()
  stopLevels = () => {}
  mic?.close()
  mic = null
}

/** Her claps so far, timed from the start of her answer */
function claps(): Hit[] {
  if (levels.length === 0) return []
  const floor = Math.min(FLOOR_AT_MOST, ...levels.slice(0, FLOOR_READINGS).map(l => l.level))
  return findOnsets(levels, floor).map(h => ({ ...h, t: h.t - t0 }))
}

/** While clapping: each new clap pulses the light, and the answer ends when she stops */
function watchClaps(task: RhythmTask) {
  let seen = 0
  const look = () => {
    if (!listening.value || closed) return
    const found = claps()
    if (found.length > seen) {
      seen = found.length
      beatSeen()
      if (task.type !== 'keep') waitForMore()
    }
    later(look, 50)
  }
  look()
}

// ---- The flow's effects ----

let current = 0

function run(effects: RhythmEffect[]): Promise<boolean> {
  sync()
  const mine = ++current
  const live = () => !closed && mine === current
  let chain: Promise<void> = Promise.resolve()
  for (const effect of effects) {
    if (effect.type === 'chime') {
      playBeat('chime')
      forgetInstruction()
    } else if (effect.type === 'confetti') {
      confetti.value = true
      later(leave, CONFETTI_MS)
    } else if (effect.type === 'speak') {
      chain = chain.then(async () => {
        if (!live()) return
        const said = effect.ask ? instruct(effect.text) : speak(effect.text)
        if (effect.ask) instruction.value = effect.text
        await said
      })
    } else if (effect.type === 'show') {
      chain = chain.then(() => (live() ? show(effect.task) : undefined))
    } else if (effect.type === 'turn') {
      // Her turn ends the run; what follows comes from her answer
      chain = chain.then(() => { if (live()) void turn(effect.task, effect.mode, live) })
    }
  }
  // Solved, or shown after three tries: 🔊 has nothing to ask until the next task
  if (flow.state.phase === 'cheering') forgetInstruction()
  return chain.then(() => live() && !effects.some(e => e.type === 'turn'))
}

function carryOn(effects: RhythmEffect[]) {
  sync()
  if (effects.length === 0) return
  void run(effects).then(finished => {
    if (!finished) return
    if (flow.state.phase === 'example') carryOn(flow.exampleDone())
    else if (flow.state.phase === 'cheering') later(() => carryOn(flow.next()), AFTER_CHEER_MS)
  })
}

/** While the microphone is being asked for, further taps on the door's buttons do nothing */
let opening = false

async function choose(mode: Mode) {
  if (closed || opening || view.phase !== 'choosing') return
  unlockAudio()
  if (mode === 'tap') {
    carryOn(flow.choose('tap'))
    return
  }
  // The tap on 👏 is the gesture the iPad wants before it asks for the microphone
  opening = true
  mic = await (props.openMic ?? openMicrophone)()
  opening = false
  if (closed) {
    mic?.close()
    return
  }
  carryOn(mic ? flow.choose('clap') : flow.micFailed())
}

// ---- Leaving ----

let stopLeaveRequests = () => {}

function shutDown() {
  if (closed) return
  closed = true
  for (const id of timers) clearTimeout(id)
  timers.clear()
  if (endTimer) clearTimeout(endTimer)
  closeMic()
  stopLeaveRequests()
  stopSpeaking()
}

function leave() {
  if (closed) return
  shutDown()
  school.record(flow.state.results, { rhythmus: step }, player)
  emit('finished', { stars: flow.state.stars })
}

// 🔊 just says the instruction again (SayAgain.vue): nothing here stops for it, so a visit can't stall on it; while
// the microphone listens there is no instruction to say (see turn)

onMounted(() => {
  stopLeaveRequests = onLeaveRequest(leave)
  if (canClap) carryOn(flow.start())
  else carryOn(flow.choose('tap'))
})
onBeforeUnmount(shutDown)
</script>

<template>
  <div class="trommelhaus" data-test="trommelhaus" :data-phase="view.phase" :data-mode="view.mode">
    <div class="progress" aria-hidden="true">
      <svg v-for="n in tasks.length" :key="n" viewBox="0 0 24 24" data-test="progress-star" :data-done="n <= view.solved">
        <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
      </svg>
    </div>

    <div class="board">
      <template v-if="view.phase === 'choosing'">
        <div class="choose">
          <button class="pick" data-test="choose-tap" aria-label="Tippen" @pointerdown="choose('tap')">👆<span>Tippen</span></button>
          <button class="pick" data-test="choose-clap" aria-label="Klatschen" @pointerdown="choose('clap')">👏<span>Klatschen</span></button>
        </div>
      </template>

      <template v-else>
        <div class="stage">
          <div class="light" data-test="beat-light" :data-on="pulsing" />
          <div class="figure" :data-on="pulsing" aria-hidden="true">🐻</div>
        </div>
        <div v-if="view.mode === 'tap'" class="drums" :data-listening="listening">
          <button v-if="dynamicsTask" class="drum small" data-test="drum-small" aria-label="Kleine Trommel, leise" @pointerdown="onDrum(false)">🥁</button>
          <button class="drum" data-test="drum-big" aria-label="Große Trommel, laut" @pointerdown="onDrum(true)">🥁</button>
        </div>
        <div v-else class="ear" data-test="listening" :data-listening="listening" aria-hidden="true">👏</div>
      </template>
    </div>

    <Confetti v-if="confetti" />
  </div>
</template>

<style scoped>
.trommelhaus {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2vh;
  padding: 2vh 4vw 4vh;
  box-sizing: border-box;
  background: #fde9e4;
}
button { border: 0; padding: 0; background: none; font: inherit; cursor: pointer; }
.progress { display: flex; gap: 14px; }
.progress svg { width: 46px; }
.progress path { fill: rgb(255 255 255 / 70%); stroke: #f0c4b8; stroke-width: 1.2; stroke-linejoin: round; }
.progress svg[data-done='true'] path { fill: #ffd93d; stroke: #e0a800; }

.board {
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
.choose { display: flex; gap: 6vw; }
.pick {
  width: min(32vw, 30vh, 240px);
  aspect-ratio: 1;
  border-radius: 36px;
  background: #fff4f1;
  box-shadow: 0 10px 0 #f0c4b8;
  font-size: min(14vw, 12vh, 110px);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.pick span { font-size: min(4vw, 3.4vh, 28px); font-weight: 700; color: #8a4b3b; }

.stage { display: flex; align-items: center; gap: 5vw; }
.light {
  width: min(18vw, 16vh, 140px);
  aspect-ratio: 1;
  border-radius: 50%;
  background: #ffe0b2;
  transition: transform 0.08s ease, background 0.08s ease;
}
.light[data-on='true'] { background: #ffb300; transform: scale(1.18); box-shadow: 0 0 30px #ffca28; }
.figure { font-size: min(16vw, 14vh, 120px); transition: transform 0.08s ease; }
.figure[data-on='true'] { transform: translateY(-14%); }

.drums { display: flex; align-items: flex-end; gap: 6vw; }
.drums[data-listening='false'] { opacity: 0.55; }
.drum {
  font-size: min(24vw, 22vh, 190px);
  line-height: 1;
  border-radius: 50%;
  padding: 0.08em;
  background: #fff4f1;
  box-shadow: 0 10px 0 #f0c4b8;
}
.drum.small { font-size: min(14vw, 13vh, 110px); }
.drum:active { transform: translateY(6px); box-shadow: 0 4px 0 #f0c4b8; }
.ear { font-size: min(20vw, 18vh, 150px); opacity: 0.4; transition: opacity 0.2s ease; }
.ear[data-listening='true'] { opacity: 1; }
</style>
