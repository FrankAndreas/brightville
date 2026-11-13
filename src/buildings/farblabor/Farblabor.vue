<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import Confetti from '@/components/Confetti.vue'
import { COLORS, LAB_TASKS, buildLab, type ColorId, type LabTask } from '@/core/colorMixes'
import { createQuiz } from '@/core/quiz'
import { playBeat } from '@/services/sound'
import { instruct, speak, stopSpeaking } from '@/services/tts'
import { onLeaveRequest } from '../leave'
import type { BuildingResult } from '../types'

// The colour lab: two paint pots pour into a bowl. Which colour comes out? Two Stars per mix.
const props = defineProps<{
  /** The mixes of this visit; drawn at random when not given */
  tasks?: LabTask[]
}>()
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

const STARS_PER_MIX = 2
// The mixed colour is shown and said, then the next mix
const NEXT_AFTER_MS = 2200
const CONFETTI_MS = 3000

const tasks = props.tasks ?? buildLab()
const quiz = createQuiz(tasks.map(t => ({ answer: t.answer, choices: t.choices.length })))
const view = reactive({ ...quiz.state })
const task = computed(() => tasks[view.index])
/** The colour in the bowl: empty until the mix is right */
const bowl = ref<ColorId | null>(null)

let closed = false
const timers = new Set<ReturnType<typeof setTimeout>>()
function later(fn: () => void, ms: number) {
  const id = setTimeout(() => {
    timers.delete(id)
    if (!closed) fn()
  }, ms)
  timers.add(id)
}

const name = (c: ColorId) => COLORS[c].name
const sync = () => Object.assign(view, quiz.state)

function ask() {
  const t = task.value
  if (t) void instruct(`${name(t.mix.a)} und ${name(t.mix.b)}. Was gibt das?`)
}

function pick(choice: number) {
  const t = task.value
  if (closed || !t) return
  const result = quiz.answer(choice)
  sync()
  if (result === 'wrong') {
    void speak('Schau nochmal!')
    return
  }
  if (result !== 'right') return
  bowl.value = t.mix.result
  playBeat('chime')
  void speak(`${name(t.mix.result)}!`)
  if (quiz.state.done) {
    later(leave, NEXT_AFTER_MS + CONFETTI_MS)
    return
  }
  later(() => {
    quiz.next()
    sync()
    bowl.value = null
    ask()
  }, NEXT_AFTER_MS)
}

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
  const earned = quiz.state.solved * STARS_PER_MIX
  shutDown()
  emit('finished', { stars: earned })
}

function onKey(e: KeyboardEvent) {
  if (e.repeat) return
  if (e.code === 'Escape') return leave()
  const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code)
  if (digit) pick(Number(digit[1]) - 1)
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  stopLeaveRequests = onLeaveRequest(leave)
  ask()
})
onBeforeUnmount(shutDown)
</script>

<template>
  <div class="labor" data-test="farblabor">
    <div class="progress" aria-hidden="true">
      <svg v-for="n in LAB_TASKS" :key="n" viewBox="0 0 24 24" data-test="progress-star" :data-done="n <= view.solved">
        <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
      </svg>
    </div>
    <div v-if="task" class="bench">
      <div class="pot" data-test="pot" :data-color="task.mix.a" :style="{ '--paint': COLORS[task.mix.a].hex }" />
      <span class="plus">+</span>
      <div class="pot" data-test="pot" :data-color="task.mix.b" :style="{ '--paint': COLORS[task.mix.b].hex }" />
      <span class="plus">=</span>
      <div
        class="bowl" data-test="bowl" :data-color="bowl ?? ''"
        :style="{ '--paint': bowl ? COLORS[bowl].hex : 'transparent' }"
      >{{ bowl ? '' : '?' }}</div>
    </div>
    <div v-if="task" class="choices">
      <button
        v-for="(c, i) in task.choices" :key="`${view.index}-${c}`" class="choice" data-test="choice" :data-color="c"
        :data-wrong="view.wrong.includes(i)" :aria-label="name(c)" :style="{ '--paint': COLORS[c].hex }"
        @click="pick(i)"
      />
    </div>
    <Confetti v-if="view.done" />
  </div>
</template>

<style scoped>
.labor {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-around;
  padding: 2vh 4vw 4vh;
  box-sizing: border-box;
  background: #eef7ff;
}
.progress { display: flex; gap: 14px; }
.progress svg { width: 46px; }
.progress path { fill: rgb(255 255 255 / 70%); stroke: #b9cfe6; stroke-width: 1.2; stroke-linejoin: round; transition: fill 0.3s ease; }
.progress svg[data-done='true'] path { fill: #ffd93d; stroke: #e0a800; }
.bench { display: flex; align-items: center; gap: 3vw; }
.plus { font: 800 min(9vw, 72px) system-ui, sans-serif; color: #5c7fa8; }
.pot, .bowl {
  width: min(18vw, 150px);
  aspect-ratio: 1;
  border: 6px solid #5c7fa8;
  background: linear-gradient(to top, var(--paint) 70%, #fff 70%);
}
/* The empty glass above the paint is pale blue-grey and the paint has a surface line, so white paint shows as paint,
   not as an empty pot (UX review) */
.pot {
  border-radius: 14px 14px 30px 30px;
  background: linear-gradient(to top, var(--paint) 0 67%, rgb(40 60 90 / 30%) 67% 71%, #dce6f1 71%);
}
.bowl {
  border-radius: 0 0 50% 50%;
  display: grid;
  place-items: center;
  font: 800 min(9vw, 72px) system-ui, sans-serif;
  color: #5c7fa8;
  transition: background 0.6s ease;
}
.choices { display: flex; gap: 5vw; }
.choice {
  width: min(20vw, 160px);
  aspect-ratio: 1;
  border-radius: 50%;
  border: 6px solid white;
  background: var(--paint);
  box-shadow: 0 8px 0 rgb(0 0 0 / 15%);
  cursor: pointer;
  transition: opacity 0.3s, transform 0.3s;
}
.choice[data-wrong='true'] { opacity: 0.3; box-shadow: none; transform: scale(0.9); }
</style>
