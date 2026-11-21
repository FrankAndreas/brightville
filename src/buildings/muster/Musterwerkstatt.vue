<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import Confetti from '@/components/Confetti.vue'
import ProgressStars from '@/components/ProgressStars.vue'
import { buildMusterSession, exampleFor, type MusterExample, type MusterTask, type SortThing } from '@/core/patterns'
import { askedAgain } from '@/services/sayAgain'
import { playBeat } from '@/services/sound'
import { forgetInstruction, instruct, instruction, speak } from '@/services/tts'
import type { BuildingResult } from '../types'
import { ladderVisit, useVisit } from '../visit'
import { createMusterFlow, type MusterEffect } from './flow'
import PieceView from './PieceView.vue'

// The Musterwerkstatt: seeing rules in things. Rows to continue and things to sort on the Muster ladder (Lehrplan 21
// MA.1.B, MA.3); all of it said aloud, nothing to read.
const props = defineProps<{
  /** The tasks of this visit; made up at her Muster step when not given */
  tasks?: MusterTask[]
  /** The example before the first task; from her step and answers when not given (null: none) */
  example?: MusterExample | null
}>()
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

// The pause after the cheer, before the next question
const AFTER_CHEER_MS = 500
// After each lit line, before the next
const BETWEEN_MS = 200
const CONFETTI_MS = 3000
// A thing from the wrong basket hops this long on its way back
const HOP_MS = 600

// Her step, her answers at it and the child who plays, as the visit starts
const ladder = ladderVisit('muster')
const step = ladder.step
const visit = useVisit(leave)
const { later, pause } = visit
const tasks = props.tasks ?? buildMusterSession(step)
const example = props.example !== undefined ? props.example : exampleFor(step, ladder.windowLength)
const flow = createMusterFlow(tasks, example)
const view = reactive({ ...flow.state, wrong: [...flow.state.wrong], placed: { ...flow.state.placed } })
/** What is lit while it is said: 'piece-<i>', 'gap', 'basket-<n>', 'thing-<id>' */
const lit = ref<string | null>(null)
/** The example's gap shows its answer */
const filled = ref(false)
/** The thing hopping back from the wrong basket */
const hopping = ref<string | null>(null)

const showing = computed<MusterTask | null>(() => (view.phase === 'example' && example ? example.task : view.task))
const row = computed(() => (showing.value?.type === 'row' ? showing.value : null))
const sortTask = computed(() => (showing.value?.type === 'sort' ? showing.value : null))
const gapFilled = computed(() => filled.value || (view.phase === 'cheering' && !!row.value))
/** In each basket: its example, then what she put in */
const inBasket = (b: 0 | 1): SortThing[] => {
  const s = sortTask.value
  if (!s) return []
  return [s.examples[b], ...s.things.filter(t => view.placed[t.id] === b)]
}
const loose = computed(() => sortTask.value?.things.filter(t => !(t.id in view.placed)) ?? [])

function sync() {
  Object.assign(view, flow.state, { wrong: [...flow.state.wrong], placed: { ...flow.state.placed } })
}


/** Carries out what the flow asks for, one after the other. Resolves true when all of it was said. */
function run(effects: MusterEffect[]): Promise<boolean> {
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
    }
    else if (effect.type === 'drop') playBeat('sparkle')
    else if (effect.type === 'confetti') later(leave, CONFETTI_MS)
    else if (effect.type === 'fill') chain = chain.then(() => { if (live()) filled.value = true })
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
function carryOn(effects: MusterEffect[]) {
  sync()
  if (effects.length === 0) return
  void run(effects).then(finished => {
    if (!finished) return
    if (flow.state.phase === 'example') {
      filled.value = false
      carryOn(flow.exampleDone())
    } else if (flow.state.phase === 'cheering') later(() => carryOn(flow.next()), AFTER_CHEER_MS)
  })
}

