<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import ProgressStars from '@/components/ProgressStars.vue'
import { kindOf } from '@/core/dates/round'
import { answersOf } from '@/core/vocab/answer'
import type { Lang } from '@/core/vocab/types'
import { hasVoice, speak, voiceCount } from '@/services/tts'
import ClockFace from '../kalender/ClockFace.vue'
import AccentKeys from '../vokabeln/AccentKeys.vue'
import type { createRoundFlow } from '../vokabeln/roundFlow'

// One task of a dates round on the screen, by its kind: a clock to read, a time or date heard (or read, without a
// voice) to find among four clocks or dates, a date to write, a day or month to spell. Picked while the kind is new,
// typed once he knows it. A wrong pick marks the right one; a wrong typed answer is typed out. Either way the task
// comes back once at the end.
const props = defineProps<{ flow: ReturnType<typeof createRoundFlow>; lang: Lang }>()

const VOICE: Record<Lang, string> = { en: 'en-GB', fr: 'fr-FR' }
const INSTRUCTION: Record<string, string> = {
  'clock-words': 'Wie sagt man diese Uhrzeit?',
  'words-clock': 'Welche Uhr zeigt diese Zeit?',
  'words-date': 'Welches Datum ist das?',
  'date-words': 'Schreib das Datum in Worten.',
  spelling: 'Wie heisst das?',
}

const state = computed(() => props.flow.state)
const item = computed(() => state.value.item)
const kind = computed(() => (item.value ? kindOf(item.value.word.key) : 'spelling'))
const heard = computed(() => kind.value === 'words-clock' || kind.value === 'words-date')
const canSay = computed(() => {
  void voiceCount.value
  return hasVoice(VOICE[props.lang])
})
/** The words of a time or date to recognise: said when there is a voice, and then only shown after the answer */
const showPrompt = computed(() => !heard.value || !canSay.value || state.value.phase !== 'asking')
const right = computed(() => (item.value ? answersOf(item.value.word.foreign)[0] ?? '' : ''))
const clockOf = (text: string) => {
  const [h, m] = text.split(':').map(Number)
  return { clock: { hour: h, half: false }, minute: m }
}

const typed = ref('')
const field = ref<HTMLInputElement | null>(null)
const picked = ref<string | null>(null)
/** This task was answered wrong first (shown until "Weiter") */
const missed = ref(false)
const solved = computed(() => state.value.firstTry.filter(f => f.right).length)

function say() {
  if (item.value && heard.value && canSay.value) void speak(item.value.word.de, VOICE[props.lang])
}

function focusField() {
  void nextTick(() => field.value?.focus())
}

function choose(choice: string) {
  if (state.value.phase !== 'asking') return
  picked.value = choice
  props.flow.choose(choice)
  // A clock or a date can't be typed out: the right one is marked, and he goes on
  if ((state.value.phase as string) === 'wrong') {
    missed.value = true
    props.flow.retype(right.value)
  }
}

function submit() {
  const phase = state.value.phase
  if (phase === 'asking') props.flow.answer(typed.value)
  else if (phase === 'wrong') props.flow.retype(typed.value)
  else if (phase === 'right') return next()
  if (state.value.phase !== phase) {
    if (state.value.phase === 'wrong') missed.value = true
    typed.value = ''
    focusField()
  }
}

function next() {
  props.flow.next()
  typed.value = ''
  picked.value = null
  missed.value = false
}

