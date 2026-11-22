<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ProgressStars from '@/components/ProgressStars.vue'
import { answerOrder, pickText, readingStars } from '@/core/reading/rules'
import { allTexts, READING, type ReadingText } from '@/core/reading/texts'
import type { Lang } from '@/core/vocab/types'
import { useReadingStore } from '@/stores/reading'
import type { BuildingResult } from '../types'
import { useVisit } from '../visit'
import LanguagePick from '../vokabeln/LanguagePick.vue'
import ReadingRound from './ReadingRound.vue'

// The Bibliothek at Oberstufe: a reading room (docs/superpowers/specs/2026-11-22-brightville-oberstufe-grammar-
// reading-dates-design.md). He picks the language, then a topic or "Gemischt", and reads one text (one he hasn't read
// yet, else the one read longest ago) with four questions in German. One text per visit.
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

const reading = useReadingStore()
// The child who started the visit: the text counts for him, even if the device changes hands meanwhile
const owner = reading.who
const visit = useVisit(leave)

type Screen = 'lang' | 'topic' | 'read' | 'end'
const screen = ref<Screen>('lang')
const lang = ref<Lang>('en')
const current = ref<{ key: string; text: ReadingText } | null>(null)
const orders = ref<number[][]>([])
const index = ref(0)
const picked = ref<number | null>(null)
const rights = ref<boolean[]>([])

/** Topics with all their texts read get a ✓ */
const topics = computed(() => READING[lang.value].map(t => ({
  ...t, done: t.texts.every(x => reading.progress[`${lang.value}:${t.id}:${x.id}`]),
})))

function pick(chosen: Lang) {
  lang.value = chosen
  screen.value = 'topic'
}

function start(topic?: string) {
  const chosen = pickText(allTexts(lang.value, topic), reading.progress, Math.random)
  if (!chosen) return
  current.value = { key: chosen.key, text: chosen.text }
  orders.value = chosen.text.questions.map(() => answerOrder(Math.random))
  index.value = 0
  picked.value = null
  rights.value = []
  screen.value = 'read'
}

function onAnswer(i: number) {
  const q = current.value?.text.questions[index.value]
  if (!q || picked.value !== null) return
  picked.value = i
  rights.value = [...rights.value, i === q.right]
}

function next() {
  if (!current.value) return
  if (index.value + 1 < current.value.text.questions.length) {
    index.value++
    picked.value = null
    return
  }
  screen.value = 'end'
}

const solved = computed(() => rights.value.filter(Boolean).length)

function leave() {
  if (visit.isClosed()) return
  visit.shutDown()
  if (current.value && rights.value.length) reading.record(lang.value, [{ text: current.value.key, right: solved.value }], owner)
  emit('finished', { stars: readingStars(rights.value) })
}

function onKey(e: KeyboardEvent) {
  if (e.code === 'Escape') leave()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="lesen" data-test="lesen">
    <LanguagePick v-if="screen === 'lang'" :owner="owner" @pick="pick" />

    <div v-else-if="screen === 'topic'" class="topics" data-test="topics">
      <div class="head">
        <button type="button" class="back" data-test="back" @click="screen = 'lang'">← Sprache</button>
        <h2>📚 {{ lang === 'en' ? '🇬🇧 Englisch' : '🇫🇷 Französisch' }}</h2>
      </div>
      <div class="row">
        <button type="button" class="mixed" data-test="topic-mixed" @click="start()">🎲 Gemischt</button>
        <button v-for="t in topics" :key="t.id" type="button" :data-test="`topic-${t.id}`" @click="start(t.id)">
          {{ t.name }}<span v-if="t.done" class="done" aria-label="alle gelesen"> ✓</span>
        </button>
      </div>
    </div>

    <ReadingRound
      v-else-if="screen === 'read' && current" :text-key="current.key" :text="current.text" :lang="lang" :index="index"
      :order="orders[index]" :picked="picked" :rights="rights" @answer="onAnswer" @next="next"
    />

    <div v-else-if="screen === 'end'" class="end" data-test="end">
      <ProgressStars :total="4" :solved="solved" big />
      <p>{{ solved }} von 4 richtig – {{ readingStars(rights) }} ⭐</p>
      <button type="button" data-test="finish" @click="leave">Fertig</button>
    </div>
  </div>
</template>

<style scoped>
.lesen {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
  /* Clear of the leave button in the top left corner (and the same on the right, to stay centred) */
  padding: 4vh 104px 24px; box-sizing: border-box; overflow: auto; background: #f7f3ea;
}
.topics { width: 100%; max-width: 860px; }
.head { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; }
h2 { margin: 0; font: 700 30px/1.2 system-ui, sans-serif; color: #23264a; }
.row { display: flex; flex-wrap: wrap; gap: 10px; }
.row button, .back {
  font: 600 19px/1.2 system-ui, sans-serif; padding: 12px 16px; border-radius: 12px; border: 2px solid #c6cbec; background: #fff; color: #23264a;
}
.mixed { background: #eef0ff; }
.done { color: #1e7d3c; }
.back { padding: 8px 12px; font-size: 17px; }
.end { display: flex; flex-direction: column; align-items: center; gap: 18px; font: 600 26px/1.3 system-ui, sans-serif; color: #23264a; }
.end button {
  font: 600 26px/1.2 system-ui, sans-serif; padding: 18px 40px; min-width: 300px; border-radius: 14px;
  border: 3px solid #c6cbec; background: #fff; color: #23264a;
}
</style>
