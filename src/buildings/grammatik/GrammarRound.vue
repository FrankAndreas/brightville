<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ProgressStars from '@/components/ProgressStars.vue'
import { GRAMMAR } from '@/core/grammar/content'
import { filled, itemByKey } from '@/core/grammar/items'
import type { Lang } from '@/core/vocab/types'
import AccentKeys from '../vokabeln/AccentKeys.vue'
import type { createRoundFlow } from '../vokabeln/roundFlow'

// One grammar round on the screen: the sentence with its gap and hint, four choices (a topic still new to him) or the
// field; after the answer the whole sentence and the topic's rule. After a miss he types the right answer out to go on
// (the round flow brings the item back once at the end). Written only: no voice.
const props = defineProps<{ flow: ReturnType<typeof createRoundFlow>; lang: Lang }>()

const state = computed(() => props.flow.state)
const round = computed(() => state.value.item)
const item = computed(() => (round.value ? itemByKey(round.value.word.key) : undefined))
const topic = computed(() => GRAMMAR[props.lang].find(t => t.id === item.value?.topic))
const typed = ref('')
const field = ref<HTMLInputElement | null>(null)
const solved = computed(() => state.value.firstTry.filter(f => f.right).length)
/** He typed this item (or types it out after a miss): the field stays until the next one, so the iPad keyboard stays up */
const retyping = ref(false)
const showField = computed(() => round.value?.mode !== 'choice' || state.value.phase === 'wrong' || (state.value.phase === 'right' && retyping.value))
/** The sentence before the answer: the gap as a line */
const parts = computed(() => (item.value?.text ?? '').split('___'))

/** The right answer, letter by letter, with the letters whose accent was off marked */
const shownLetters = computed(() => {
  const checked = state.value.checked
  if (!checked) return []
  return [...checked.shown].map((letter, i) => ({ letter, marked: checked.marks.includes(i) }))
})

function focusField() {
  void nextTick(() => field.value?.focus())
}

function submit() {
  const phase = state.value.phase
  if (phase === 'asking') props.flow.answer(typed.value)
  else if (phase === 'wrong') props.flow.retype(typed.value)
  else if (phase === 'right') return next()
  if (state.value.phase !== phase) {
    typed.value = ''
    if (state.value.phase === 'wrong') retyping.value = true
    focusField()
  }
}

function choose(choice: string) {
  props.flow.choose(choice)
  if (state.value.phase === 'wrong') {
    retyping.value = true
    focusField()
  }
}

function next() {
  props.flow.next()
  typed.value = ''
  retyping.value = false
}

watch(() => state.value.index, () => {
  if (showField.value) focusField()
}, { immediate: true })

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && e.target !== field.value && state.value.phase === 'right') next()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="round" data-test="round" :data-item="round?.word.key">
    <ProgressStars :total="state.total" :solved="solved" :size="30" />
    <p class="topic">{{ topic?.name }}</p>
    <p v-if="state.phase === 'asking'" class="sentence" data-test="sentence">
      {{ parts[0] }}<span class="gap">___</span>{{ parts[1] }}
      <span v-if="item?.hint" class="hint">{{ item.hint }}</span>
    </p>
    <template v-else>
      <p class="sentence done" data-test="filled">{{ item ? filled(item) : '' }}</p>
      <p v-if="state.phase === 'right'" class="verdict right" data-test="verdict">Richtig!</p>
      <div v-else class="verdict wrong" data-test="verdict">
        <p>{{ state.checked?.verdict === 'accent' ? 'Fast – achte auf die Akzente:' : 'Richtig wäre:' }}</p>
        <p class="answer"><span v-for="(l, i) in shownLetters" :key="i" :class="{ mark: l.marked }">{{ l.letter }}</span></p>
        <p class="small">Schreib es ab, dann geht es weiter.</p>
      </div>
      <p class="rule" data-test="rule">💡 {{ topic?.rule }}</p>
    </template>

    <div v-if="round?.mode === 'choice' && state.phase === 'asking'" class="choices">
      <button v-for="c in round.choices" :key="c" type="button" data-test="choice" @click="choose(c)">{{ c }}</button>
    </div>

    <template v-if="showField">
      <input
        ref="field" v-model="typed" class="field" data-test="answer" autocomplete="off" autocapitalize="off" autocorrect="off"
        spellcheck="false" enterkeyhint="go" :readonly="state.phase === 'right'" @keydown.enter.prevent="submit"
      >
      <template v-if="state.phase !== 'right'">
        <AccentKeys v-if="lang === 'fr'" :target="field" />
        <button type="button" class="main" data-test="check" @click="submit">Prüfen</button>
      </template>
    </template>
    <button v-if="state.phase === 'right'" type="button" class="main" data-test="next" @click="next">Weiter</button>
  </div>
</template>

<style scoped>
.round { display: flex; flex-direction: column; align-items: center; gap: 14px; width: 100%; max-width: 760px; }
.topic { margin: 0; font: 500 18px/1.3 system-ui, sans-serif; color: #5a5f86; }
.sentence { margin: 0; font: 600 30px/1.35 system-ui, sans-serif; color: #23264a; text-align: center; }
.gap { display: inline-block; min-width: 3em; border-bottom: 3px solid #4a5bd4; color: transparent; }
.hint { display: block; font: 500 20px/1.3 system-ui, sans-serif; color: #5a5f86; margin-top: 4px; }
.done { color: #1e3a8a; }
.choices { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%; }
.choices button, .main {
  font: 600 22px/1.2 system-ui, sans-serif; padding: 14px; border-radius: 12px; border: 2px solid #c6cbec; background: #fff; color: #23264a;
}
.main { background: #4a5bd4; border-color: #4a5bd4; color: #fff; padding: 12px 28px; }
.field { width: min(520px, 90%); font: 500 26px/1.3 system-ui, sans-serif; padding: 10px 14px; border: 3px solid #c6cbec; border-radius: 12px; text-align: center; }
.verdict { margin: 0; text-align: center; font: 600 22px/1.3 system-ui, sans-serif; }
.verdict p { margin: 4px 0; }
.right { color: #1e7d3c; }
.wrong { color: #23264a; }
.answer { font-size: 30px; }
.mark { color: #b3261e; text-decoration: underline; }
.small { font: 400 16px/1.3 system-ui, sans-serif; color: #5a5f86; }
.rule { margin: 0; padding: 8px 16px; background: #fff8dc; border-radius: 10px; font: 500 18px/1.35 system-ui, sans-serif; color: #5a4a00; }
</style>
