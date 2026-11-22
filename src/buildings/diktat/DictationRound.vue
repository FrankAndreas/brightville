<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ProgressStars from '@/components/ProgressStars.vue'
import { answersOf } from '@/core/vocab/answer'
import type { Lang } from '@/core/vocab/types'
import { speak } from '@/services/tts'
import AccentKeys from '../vokabeln/AccentKeys.vue'
import type { createRoundFlow } from '../vokabeln/roundFlow'

// One dictation on the screen: the word is spoken (its first answer, in its own voice only), 🔊 says it again, 🐢 says
// it slowly; nothing of it is written until he answered. Then the word and its German are shown; after a miss he types
// it out to go on (the round flow brings it back once at the end).
const props = defineProps<{ flow: ReturnType<typeof createRoundFlow>; lang: Lang }>()

const VOICE: Record<Lang, string> = { en: 'en-GB', fr: 'fr-FR' }
const LANG_NAME: Record<Lang, string> = { en: 'Englisch', fr: 'Französisch' }
/** 🐢: the speech rate of a slow repeat */
const SLOW_RATE = 0.6

const state = computed(() => props.flow.state)
const item = computed(() => state.value.item)
const typed = ref('')
const field = ref<HTMLInputElement | null>(null)

const word = computed(() => (item.value ? answersOf(item.value.word.foreign)[0] ?? '' : ''))
const solved = computed(() => state.value.firstTry.filter(f => f.right).length)

function say(slow = false) {
  if (!word.value) return
  void speak(word.value, VOICE[props.lang], slow ? { rate: SLOW_RATE } : undefined)
}

/** The right spelling, letter by letter, with the letters whose accent was off marked */
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
    focusField()
  }
}

function next() {
  props.flow.next()
  typed.value = ''
}

// By position, not by word: a word missed last comes back as the same item, and is spoken again too
watch(() => state.value.index, () => {
  if (state.value.phase !== 'asking') return
  say()
  focusField()
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
    <p class="hint">Hör zu und schreib das Wort auf {{ LANG_NAME[lang] }}.</p>
    <div class="ears">
      <button type="button" data-test="again" @click="say()">🔊 Nochmal</button>
      <button type="button" data-test="slow" @click="say(true)">🐢 Langsam</button>
    </div>

    <div v-if="state.phase === 'right'" class="verdict right" data-test="verdict">
      <p>Richtig!</p>
    </div>
    <div v-if="state.phase === 'wrong'" class="verdict wrong" data-test="verdict">
      <p>{{ state.checked?.verdict === 'accent' ? 'Fast – achte auf die Akzente:' : 'So schreibt man es:' }}</p>
    </div>
    <div v-if="state.phase !== 'asking'" class="shown" data-test="shown">
      <p class="answer"><span v-for="(l, i) in shownLetters" :key="i" :class="{ mark: l.marked }">{{ l.letter }}</span></p>
      <p class="de">{{ item?.word.de }}</p>
      <p v-if="state.phase === 'wrong'" class="small">Schreib es ab, dann geht es weiter.</p>
    </div>

    <input
      ref="field" v-model="typed" class="field" data-test="answer" autocomplete="off" autocapitalize="off" autocorrect="off"
      spellcheck="false" enterkeyhint="go" :readonly="state.phase === 'right'" @keydown.enter.prevent="submit"
    >
    <template v-if="state.phase !== 'right'">
      <AccentKeys v-if="lang === 'fr'" :target="field" />
      <button type="button" class="main" data-test="check" @click="submit">Prüfen</button>
    </template>
    <button v-else type="button" class="main" data-test="next" @click="next">Weiter</button>
  </div>
</template>

<style scoped>
.round { display: flex; flex-direction: column; align-items: center; gap: 14px; width: 100%; max-width: 760px; }
.hint { margin: 0; font: 500 19px/1.3 system-ui, sans-serif; color: #5a5f86; }
.ears { display: flex; gap: 14px; }
.ears button, .main {
  font: 600 22px/1.2 system-ui, sans-serif; padding: 14px 22px; border-radius: 12px; border: 2px solid #c6cbec; background: #fff; color: #23264a;
}
.main { background: #4a5bd4; border-color: #4a5bd4; color: #fff; padding: 12px 28px; }
.field { width: min(520px, 90%); font: 500 26px/1.3 system-ui, sans-serif; padding: 10px 14px; border: 3px solid #c6cbec; border-radius: 12px; text-align: center; }
.verdict, .shown { text-align: center; font: 600 22px/1.3 system-ui, sans-serif; }
.verdict p, .shown p { margin: 4px 0; }
.right { color: #1e7d3c; }
.wrong { color: #23264a; }
.answer { font-size: 34px; color: #23264a; }
.de { font: 500 20px/1.3 system-ui, sans-serif; color: #5a5f86; }
.mark { color: #b3261e; text-decoration: underline; }
.small { font: 400 16px/1.3 system-ui, sans-serif; color: #5a5f86; }
</style>
