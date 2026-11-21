<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import Confetti from '@/components/Confetti.vue'
import ProgressStars from '@/components/ProgressStars.vue'
import { buildRhymeSession, exampleFor, sayAsHeard, WORDS, type Example, type RhymeTask } from '@/core/rhymes'
import { playBeat } from '@/services/sound'
import { askedAgain } from '@/services/sayAgain'
import { forgetInstruction, instruct, instruction, speak } from '@/services/tts'
import type { BuildingResult } from '../types'
import { ladderVisit, useVisit } from '../visit'
import { createRhymeFlow, type RhymeEffect } from './flow'

// The Reimhaus: hearing words. Rhymes, first sounds and syllables on the Reimen ladder (Lehrplan 21 D.1.A.1); all of
// it spoken, every word a picture, nothing to read.
const props = defineProps<{
  /** The tasks of this visit; made up at her Reimen step when not given */
  tasks?: RhymeTask[]
  /** The example before the first task; from her step and answers when not given (null: none) */
  example?: Example | null
}>()
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

// The pause after the cheer, before the next question
const AFTER_CHEER_MS = 500
// Between two named pictures
const BETWEEN_MS = 250
// The drum lights this long per syllable, and is dark this long between two
const DRUM_ON_MS = 320
const DRUM_OFF_MS = 230
/** More dots than this would push the row out of the board; she has drummed far too often anyway */
const MAX_DOTS = 10
const CONFETTI_MS = 3000

// Her step, her answers at it and the child who plays, as the visit starts
const ladder = ladderVisit('reimen')
const visit = useVisit(leave)
const { later, pause } = visit
const tasks = props.tasks ?? buildRhymeSession(ladder.step)
const example = props.example !== undefined ? props.example : exampleFor(ladder.step, ladder.windowLength)
const flow = createRhymeFlow(tasks, example)
const view = reactive({ ...flow.state, wrong: [...flow.state.wrong] })
/** The picture being named, by word id */
const lit = ref<string | null>(null)
/** The drum lights while a syllable is said */
const drumLit = ref(false)

const task = computed(() => view.task)
const sayOf = (id: string) => WORDS.find(w => w.id === id)?.say ?? id

function sync() {
  Object.assign(view, flow.state, { wrong: [...flow.state.wrong] })
}

/** The question being asked, for the 🔊 text after a wrong picture */
let question = ''
const sayAgainText = (text: string, ids: string[]) => `${text} ${sayOf(ids[0])}. ${ids.slice(1).map(sayOf).join(', ')}.`

/** Carries out what the flow asks for, one after the other. Resolves when all of it has been said, or was dropped. */
function run(effects: RhymeEffect[]): Promise<boolean> {
  sync()
  // Each run is numbered: what an older one still had to say is dropped when a newer one starts (she answered)
  const live = visit.newRun()
  // Whatever an older run had lit goes dark: only what this one names lights up
  lit.value = null
  drumLit.value = false
  let chain: Promise<void> = Promise.resolve()
  // The 🔊 button says the question and the pictures' names again (the example: just itself)
  const named = effects.find(e => e.type === 'name')
  const asking = flow.state.phase === 'asking'
  // A task over without a chime (a count given up on after three tries): 🔊 has nothing to ask either
  if (flow.state.phase === 'cheering') forgetInstruction()
  for (const effect of effects) {
    if (effect.type === 'chime') {
      playBeat('chime')
      // Solved: 🔊 has nothing to ask until the next question
      forgetInstruction()
    }
    else if (effect.type === 'beat') playBeat('drum')
    else if (effect.type === 'confetti') later(leave, CONFETTI_MS)
    else if (effect.type === 'speak') {
      chain = chain.then(() => {
        if (!live()) return
        if (!effect.ask) return speak(effect.text)
        const said = instruct(effect.text)
        if (asking) question = effect.text
        if (asking && named?.type === 'name') instruction.value = sayAgainText(effect.text, named.ids)
        return said
      })
    } else if (effect.type === 'name') {
      // After a wrong picture: 🔊 names only those still there
      if (asking && question && !effects.some(e => e.type === 'speak' && e.ask)) {
        instruction.value = sayAgainText(question, effect.ids)
      }
      chain = chain.then(async () => {
        for (const id of effect.ids) {
          if (!live()) return
          lit.value = id
          await speak(sayOf(id))
          await pause(BETWEEN_MS)
        }
        if (live()) lit.value = null
      })
    } else if (effect.type === 'drum') {
      // Said in one go ("Au – to"): a syllable alone may be spelled out by the voice. The drum lights along.
      chain = chain.then(async () => {
        if (!live()) return
        const said = speak(sayAsHeard(effect.syllables))
        for (let k = 0; k < effect.syllables.length; k++) {
          if (!live()) return
          drumLit.value = true
          playBeat('drum')
          await pause(DRUM_ON_MS)
          drumLit.value = false
          await pause(DRUM_OFF_MS)
        }
        await said
      })
    }
  }
  return chain.then(() => live())
}

/** After what was said: the example leads to the first question, a cheer to the next, a replay back to the drum */
function carryOn(effects: RhymeEffect[]) {
  sync()
  if (effects.length === 0) return
  void run(effects).then(finished => {
    if (!finished) return
    if (flow.state.phase === 'example') carryOn(flow.exampleDone())
    else if (flow.state.phase === 'replaying') carryOn(flow.replayDone())
    else if (flow.state.phase === 'cheering') later(() => carryOn(flow.next()), AFTER_CHEER_MS)
  })
}