function choose(i: number) {
  if (!visit.isClosed()) carryOn(flow.choose(i))
}
function lift(id: string) {
  if (!visit.isClosed()) carryOn(flow.lift(id))
}
function drop(b: 0 | 1) {
  if (visit.isClosed()) return
  const id = flow.state.lifted
  const effects = flow.drop(b)
  if (id && effects.some(e => e.type === 'back')) {
    hopping.value = id
    later(() => { if (hopping.value === id) hopping.value = null }, HOP_MS)
  }
  carryOn(effects)
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
  const digit = /^(?:Digit|Numpad)([1-3])$/.exec(e.code)
  if (e.code === 'Escape') leave()
  else if (digit) choose(Number(digit[1]) - 1)
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
  <div class="muster" data-test="muster" :data-phase="view.phase">
    <ProgressStars :total="tasks.length" :solved="view.solved" :big="view.phase === 'done'" edge="#b8dcc3" />

    <div class="board">
      <div v-if="view.phase === 'example'" class="badge" data-test="example" aria-hidden="true">👀</div>

      <template v-if="row">
        <div class="row" :style="{ '--count': row.pieces.length }">
          <template v-for="(p, i) in row.pieces" :key="i">
            <div
              v-if="i === row.gap" class="slot gap" data-test="gap" :data-filled="gapFilled" :data-lit="lit === 'gap'"
            >
              <PieceView v-if="gapFilled" :piece="p" />
            </div>
            <div v-else class="slot" :data-test="`piece-${i}`" :data-lit="lit === `piece-${i}`">
              <PieceView :piece="p" />
            </div>
          </template>
        </div>
        <div v-if="view.phase !== 'example'" class="choices">
          <button
            v-for="(p, i) in row.choices" :key="`${view.index}-${i}`" class="choice" :data-test="`choice-${i}`"
            :data-faded="view.wrong.includes(i)" tabindex="-1" @pointerdown="choose(i)"
          >
            <PieceView :piece="p" />
          </button>
        </div>
      </template>

      <template v-else-if="sortTask">
        <div class="baskets">
          <button
            v-for="b in ([0, 1] as const)" :key="b" class="basket" :data-test="`basket-${b}`"
            :data-lit="lit === `basket-${b}`" :aria-label="`Korb: ${sortTask.baskets[b]}`" tabindex="-1" @pointerdown="drop(b)"
          >
            <span v-for="t in inBasket(b)" :key="t.id" class="thing in" :data-big="t.big !== false">
              <PieceView v-if="t.piece" :piece="t.piece" />
              <template v-else>{{ t.emoji }}</template>
            </span>
          </button>
        </div>
        <div v-if="view.phase !== 'example'" class="loose">
          <button
            v-for="t in loose" :key="t.id" class="thing" :data-test="`thing-${t.id}`" :data-big="t.big !== false"
            :data-lifted="view.lifted === t.id" :data-lit="lit === `thing-${t.id}`" :data-back="hopping === t.id"
            :aria-label="t.say"
            tabindex="-1" @pointerdown="lift(t.id)"
          >
            <PieceView v-if="t.piece" :piece="t.piece" />
            <template v-else>{{ t.emoji }}</template>
          </button>
        </div>
      </template>
    </div>

    <Confetti v-if="view.phase === 'done'" />
  </div>
</template>

<style scoped>
.muster {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2vh;
  padding: 2vh 4vw 4vh;
  box-sizing: border-box;
  background: #e6f4ea;
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

.row {
  display: grid;
  grid-template-columns: repeat(var(--count), 1fr);
  gap: 1.2vw;
  width: 100%;
  max-width: calc(var(--count) * 120px);
}
.slot {
  aspect-ratio: 1;
  border-radius: 18px;
  padding: 6%;
  box-sizing: border-box;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.slot[data-lit='true'] { box-shadow: 0 0 0 6px #ffd93d; transform: scale(1.08); }
.gap { border: 5px dashed #9cc7a9; }
.gap[data-filled='true'] { border-style: solid; border-color: #43a047; }

.choices { display: flex; gap: 5vw; }
.choice {
  width: min(18vw, 15vh, 130px);
  aspect-ratio: 1;
  border-radius: 24px;
  padding: 14px;
  box-sizing: border-box;
  background: #f4fbf6;
  box-shadow: 0 8px 0 #b8dcc3;
  transition: all 0.15s ease;
}
.choice[data-faded='true'] { opacity: 0.3; box-shadow: none; transform: scale(0.9); }

.baskets { display: flex; gap: 5vw; width: 100%; justify-content: center; }
.basket {
  width: min(38vw, 360px);
  min-height: min(26vh, 220px);
  border-radius: 20px 20px 48px 48px;
  background: #f3e2c4;
  border: 6px solid #c99a5b;
  display: flex;
  flex-wrap: wrap;
  align-content: center;
  justify-content: center;
  gap: 8px;
  padding: 10px;
  box-sizing: border-box;
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}
.basket[data-lit='true'] { box-shadow: 0 0 0 8px #ffd93d; transform: scale(1.03); }

.loose { display: flex; gap: 4vw; min-height: min(16vh, 130px); align-items: center; }
.thing {
  width: min(15vw, 13vh, 120px);
  aspect-ratio: 1;
  font-size: min(10vw, 9vh, 84px);
  line-height: 1;
  border-radius: 22px;
  display: grid;
  place-items: center;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
/* Small is clearly small everywhere: a big one in a basket stays well above a small one outside */
.thing[data-big='false'] { font-size: min(4.6vw, 4.1vh, 38px); }
.thing.in { width: min(11vw, 10vh, 92px); font-size: min(8vw, 7vh, 66px); }
.thing.in[data-big='false'] { font-size: min(4vw, 3.6vh, 34px); }
.thing[data-back='true'] { animation: hop 0.6s ease; }
@keyframes hop { 30% { transform: translateY(-26px); } 60% { transform: translateY(0); } 80% { transform: translateY(-8px); } }
.thing :deep(.piece) { width: 82%; height: 82%; }
.thing[data-lifted='true'] { transform: translateY(-14px) scale(1.12); box-shadow: 0 0 0 6px #ffd93d; background: #fffbe6; }
.thing[data-lit='true'] { box-shadow: 0 0 0 6px #ffd93d; }
</style>
