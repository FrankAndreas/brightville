<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ProgressStars from '@/components/ProgressStars.vue'
import { LISTEN_ROUND, pickScenes, type ListenItem } from '@/core/listen/round'
import { allScenes, SCENES } from '@/core/listen/scenes'
import type { Lang } from '@/core/vocab/types'
import { stopSpeaking } from '@/services/tts'
import { useListenStore } from '@/stores/listen'
import type { BuildingResult } from '../types'
import { SET_BONUS, STARS_PER_TASK, useVisit } from '../visit'
import LanguagePick from '../vokabeln/LanguagePick.vue'
import ListenRound from './ListenRound.vue'

// The Reimhaus at Oberstufe: listening (docs/superpowers/specs/2026-11-22-brightville-oberstufe-listening-design.md).
// He picks a language with a voice, then a topic or "Gemischt", and hears five short scenes, each with a question in
// German. A missed scene doesn't come back in this round. One round per visit.
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

const listen = useListenStore()
// The child who started the visit: his answers count for him, even if the device changes hands meanwhile
const owner = listen.who
const visit = useVisit(leave)

type Screen = 'lang' | 'topic' | 'round' | 'end'
const screen = ref<Screen>('lang')
const lang = ref<Lang>('en')
const items = ref<ListenItem[]>([])
const index = ref(0)
const answers = ref<{ scene: string; right: boolean }[]>([])

const solved = computed(() => answers.value.filter(a => a.right).length)
const stars = computed(() => {
  const perfect = items.value.length === LISTEN_ROUND && answers.value.length === LISTEN_ROUND && solved.value === LISTEN_ROUND
  return solved.value * STARS_PER_TASK + (perfect ? SET_BONUS : 0)
})

function pick(chosen: Lang) {
  lang.value = chosen
  screen.value = 'topic'
}

function start(topic?: string) {
  items.value = pickScenes(allScenes(lang.value, topic), listen.progress, Math.random)
  if (items.value.length === 0) return
  index.value = 0
  answers.value = []
  screen.value = 'round'
}

function onAnswer(right: boolean) {
  const item = items.value[index.value]
  if (!item || answers.value.some(a => a.scene === item.key)) return
  answers.value.push({ scene: item.key, right })
}

function next() {
  if (index.value + 1 < items.value.length) {
    index.value++
    return
  }
  // The voice of the last scene stops with the round
  visit.dropRuns()
  stopSpeaking()
  screen.value = 'end'
}

function leave() {
  if (visit.isClosed()) return
  visit.shutDown()
  if (answers.value.length) listen.record(lang.value, answers.value, owner)
  emit('finished', { stars: stars.value })
}

function onKey(e: KeyboardEvent) {
  if (e.code === 'Escape') leave()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="hoeren" data-test="hoeren">
    <LanguagePick v-if="screen === 'lang'" :owner="owner" needs-voice @pick="pick" />

    <div v-else-if="screen === 'topic'" class="topics" data-test="topics">
      <div class="head">
        <button type="button" class="back" data-test="back" @click="screen = 'lang'">← Sprache</button>
        <h2>👂 {{ lang === 'en' ? '🇬🇧 Englisch' : '🇫🇷 Französisch' }}</h2>
      </div>
      <div class="row">
        <button type="button" class="mixed" data-test="topic-mixed" @click="start()">🎲 Gemischt</button>
        <button v-for="t in SCENES[lang]" :key="t.id" type="button" :data-test="`topic-${t.id}`" @click="start(t.id)">
          {{ t.name }}
        </button>
      </div>
    </div>

    <ListenRound
      v-else-if="screen === 'round' && items[index]" :item="items[index]" :lang="lang" :total="items.length"
      :solved="solved" :new-run="visit.newRun" @answer="onAnswer" @next="next"
    />

    <div v-else-if="screen === 'end'" class="end" data-test="end">
      <ProgressStars :total="items.length" :solved="solved" big />
      <p>{{ solved }} von {{ items.length }} verstanden – {{ stars }} ⭐</p>
      <button type="button" data-test="finish" @click="leave">Fertig</button>
    </div>
  </div>
</template>

<style scoped>
.hoeren {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
  /* Clear of the leave button in the top left corner (and the same on the right, to stay centred) */
  padding: 6vh 104px 16px; box-sizing: border-box; overflow: auto; background: #fff8ee;
}
.topics { width: 100%; max-width: 860px; }
.head { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; }
h2 { margin: 0; font: 700 30px/1.2 system-ui, sans-serif; color: #23264a; }
.row { display: flex; flex-wrap: wrap; gap: 10px; }
.row button, .back {
  font: 600 19px/1.2 system-ui, sans-serif; padding: 12px 16px; border-radius: 12px; border: 2px solid #c6cbec; background: #fff; color: #23264a;
}
.mixed { background: #eef0ff; }
.back { padding: 8px 12px; font-size: 17px; }
.end { display: flex; flex-direction: column; align-items: center; gap: 18px; font: 600 26px/1.3 system-ui, sans-serif; color: #23264a; }
.end button {
  font: 600 26px/1.2 system-ui, sans-serif; padding: 18px 40px; min-width: 300px; border-radius: 14px;
  border: 3px solid #c6cbec; background: #fff; color: #23264a;
}
</style>
