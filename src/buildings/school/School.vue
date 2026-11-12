<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import Confetti from '@/components/Confetti.vue'
import { buildSession, dicePips, looseLayout, numberWord, seededRandom, type Task, type Thing } from '@/core/numbers'
import { playBeat } from '@/services/sound'
import { speak, stopSpeaking } from '@/services/tts'
import type { BuildingResult } from '../types'
import { createSchoolFlow, type SchoolEffect } from './flow'
import { THINGS } from './things'

const props = defineProps<{
  /** The tasks of this visit; made up at random when not given */
  tasks?: Task[]
  things?: Thing[]
}>()
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

// The pause after the cheer, before the next question
const AFTER_CHEER_MS = 500
// One object lights up this often while counting together
const RECOUNT_STEP_MS = 700
const CONFETTI_MS = 3000

const things = props.things ?? THINGS
const tasks = props.tasks ?? buildSession(things.length)
const flow = createSchoolFlow(tasks, things)
const view = reactive({ ...flow.state, wrong: [...flow.state.wrong] })
/** Objects that are lit: pointed at by the child, or counted along */
const marked = ref(new Set<number>())
/** The answer button the arrow keys are on; -1 for none */
const focus = ref(-1)

const task = computed(() => view.task)
const thing = computed(() => things[(task.value?.kind ?? 0) % things.length])

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
  Object.assign(view, flow.state, { wrong: [...flow.state.wrong] })
}

/** Carries out what the flow asks for. Speech that something waits on is returned. */
function run(effects: SchoolEffect[]) {
  sync()
  let spoken: Promise<void> = Promise.resolve()
  for (const effect of effects) {
    if (effect.type === 'speak') spoken = speak(effect.text)
    else if (effect.type === 'chime') playBeat('chime')
    else if (effect.type === 'confetti') later(leave, CONFETTI_MS)
    else if (effect.type === 'recount') recount(effect.amount, spoken)
  }
  return spoken
}

/** Counts every object aloud, lighting one after the other, then lets the child answer again. */
function recount(amount: number, after: Promise<void>) {
  marked.value = new Set()
  const step = (n: number) => {
    if (n > amount) {
      run(flow.recountDone())
      return
    }
    marked.value = new Set([...marked.value, n - 1])
    void speak(numberWord(n))
    later(() => step(n + 1), RECOUNT_STEP_MS)
  }
  void after.then(() => later(() => step(1), RECOUNT_STEP_MS))
}

function touch(i: number) {
  if (closed || marked.value.has(i)) return
  const effects = flow.touch()
  if (effects.length === 0) return
  marked.value = new Set([...marked.value, i])
  run(effects)
}

function answer(choice: number) {
  if (closed) return
  const spoken = run(flow.answer(choice))
  if (flow.state.phase !== 'cheering' || view.phase !== 'cheering') return
  // Let the cheer finish before the next question starts
  void spoken.then(() => later(() => {
    marked.value = new Set()
    focus.value = -1
    run(flow.next())
  }, AFTER_CHEER_MS))
}

function moveFocus(by: number) {
  const choices = task.value?.choices
  if (!choices) return
  focus.value = Math.min(choices.length - 1, Math.max(0, focus.value + by))
  void speak(numberWord(choices[focus.value]))
}

function shutDown() {
  if (closed) return
  closed = true
  for (const id of timers) clearTimeout(id)
  timers.clear()
  window.removeEventListener('keydown', onKey)
  stopSpeaking()
}

function leave() {
  if (closed) return
  shutDown()
  emit('finished', { stars: flow.state.stars })
}

