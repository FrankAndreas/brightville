<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import ProgressStars from '@/components/ProgressStars.vue'
import { buildDatesRound, kindOf } from '@/core/dates/round'
import type { Lang } from '@/core/vocab/types'
import { useDatesStore } from '@/stores/dates'
import type { BuildingResult } from '../types'
import { useVisit } from '../visit'
import LanguagePick from '../vokabeln/LanguagePick.vue'
import { createRoundFlow, type RoundState } from '../vokabeln/roundFlow'
import DateRound from './DateRound.vue'

// The Kalender at Oberstufe: dates and times (docs/superpowers/specs/2026-11-22-brightville-oberstufe-grammar-
// reading-dates-design.md). He picks the language and plays one mixed round of ten tasks, two of each kind, all made
// by rules (src/core/dates/). One round per visit.
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

const dates = useDatesStore()
// The child who started the visit: his answers count for him, even if the device changes hands meanwhile
const owner = dates.who
const visit = useVisit(leave)

type Screen = 'lang' | 'round' | 'end'
const screen = ref<Screen>('lang')
const lang = ref<Lang>('en')
const flow = shallowRef<ReturnType<typeof createRoundFlow> | null>(null)

function pick(chosen: Lang) {
  lang.value = chosen
  flow.value = createRoundFlow(buildDatesRound(chosen, dates.progress, Math.random), chosen, s => reactive(s) as RoundState)
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
  if (state?.firstTry.length) {
    dates.record(lang.value, state.firstTry.map(f => ({ kind: `${lang.value}:${kindOf(f.key)}`, right: f.right })), owner)
  }
  emit('finished', { stars: state?.stars ?? 0 })
}

function onKey(e: KeyboardEvent) {
  if (e.code === 'Escape') leave()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="datum" data-test="datum">
    <LanguagePick v-if="screen === 'lang'" :owner="owner" @pick="pick" />

    <DateRound v-else-if="screen === 'round' && flow" :flow="flow" :lang="lang" />

    <div v-else-if="screen === 'end' && flow" class="end" data-test="end">
      <ProgressStars :total="flow.state.total" :solved="knew" big />
      <p>{{ knew }} von {{ flow.state.total }} richtig – {{ flow.state.stars }} ⭐</p>
      <button type="button" data-test="finish" @click="leave">Fertig</button>
    </div>
  </div>
</template>

<style scoped>
.datum {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
  /* Clear of the leave button in the top left corner (and the same on the right, to stay centred) */
  padding: 6vh 104px 16px; box-sizing: border-box; overflow: auto; background: #eef7fb;
}
.end { display: flex; flex-direction: column; align-items: center; gap: 18px; font: 600 26px/1.3 system-ui, sans-serif; color: #23264a; }
.end button {
  font: 600 26px/1.2 system-ui, sans-serif; padding: 18px 40px; min-width: 300px; border-radius: 14px;
  border: 3px solid #c6cbec; background: #fff; color: #23264a;
}
</style>
