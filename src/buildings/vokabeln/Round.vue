<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ProgressStars from '@/components/ProgressStars.vue'
import { answersOf } from '@/core/vocab/answer'
import type { Lang } from '@/core/vocab/types'
import { hasVoice, speak } from '@/services/tts'
import AccentKeys from './AccentKeys.vue'
import type { createRoundFlow } from './roundFlow'

// One round on the screen: the word, the choices or the field, what was right, and the right answer to type out after
// a miss. Written German; the foreign words are spoken in their own voice only (never a German one).
const props = defineProps<{ flow: ReturnType<typeof createRoundFlow>; lang: Lang }>()

const VOICE: Record<Lang, string> = { en: 'en-GB', fr: 'fr-FR' }
const LANG_NAME: Record<Lang, string> = { en: 'Englisch', fr: 'Französisch' }

const state = computed(() => props.flow.state)
const item = computed(() => state.value.item)
const typed = ref('')
const field = ref<HTMLInputElement | null>(null)

const foreign = computed(() => (item.value ? answersOf(item.value.word.foreign)[0] ?? '' : ''))
const prompt = computed(() => (item.value?.mode === 'type-foreign' ? foreign.value : item.value?.word.de ?? ''))
const hint = computed(() => {
  if (item.value?.mode === 'choice') return `Welches Wort ist das auf ${LANG_NAME[props.lang]}?`
  if (item.value?.mode === 'type-de') return `Schreib es auf ${LANG_NAME[props.lang]}.`
  return 'Schreib es auf Deutsch.'
})
/** The foreign word is on the screen: asked as it, or answered */
const foreignShown = computed(() => item.value?.mode === 'type-foreign' || state.value.phase !== 'asking')
const showField = computed(() => (item.value?.mode !== 'choice' && state.value.phase === 'asking') || state.value.phase === 'wrong')
const solved = computed(() => state.value.firstTry.filter(f => f.right).length)
const canSay = computed(() => hasVoice(VOICE[props.lang]))

function say() {
  if (foreignShown.value && canSay.value) void speak(foreign.value, VOICE[props.lang])
}

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
    say()
    if (state.value.phase === 'wrong') focusField()
  }
}

function choose(choice: string) {
  props.flow.choose(choice)
  say()
  if (state.value.phase === 'wrong') focusField()
}

function next() {
  props.flow.next()
  typed.value = ''
}

watch(item, () => {
  if (item.value?.mode === 'type-foreign') say()
  if (showField.value) focusField()
}, { immediate: true })

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && e.target !== field.value && state.value.phase === 'right') next()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="round" data-test="round">
    <ProgressStars :total="state.total" :solved="solved" :size="30" />
    <p class="hint">{{ hint }}</p>
    <div class="word">
      <span data-test="prompt">{{ prompt }}</span>
      <button v-if="foreignShown && canSay" type="button" class="say" data-test="say" aria-label="Nochmal hören" @click="say">🔊</button>
    </div>

    <div v-if="item?.mode === 'choice' && state.phase === 'asking'" class="choices">
      <button v-for="c in item.choices" :key="c" type="button" data-test="choice" @click="choose(c)">{{ c }}</button>
    </div>

    <p v-if="state.phase === 'right'" class="verdict right" data-test="verdict">
      Richtig! <template v-if="state.checked">{{ state.checked.shown }}</template>
    </p>
    <div v-if="state.phase === 'wrong'" class="verdict wrong" data-test="verdict">
      <p>{{ state.checked?.verdict === 'accent' ? 'Fast – achte auf die Akzente:' : 'Richtig wäre:' }}</p>
      <p class="answer"><span v-for="(l, i) in shownLetters" :key="i" :class="{ mark: l.marked }">{{ l.letter }}</span></p>
      <p class="small">Schreib es ab, dann geht es weiter.</p>
    </div>

    <template v-if="showField">
      <input
        ref="field" v-model="typed" class="field" data-test="answer" autocomplete="off" autocapitalize="off" autocorrect="off"
        spellcheck="false" enterkeyhint="go" @keydown.enter.prevent="submit"
      >
      <AccentKeys v-if="lang === 'fr' && item?.mode !== 'type-foreign'" :target="field" />
      <button type="button" class="main" data-test="check" @click="submit">Prüfen</button>
    </template>
    <button v-if="state.phase === 'right'" type="button" class="main" data-test="next" @click="next">Weiter</button>
  </div>
</template>

<style scoped>
.round { display: flex; flex-direction: column; align-items: center; gap: 14px; width: 100%; max-width: 760px; }
.hint { margin: 0; font: 500 19px/1.3 system-ui, sans-serif; color: #5a5f86; }
.word { display: flex; align-items: center; gap: 12px; font: 700 40px/1.2 system-ui, sans-serif; color: #23264a; text-align: center; }
.say { font-size: 30px; background: none; border: 0; }
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
</style>
