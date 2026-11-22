<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import ProgressStars from '@/components/ProgressStars.vue'
import { GRAMMAR } from '@/core/grammar/content'
import { buildGrammarRound, isSure } from '@/core/grammar/round'
import type { Lang } from '@/core/vocab/types'
import { useGrammarStore } from '@/stores/grammar'
import type { BuildingResult } from '../types'
import { useVisit } from '../visit'
import LanguagePick from '../vokabeln/LanguagePick.vue'
import { createRoundFlow, type RoundState } from '../vokabeln/roundFlow'
import GrammarRound from './GrammarRound.vue'

// The Musterwerkstatt at Oberstufe: a grammar trainer (docs/superpowers/specs/2026-11-22-brightville-oberstufe-
// grammar-reading-dates-design.md). He picks the language, then a topic or "Gemischt" (weighted towards his weak
// topics), and plays a round of ten gap sentences. One round per visit.
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

const grammar = useGrammarStore()
// The child who started the visit: his answers count for him, even if the device changes hands meanwhile
const owner = grammar.who
const visit = useVisit(leave)

type Screen = 'lang' | 'topic' | 'round' | 'end'
const screen = ref<Screen>('lang')
const lang = ref<Lang>('en')
const flow = shallowRef<ReturnType<typeof createRoundFlow> | null>(null)

const topics = computed(() => GRAMMAR[lang.value].map(t => ({ ...t, sure: isSure(grammar.progress[`${lang.value}:${t.id}`]) })))

function pick(chosen: Lang) {
  lang.value = chosen
  screen.value = 'topic'
}

function start(topic?: string) {
  const items = buildGrammarRound(lang.value, topic, grammar.progress, Math.random)
  if (items.length === 0) return
  flow.value = createRoundFlow(items, lang.value, s => reactive(s) as RoundState)
  screen.value = 'round'
}

watch(() => flow.value?.state.phase, phase => {
  if (phase === 'done') screen.value = 'end'
})

const knew = computed(() => flow.value?.state.firstTry.filter(f => f.right).length ?? 0)

function leave() {
  if (visit.isClosed()) return
  visit.shutDown()
  const state = flow.value?.state
  if (state?.firstTry.length) grammar.record(lang.value, state.firstTry.map(f => ({ item: f.key, right: f.right })), owner)
  emit('finished', { stars: state?.stars ?? 0 })
}

function onKey(e: KeyboardEvent) {
  if (e.code === 'Escape') leave()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="grammatik" data-test="grammatik">
    <LanguagePick v-if="screen === 'lang'" :owner="owner" @pick="pick" />

    <div v-else-if="screen === 'topic'" class="topics" data-test="topics">
      <div class="head">
        <button type="button" class="back" data-test="back" @click="screen = 'lang'">← Sprache</button>
        <h2>🧩 {{ lang === 'en' ? '🇬🇧 Englisch' : '🇫🇷 Französisch' }}</h2>
      </div>
      <div class="row">
        <button type="button" class="mixed" data-test="topic-mixed" @click="start()">🎲 Gemischt</button>
        <button v-for="t in topics" :key="t.id" type="button" :data-test="`topic-${t.id}`" @click="start(t.id)">
          {{ t.name }}<span v-if="t.sure" class="sure" aria-label="sicher"> ✓</span>
        </button>
      </div>
    </div>

    <GrammarRound v-else-if="screen === 'round' && flow" :flow="flow" :lang="lang" />

    <div v-else-if="screen === 'end' && flow" class="end" data-test="end">
      <ProgressStars :total="flow.state.total" :solved="knew" big />
      <p>{{ knew }} von {{ flow.state.total }} richtig – {{ flow.state.stars }} ⭐</p>
      <button type="button" data-test="finish" @click="leave">Fertig</button>
    </div>
  </div>
</template>

<style scoped>
.grammatik {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
  /* Clear of the leave button in the top left corner (and the same on the right, to stay centred) */
  padding: 6vh 104px 16px; box-sizing: border-box; overflow: auto; background: #f3f8ff;
}
.topics { width: 100%; max-width: 860px; }
.head { display: flex; align-items: center; gap: 16px; margin-bottom: 18px; }
h2 { margin: 0; font: 700 30px/1.2 system-ui, sans-serif; color: #23264a; }
.row { display: flex; flex-wrap: wrap; gap: 10px; }
.row button, .back {
  font: 600 19px/1.2 system-ui, sans-serif; padding: 12px 16px; border-radius: 12px; border: 2px solid #c6cbec; background: #fff; color: #23264a;
}
.mixed { background: #eef0ff; }
.sure { color: #1e7d3c; }
.back { padding: 8px 12px; font-size: 17px; }
.end { display: flex; flex-direction: column; align-items: center; gap: 18px; font: 600 26px/1.3 system-ui, sans-serif; color: #23264a; }
.end button {
  font: 600 26px/1.2 system-ui, sans-serif; padding: 18px 40px; min-width: 300px; border-radius: 14px;
  border: 3px solid #c6cbec; background: #fff; color: #23264a;
}
</style>
