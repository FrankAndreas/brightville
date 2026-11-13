<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import Confetti from '@/components/Confetti.vue'
import { createQuiz } from '@/core/quiz'
import { pickStory, type Story } from '@/core/stories'
import { playBeat } from '@/services/sound'
import { speak, stopSpeaking } from '@/services/tts'
import { onLeaveRequest } from '../leave'
import type { BuildingResult } from '../types'

// The library: a short story read aloud, scene by scene with a picture, then three questions
// answered by tapping a picture. Three Stars per question.
const props = defineProps<{
  /** The story of this visit; at random when not given */
  story?: Story
}>()
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

const STARS_PER_QUESTION = 3
// A scene stays at least this long, even when the voice is quicker (or missing)
const SCENE_MIN_MS = 3500
// A breath between scenes, and after the title
const GAP_MS = 700
const NEXT_AFTER_MS = 2200
const CONFETTI_MS = 3000
const LAST_STORY_KEY = 'brightville.lastStory'

function lastStory(): string | null {
  try {
    return window.localStorage.getItem(LAST_STORY_KEY)
  } catch {
    return null
  }
}

const story = props.story ?? pickStory(lastStory())
try {
  window.localStorage.setItem(LAST_STORY_KEY, story.id)
} catch {
  // The next story may be the same one
}

const phase = ref<'story' | 'questions'>('story')
const sceneIndex = ref(0)
const quiz = createQuiz(story.questions.map(q => ({ answer: q.answer, choices: q.choices.length })))
const view = reactive({ ...quiz.state })
const question = computed(() => story.questions[view.index])

let closed = false
/** Counts readings, so a scene read again doesn't advance twice */
let reading = 0
const timers = new Set<ReturnType<typeof setTimeout>>()
function later(fn: () => void, ms: number) {
  const id = setTimeout(() => {
    timers.delete(id)
    if (!closed) fn()
  }, ms)
  timers.add(id)
}
const wait = (ms: number) => new Promise<void>(resolve => later(resolve, ms))
const sync = () => Object.assign(view, quiz.state)

async function readScene() {
  const ticket = ++reading
  const scene = story.scenes[sceneIndex.value]
  await Promise.all([speak(scene.text), wait(SCENE_MIN_MS)])
  await wait(GAP_MS)
  if (closed || ticket !== reading || phase.value !== 'story') return
  if (sceneIndex.value < story.scenes.length - 1) {
    sceneIndex.value += 1
    void readScene()
  } else {
    phase.value = 'questions'
    ask()
  }
}

function again() {
  if (closed || phase.value !== 'story') return
  stopSpeaking()
  void readScene()
}

function ask() {
  if (question.value) void speak(question.value.ask)
}

function pick(choice: number) {
  const q = question.value
  if (closed || phase.value !== 'questions' || !q) return
  const result = quiz.answer(choice)
  sync()
  if (result === 'wrong') {
    void speak('Schau nochmal!')
    return
  }
  if (result !== 'right') return
  playBeat('chime')
  void speak(`Richtig! ${q.choices[q.answer].say}.`)
  if (quiz.state.done) {
    later(leave, NEXT_AFTER_MS + CONFETTI_MS)
    return
  }
  later(() => {
    quiz.next()
    sync()
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
  const earned = quiz.state.solved * STARS_PER_QUESTION
  shutDown()
  emit('finished', { stars: earned })
}

function onKey(e: KeyboardEvent) {
  if (e.repeat) return
  if (e.code === 'Escape') return leave()
  const digit = /^(?:Digit|Numpad)([1-9])$/.exec(e.code)
  if (digit) pick(Number(digit[1]) - 1)
}

onMounted(async () => {
  window.addEventListener('keydown', onKey)
  stopLeaveRequests = onLeaveRequest(leave)
  await speak(story.title)
  if (closed) return
  void readScene()
})
onBeforeUnmount(shutDown)
</script>

<template>
  <div class="bibliothek" data-test="bibliothek" :data-phase="phase">
    <div class="progress" aria-hidden="true">
      <svg v-for="n in story.questions.length" :key="n" viewBox="0 0 24 24" data-test="progress-star" :data-done="n <= view.solved">
        <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
      </svg>
    </div>

    <template v-if="phase === 'story'">
      <div class="page">
        <div :key="sceneIndex" class="scene" data-test="scene">{{ story.scenes[sceneIndex].picture }}</div>
        <div class="dots" aria-hidden="true">
          <i v-for="(_, i) in story.scenes" :key="i" :data-on="i <= sceneIndex" />
        </div>
      </div>
      <button class="again" data-test="again" aria-label="Nochmal hören" @click="again">🔁</button>
    </template>

    <div v-else-if="question" class="choices">
      <button
        v-for="(c, i) in question.choices" :key="`${view.index}-${i}`" class="choice" data-test="choice"
        :data-wrong="view.wrong.includes(i)" :aria-label="c.say" @click="pick(i)"
      >{{ c.picture }}</button>
    </div>
    <Confetti v-if="view.done" />
  </div>
</template>

<style scoped>
.bibliothek {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-around;
  padding: 2vh 4vw 4vh;
  box-sizing: border-box;
  background: #fbf3e4;
}
.progress { display: flex; gap: 14px; }
.progress svg { width: 46px; }
.progress path { fill: rgb(255 255 255 / 70%); stroke: #e6cf9c; stroke-width: 1.2; stroke-linejoin: round; transition: fill 0.3s ease; }
.progress svg[data-done='true'] path { fill: #ffd93d; stroke: #e0a800; }
.page {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3vh;
  padding: 4vh 6vw;
  border-radius: 36px;
  background: #fffdf8;
  box-shadow: 0 10px 0 #ead9b5;
}
.scene { font-size: min(20vw, 26vh); line-height: 1.1; animation: turn 0.5s ease; }
.dots { display: flex; gap: 10px; }
.dots i { width: 16px; height: 16px; border-radius: 50%; background: #ead9b5; }
.dots i[data-on='true'] { background: #c08a2e; }
.again {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  border: 0;
  background: white;
  font-size: 2.2rem;
  box-shadow: 0 6px 0 #ead9b5;
  cursor: pointer;
}
.choices { display: flex; gap: 5vw; }
.choice {
  min-width: min(22vw, 180px);
  aspect-ratio: 1;
  padding: 0 12px;
  border-radius: 32px;
  border: 0;
  background: white;
  font-size: min(10vw, 84px);
  box-shadow: 0 8px 0 #ead9b5;
  cursor: pointer;
  transition: opacity 0.3s, transform 0.3s;
}
.choice[data-wrong='true'] { opacity: 0.3; box-shadow: none; transform: scale(0.9); }
@keyframes turn { from { opacity: 0; transform: translateX(30px); } }
</style>
