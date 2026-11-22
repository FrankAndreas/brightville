<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, reactive, ref, shallowRef, watch } from 'vue'
import ProgressStars from '@/components/ProgressStars.vue'
import { builtinWords } from '@/core/vocab/builtin'
import { buildRound, ownWords } from '@/core/vocab/round'
import type { Lang, VocabWord } from '@/core/vocab/types'
import { usePlayerStore } from '@/stores/player'
import { useVocabStore } from '@/stores/vocab'
import type { BuildingResult } from '../types'
import { useVisit } from '../visit'
import LanguagePick from './LanguagePick.vue'
import ListEditor from './ListEditor.vue'
import Round from './Round.vue'
import Shelf from './Shelf.vue'
import { createRoundFlow, type RoundState } from './roundFlow'

// The School at Oberstufe: a vocabulary trainer for English or French (docs/superpowers/specs/2026-11-22-brightville-
// oberstufe-vocab-design.md). He picks the language, then one of his lists, all his words, or a built-in topic, and
// plays one round of up to ten words; or he makes and changes his lists. One round per visit.
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

const vocab = useVocabStore()
const player = usePlayerStore()
// The child who started the visit: his answers count for him, even if the device changes hands meanwhile
const owner = vocab.who
const visit = useVisit(leave)

type Screen = 'lang' | 'shelf' | 'edit' | 'round' | 'end'
const screen = ref<Screen>('lang')
const lang = ref<Lang>('en')
const editing = ref<number | null>(null)
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
  const pool = [...ownWords(vocab.lists, lang.value), ...builtinWords(lang.value)]
  const items = buildRound(words, vocab.progress, player.day || localDay(), Math.random, pool)
  flow.value = createRoundFlow(items, lang.value, s => reactive(s) as RoundState)
  screen.value = 'round'
}

watch(() => flow.value?.state.phase, phase => {
  if (phase === 'done') screen.value = 'end'
})

const editList = computed(() => vocab.lists.find(l => l.id === editing.value))
function edit(id: number | null) {
  editing.value = id
  screen.value = 'edit'
}

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
  <div class="vokabeln" data-test="vokabeln">
    <LanguagePick v-if="screen === 'lang'" :owner="owner" @pick="pick" />

    <Shelf
      v-else-if="screen === 'shelf'" :lang="lang" :lists="vocab.lists"
      @list="id => start(ownWords(vocab.lists, lang, id))" @all="start(ownWords(vocab.lists, lang))"
      @topic="id => start(builtinWords(lang, id))" @edit="edit" @new="edit(null)" @back="screen = 'lang'"
    />

    <ListEditor
      v-else-if="screen === 'edit'" :key="editing ?? 'new'" :lang="lang" :list="editList"
      @done="screen = 'shelf'" @cancel="screen = 'shelf'"
    />

    <Round v-else-if="screen === 'round' && flow" :flow="flow" :lang="lang" />

    <div v-else-if="screen === 'end' && flow" class="end" data-test="end">
      <ProgressStars :total="flow.state.total" :solved="knew" big />
      <p>{{ knew }} von {{ flow.state.total }} gewusst – {{ flow.state.stars }} ⭐</p>
      <button type="button" data-test="finish" @click="leave">Fertig</button>
    </div>
  </div>
</template>

<style scoped>
.vokabeln {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
  /* Clear of the leave button in the top left corner (and the same on the right, to stay centred) */
  padding: 6vh 104px 16px; box-sizing: border-box; overflow: auto; background: #f6f4ff;
}
.end button {
  font: 600 26px/1.2 system-ui, sans-serif; padding: 18px 40px; min-width: 300px; border-radius: 14px;
  border: 3px solid #c6cbec; background: #fff; color: #23264a;
}
.end { display: flex; flex-direction: column; align-items: center; gap: 18px; font: 600 26px/1.3 system-ui, sans-serif; color: #23264a; }
</style>