function pick(id: string) {
  if (!visit.isClosed()) carryOn(flow.pick(id))
}
function tap() {
  if (visit.isClosed()) return
  // A beat doesn't stop what is being said
  const effects = flow.tap()
  if (effects.length) playBeat('drum')
  sync()
}
function clear() {
  if (visit.isClosed()) return
  flow.clear()
  sync()
}
function done() {
  if (!visit.isClosed()) carryOn(flow.done())
}

function leave() {
  if (visit.isClosed()) return
  visit.shutDown()
  ladder.record(flow.state.results)
  emit('finished', { stars: flow.state.stars })
}

function onKey(e: KeyboardEvent) {
  if (e.repeat) return
  const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code)
  const t = task.value
  if (e.code === 'Escape') leave()
  else if (digit && t && t.type !== 'syllables') {
    const c = t.choices[Number(digit[1]) - 1]
    if (c) pick(c.id)
  } else if (e.code === 'Space') tap()
  else if (e.code === 'Enter' || e.code === 'NumpadEnter') done()
  else if (e.code === 'Backspace') clear()
}

// 🔊 while the pictures are being named: the naming stops, so the whole instruction is heard
watch(askedAgain, () => {
  if (visit.isClosed() || flow.state.phase !== 'asking') return
  visit.dropRuns()
  lit.value = null
  drumLit.value = false
})

onMounted(() => {
  window.addEventListener('keydown', onKey)
  visit.onShutDown(() => window.removeEventListener('keydown', onKey))
  carryOn(flow.start())
})
</script>

<template>
  <div class="reimhaus" data-test="reimhaus" :data-phase="view.phase">
    <ProgressStars :total="tasks.length" :solved="view.solved" edge="#ecd2b4" />

    <div class="board">
      <template v-if="view.phase === 'example' && example">
        <div class="row">
          <span
            v-for="w in example.words" :key="w.id" class="picture big" data-test="example-word" :data-lit="lit === w.id"
          >{{ w.emoji }}</span>
        </div>
        <div v-if="example.beats" class="drum" data-test="drum-example" :data-lit="drumLit" aria-hidden="true">🥁</div>
      </template>

      <template v-else-if="task">
        <span class="picture big" data-test="word" :data-lit="lit === task.word.id">{{ task.word.emoji }}</span>

        <div v-if="task.type !== 'syllables'" class="row choices">
          <button
            v-for="c in task.choices" :key="`${view.index}-${c.id}`" class="picture choice" :data-test="`pick-${c.id}`"
            :data-faded="view.wrong.includes(c.id)" :data-lit="lit === c.id" :aria-label="c.say"
            tabindex="-1" @pointerdown="pick(c.id)"
          >{{ c.emoji }}</button>
        </div>

        <template v-else>
          <div class="beats" aria-hidden="true">
            <span v-for="n in Math.min(view.beats, MAX_DOTS)" :key="n" class="beat" data-test="beat" />
          </div>
          <div class="row drumrow">
            <button
              v-if="view.beats > 0" class="small" data-test="clear" aria-label="Nochmal von vorn" tabindex="-1"
              @pointerdown="clear"
            >↺</button>
            <button class="drum" data-test="drum" :data-lit="drumLit" aria-label="Trommel" tabindex="-1" @pointerdown="tap">
              🥁
            </button>
            <button v-if="view.beats > 0" class="small ok" data-test="done" aria-label="Fertig" tabindex="-1" @pointerdown="done">
              ✓
            </button>
          </div>
        </template>
      </template>
    </div>

    <Confetti v-if="view.phase === 'done'" />
  </div>
</template>

<style scoped>
.reimhaus {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2vh;
  padding: 2vh 4vw 4vh;
  box-sizing: border-box;
  background: #fbeedd;
}
button { border: 0; padding: 0; background: none; font: inherit; cursor: pointer; }


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
.row { display: flex; gap: 4vw; align-items: center; justify-content: center; }

.picture {
  line-height: 1;
  border-radius: 28px;
  transition: transform 0.15s ease, box-shadow 0.15s ease, opacity 0.2s ease;
}
.picture.big { font-size: clamp(64px, 17vh, 150px); padding: 0.1em 0.2em; }
.picture.choice {
  font-size: clamp(56px, 13vh, 120px);
  width: 1.5em;
  height: 1.4em;
  background: #fff7ee;
  box-shadow: 0 8px 0 #ecd2b4;
}
.picture[data-lit='true'] { box-shadow: 0 0 0 8px #ffd93d; transform: scale(1.08); }
.picture.choice[data-faded='true'] { opacity: 0.3; box-shadow: none; transform: scale(0.9); }

.beats { display: flex; flex-wrap: wrap; justify-content: center; gap: 14px; min-height: 32px; max-width: 100%; }
.beat { width: 28px; height: 28px; border-radius: 50%; background: #e2702c; }

.drumrow { gap: 5vw; }
.drum {
  font-size: clamp(72px, 18vh, 160px);
  line-height: 1;
  border-radius: 50%;
  padding: 0.12em;
  background: #fff1dc;
  box-shadow: 0 10px 0 #ecd2b4;
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}
.drum:active { transform: translateY(6px); box-shadow: 0 4px 0 #ecd2b4; }
.drum[data-lit='true'] { box-shadow: 0 0 0 10px #ffd93d; transform: scale(1.06); }
.small {
  width: clamp(64px, 11vh, 96px);
  height: clamp(64px, 11vh, 96px);
  border-radius: 50%;
  background: #fff7ee;
  box-shadow: 0 6px 0 #ecd2b4;
  font-size: clamp(32px, 6vh, 52px);
  font-weight: 800;
  color: #8a5a2b;
}
.small.ok { background: #d9f5d0; color: #2e7d32; box-shadow: 0 6px 0 #a5d69a; }
</style>