function onKey(e: KeyboardEvent) {
  if (e.repeat) return
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(e.code)
  if (e.code === 'Escape') leave()
  else if (digit) answer(Number(digit[1]))
  else if (e.code === 'ArrowLeft') moveFocus(-1)
  else if (e.code === 'ArrowRight') moveFocus(1)
  else if ((e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') && focus.value >= 0) {
    const choice = task.value?.choices[focus.value]
    if (choice !== undefined) answer(choice)
  }
}

// Where the loose objects of a counting task sit; the same for a task every time it is drawn
const spots = computed(() => {
  const t = task.value
  if (t?.type !== 'count') return []
  return looseLayout(t.amount, seededRandom(view.index * 31 + t.amount))
})
const pips = computed(() => (task.value?.type === 'dice' ? dicePips(task.value.dice[0]) : []))
const groups = computed(() => {
  const t = task.value
  if (t?.type !== 'plus') return []
  const range = (from: number, n: number) => Array.from({ length: n }, (_, i) => from + i)
  return [range(0, t.a), range(t.a, t.b)]
})

onMounted(() => {
  window.addEventListener('keydown', onKey)
  run(flow.start())
})
onBeforeUnmount(shutDown)
</script>

<template>
  <div class="school" :data-phase="view.phase">
    <div class="progress" aria-hidden="true">
      <svg v-for="n in tasks.length" :key="n" viewBox="0 0 24 24" data-test="progress-star" :data-done="n <= view.solved">
        <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
      </svg>
    </div>

    <div class="board">
      <template v-if="task?.type === 'count'">
        <button
          v-for="(spot, i) in spots" :key="i" class="thing loose" data-test="thing" :data-counted="marked.has(i)"
          :style="{ left: `${spot.x * 100}%`, top: `${spot.y * 100}%` }" tabindex="-1" @pointerdown="touch(i)"
        >{{ thing.emoji }}</button>
      </template>

      <div v-else-if="task?.type === 'dice'" class="die" data-test="die">
        <button
          v-for="(pip, i) in pips" :key="i" class="pip" data-test="thing" :data-counted="marked.has(i)"
          :style="{ gridColumn: pip.x + 1, gridRow: pip.y + 1 }" tabindex="-1" @pointerdown="touch(i)"
        />
      </div>

      <div v-else-if="task?.type === 'plus'" class="sum">
        <template v-for="(group, g) in groups" :key="g">
          <svg v-if="g === 1" class="plus" viewBox="0 0 40 40" aria-hidden="true"><path d="M20 6 V34 M6 20 H34" /></svg>
          <div class="group" data-test="group">
            <button
              v-for="i in group" :key="i" class="thing" data-test="thing" :data-counted="marked.has(i)"
              tabindex="-1" @pointerdown="touch(i)"
            >{{ thing.emoji }}</button>
          </div>
        </template>
      </div>
    </div>

    <div v-if="task" class="choices">
      <button
        v-for="(choice, i) in task.choices" :key="`${view.index}-${choice}`" class="choice" data-test="choice"
        :data-value="choice" :data-wrong="view.wrong.includes(choice)" :data-focus="focus === i"
        tabindex="-1" @pointerdown="answer(choice)"
      >{{ choice }}</button>
    </div>

    <Confetti v-if="view.phase === 'done'" />
  </div>
</template>

<style scoped>
.school {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2vh;
  padding: 2vh 4vw 4vh;
  box-sizing: border-box;
  background: #dff1ff;
}
button { border: 0; padding: 0; background: none; font: inherit; cursor: pointer; }

.progress { display: flex; gap: 14px; }
.progress svg { width: 46px; }
.progress path { fill: rgb(255 255 255 / 70%); stroke: #b9d6ee; stroke-width: 1.2; stroke-linejoin: round; transition: fill 0.3s ease; }
.progress svg[data-done='true'] path { fill: #ffd93d; stroke: #e0a800; }
.progress svg[data-done='true'] { animation: pop 0.5s ease; }

.board {
  flex: 1;
  min-height: 0;
  width: min(100%, 1000px);
  position: relative;
  border-radius: 36px;
  background: #fff;
  display: grid;
  place-items: center;
}
.thing {
  font-size: clamp(40px, 9vh, 84px);
  line-height: 1;
  width: 1.5em;
  height: 1.5em;
  border-radius: 50%;
  transition: transform 0.15s ease, background 0.15s ease;
}
.thing.loose { position: absolute; transform: translate(-50%, -50%); }
.thing[data-counted='true'] { background: #ffe89a; box-shadow: 0 0 0 6px #ffd93d; }
.thing.loose[data-counted='true'] { transform: translate(-50%, -50%) scale(1.12); }

.die {
  width: min(46vh, 60vw);
  aspect-ratio: 1;
  border-radius: 14%;
  background: #fffdf5;
  border: 8px solid #d9c9a3;
  box-sizing: border-box;
  display: grid;
  grid-template: repeat(3, 1fr) / repeat(3, 1fr);
  padding: 9%;
  gap: 6%;
}
.pip { border-radius: 50%; background: #3b3b58; transition: all 0.15s ease; }
.pip[data-counted='true'] { background: #ff9a3c; box-shadow: 0 0 0 6px #ffd93d; }

.sum { display: flex; align-items: center; justify-content: center; gap: 3vw; width: 100%; height: 100%; }
.group {
  flex: 1;
  max-width: 42%;
  min-height: 60%;
  display: flex;
  flex-wrap: wrap;
  align-content: center;
  justify-content: center;
  gap: 10px;
  border-radius: 28px;
  background: #f1f8ff;
  padding: 12px;
}
.plus { width: 70px; flex: none; }
.plus path { stroke: #6b4a00; stroke-width: 7; stroke-linecap: round; }

.choices { display: flex; gap: 4vw; }
.choice {
  width: min(20vw, 170px);
  height: min(16vh, 130px);
  border-radius: 28px;
  background: #fff;
  box-shadow: 0 8px 0 #b9d6ee;
  font-size: clamp(48px, 10vh, 90px);
  font-weight: 800;
  color: #2b4c7e;
  transition: all 0.15s ease;
}
.choice[data-focus='true'] { box-shadow: 0 8px 0 #e0a800, 0 0 0 8px #ffd93d; transform: translateY(-6px); }
.choice[data-wrong='true'] { opacity: 0.3; box-shadow: none; transform: scale(0.9); }

@keyframes pop { 0% { transform: scale(0.3); } 70% { transform: scale(1.3); } }
</style>
