<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef, watch } from 'vue'
import ProgressStars from '@/components/ProgressStars.vue'
import { builtinWords } from '@/core/vocab/builtin'
import { ownWords } from '@/core/vocab/round'
import { buildDictation } from '@/core/vocab/spelling'
import type { Lang, VocabWord } from '@/core/vocab/types'
import { usePlayerStore } from '@/stores/player'
import { useVocabStore } from '@/stores/vocab'
import type { BuildingResult } from '../types'
import { useVisit } from '../visit'
import LanguagePick from '../vokabeln/LanguagePick.vue'
import Shelf from '../vokabeln/Shelf.vue'
import { createRoundFlow, type RoundState } from '../vokabeln/roundFlow'
import DictationRound from './DictationRound.vue'

// Schreiben at Oberstufe: a dictation of his words (docs/superpowers/specs/2026-11-22-brightville-oberstufe-listening-
// design.md). He picks a language with a voice, then a source from the School's shelf (without making or changing
// lists), and hears up to ten words to type. Spelling has its own record (keys `<lang>:spell:…`). One round per visit.
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

const vocab = useVocabStore()
const player = usePlayerStore()
// The child who started the visit: his answers count for him, even if the device changes hands meanwhile
const owner = vocab.who
const visit = useVisit(leave)

type Screen = 'lang' | 'shelf' | 'round' | 'end'
const screen = ref<Screen>('lang')
const lang = ref<Lang>('en')
const flow = shallowRef<ReturnType<typeof createRoundFlow> | null>(null)

function pick(chosen: Lang) {
  lang.value = chosen
  screen.value = 'shelf'
}

/** Before the server first answered: this device's own day */
const localDay = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function start(words: VocabWord[]) {
  if (words.length === 0) return
  const items = buildDictation(words, vocab.progress, player.day || localDay(), Math.random)
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
  if (state?.firstTry.length) vocab.record(lang.value, state.firstTry.map(f => ({ word: f.key, right: f.right })), owner)
  emit('finished', { stars: state?.stars ?? 0 })
}

function onKey(e: KeyboardEvent) {
  if (e.code === 'Escape') leave()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="diktat" data-test="diktat">
    <LanguagePick v-if="screen === 'lang'" :owner="owner" needs-voice @pick="pick" />

    <Shelf
      v-else-if="screen === 'shelf'" :lang="lang" :lists="vocab.lists" :editable="false"
      @list="id => start(ownWords(vocab.lists, lang, id))" @all="start(ownWords(vocab.lists, lang))"
      @topic="id => start(builtinWords(lang, id))" @back="screen = 'lang'"
    />

    <DictationRound v-else-if="screen === 'round' && flow" :flow="flow" :lang="lang" />

    <div v-else-if="screen === 'end' && flow" class="end" data-test="end">
      <ProgressStars :total="flow.state.total" :solved="knew" big />
      <p>{{ knew }} von {{ flow.state.total }} richtig geschrieben – {{ flow.state.stars }} ⭐</p>
      <button type="button" data-test="finish" @click="leave">Fertig</button>
    </div>
  </div>
</template>

<style scoped>
.diktat {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
  /* Clear of the leave button in the top left corner (and the same on the right, to stay centred) */
  padding: 6vh 104px 16px; box-sizing: border-box; overflow: auto; background: #f4fbf6;
}
.end { display: flex; flex-direction: column; align-items: center; gap: 18px; font: 600 26px/1.3 system-ui, sans-serif; color: #23264a; }
.end button {
  font: 600 26px/1.2 system-ui, sans-serif; padding: 18px 40px; min-width: 300px; border-radius: 14px;
  border: 3px solid #c6cbec; background: #fff; color: #23264a;
}
</style>