watch(() => state.value.index, () => {
  if (state.value.phase !== 'asking') return
  say()
  if (item.value?.mode !== 'choice') focusField()
}, { immediate: true })

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && e.target !== field.value && state.value.phase === 'right') next()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div v-if="item" class="round" data-test="round" :data-kind="kind">
    <ProgressStars :total="state.total" :solved="solved" :size="30" />
    <p class="hint">{{ INSTRUCTION[kind] }}</p>

    <div v-if="kind === 'clock-words'" class="prompt-clock" data-test="prompt-clock">
      <ClockFace v-bind="clockOf(item.word.de)" />
    </div>
    <p v-else-if="showPrompt" class="prompt" data-test="prompt" :lang="heard || kind === 'spelling' ? undefined : lang">{{ item.word.de }}</p>
    <button v-if="heard && canSay" type="button" class="again" data-test="again" @click="say">🔊 Nochmal</button>

    <div v-if="item.mode === 'choice'" class="choices" :class="{ clocks: kind === 'words-clock' }">
      <button
        v-for="c in item.choices" :key="c" type="button" data-test="choice" :data-value="c"
        :disabled="state.phase !== 'asking'"
        :class="{ right: state.phase !== 'asking' && c === right, wrong: picked === c && c !== right }"
        @click="choose(c)"
      >
        <span v-if="kind === 'words-clock'" class="mini-clock"><ClockFace v-bind="clockOf(c)" /></span>
        <template v-else>{{ c }}</template>
      </button>
    </div>
    <template v-else>
      <input
        ref="field" v-model="typed" class="field" data-test="answer" autocomplete="off" autocapitalize="off" autocorrect="off"
        spellcheck="false" enterkeyhint="go" :readonly="state.phase === 'right'" @keydown.enter.prevent="submit"
      >
      <template v-if="state.phase !== 'right'">
        <AccentKeys v-if="lang === 'fr'" :target="field" />
        <button type="button" class="main" data-test="check" @click="submit">Prüfen</button>
      </template>
    </template>

    <div v-if="state.phase !== 'asking'" class="verdict" data-test="verdict">
      <p v-if="!missed" class="ok">Richtig!</p>
      <p v-if="kind !== 'words-clock' && kind !== 'words-date'" class="shown" data-test="shown">{{ state.checked?.shown ?? right }}</p>
      <p v-if="state.phase === 'wrong'" class="small">Schreib es ab, dann geht es weiter.</p>
    </div>
    <button v-if="state.phase === 'right'" type="button" class="main" data-test="next" @click="next">Weiter</button>
  </div>
</template>

<style scoped>
.round { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; max-width: 760px; }
.hint { margin: 0; font: 500 19px/1.3 system-ui, sans-serif; color: #5a5f86; }
.prompt-clock { width: 180px; height: 180px; }
.prompt { margin: 0; font: 700 34px/1.25 system-ui, sans-serif; color: #23264a; text-align: center; }
.again { font: 600 20px/1.2 system-ui, sans-serif; padding: 10px 18px; border-radius: 12px; border: 2px solid #c6cbec; background: #fff; color: #23264a; }
.choices { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%; }
.choices.clocks { grid-template-columns: repeat(4, 1fr); }
.choices button, .main {
  font: 600 21px/1.2 system-ui, sans-serif; padding: 12px; border-radius: 12px; border: 2px solid #c6cbec; background: #fff; color: #23264a;
}
.choices button:disabled { opacity: 0.6; }
.choices button.right { opacity: 1; border-color: #1e7d3c; background: #e5f5ea; }
.choices button.wrong { opacity: 1; border-color: #b3261e; background: #fbe9e7; }
.mini-clock { display: block; width: 110px; height: 110px; margin: 0 auto; }
.field { width: min(520px, 90%); font: 500 26px/1.3 system-ui, sans-serif; padding: 10px 14px; border: 3px solid #c6cbec; border-radius: 12px; text-align: center; }
.main { background: #4a5bd4; border-color: #4a5bd4; color: #fff; padding: 12px 28px; }
.verdict { text-align: center; font: 600 22px/1.3 system-ui, sans-serif; color: #23264a; }
.verdict p { margin: 4px 0; }
.ok { color: #1e7d3c; }
.shown { font-size: 26px; }
.small { font: 400 16px/1.3 system-ui, sans-serif; color: #5a5f86; }
</style>
