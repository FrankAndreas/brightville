<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import ProgressStars from '@/components/ProgressStars.vue'
import type { ListenItem } from '@/core/listen/round'
import type { Lang } from '@/core/vocab/types'
import { speakLines } from '@/services/tts'

// One listening scene on the screen: played once by itself, 🔊 again and 🐢 slowly as often as he likes; the German
// question and the four answers in their mixed order. After his answer the scene's text is shown, and "Weiter" goes
// on. `newRun`: the visit's numbered runs (visit.ts), so a replay, the next scene or leaving cuts off what was said.
const props = defineProps<{ item: ListenItem; lang: Lang; total: number; solved: number; newRun: () => () => boolean }>()
const emit = defineEmits<{ answer: [right: boolean]; next: [] }>()

const VOICE: Record<Lang, string> = { en: 'en-GB', fr: 'fr-FR' }
/** 🐢: the speech rate of a slow replay */
const SLOW_RATE = 0.6

const picked = ref<number | null>(null)
const answered = computed(() => picked.value !== null)
const right = computed(() => picked.value === props.item.scene.right)
/** The scene's lines with their speakers apart, for reading after the answer */
const text = computed(() => props.item.scene.lines.map(line => {
  const m = /^([AB]): (.*)$/.exec(line)
  return m ? { who: m[1], said: m[2] } : { who: '', said: line }
}))

function play(slow = false) {
  void speakLines(props.item.scene.lines, VOICE[props.lang], slow ? { rate: SLOW_RATE } : {}, props.newRun())
}

function choose(index: number) {
  if (answered.value) return
  picked.value = index
  emit('answer', index === props.item.scene.right)
}

watch(() => props.item, () => {
  picked.value = null
  play()
}, { immediate: true })
</script>

<template>
  <div class="round" data-test="round">
    <ProgressStars :total="total" :solved="solved" :size="30" />
    <div class="ears">
      <button type="button" data-test="again" @click="play()">🔊 Nochmal</button>
      <button type="button" data-test="slow" @click="play(true)">🐢 Langsam</button>
    </div>
    <p class="question" data-test="question">{{ item.scene.question }}</p>
    <div class="answers">
      <button
        v-for="i in item.order" :key="i" type="button" data-test="answer" :disabled="answered"
        :class="{ right: answered && i === item.scene.right, wrong: picked === i && !right }" @click="choose(i)"
      >
        {{ item.scene.answers[i] }}
      </button>
    </div>
    <template v-if="answered">
      <p class="verdict" :class="right ? 'ok' : 'miss'" data-test="verdict">
        {{ right ? 'Richtig!' : `Es war: ${item.scene.answers[item.scene.right]}` }}
      </p>
      <div class="text" data-test="text" :lang="lang">
        <p v-for="(l, i) in text" :key="i"><b v-if="l.who">{{ l.who }}:</b> {{ l.said }}</p>
      </div>
      <button type="button" class="main" data-test="next" @click="emit('next')">Weiter</button>
    </template>
  </div>
</template>

<style scoped>
.round { display: flex; flex-direction: column; align-items: center; gap: 14px; width: 100%; max-width: 760px; }
.ears { display: flex; gap: 14px; }
.ears button, .answers button, .main {
  font: 600 22px/1.2 system-ui, sans-serif; padding: 14px 22px; border-radius: 12px; border: 2px solid #c6cbec; background: #fff; color: #23264a;
}
.question { margin: 6px 0 0; font: 700 28px/1.25 system-ui, sans-serif; color: #23264a; text-align: center; }
.answers { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%; }
.answers button:disabled { opacity: 0.6; }
.answers button.right { opacity: 1; border-color: #1e7d3c; background: #e5f5ea; }
.answers button.wrong { opacity: 1; border-color: #b3261e; background: #fbe9e7; }
.verdict { margin: 0; font: 600 22px/1.3 system-ui, sans-serif; }
.ok { color: #1e7d3c; }
.miss { color: #23264a; }
.text { background: #fff; border-radius: 12px; padding: 8px 18px; font: 500 20px/1.4 system-ui, sans-serif; color: #23264a; }
.text p { margin: 6px 0; }
.main { background: #4a5bd4; border-color: #4a5bd4; color: #fff; padding: 12px 28px; }
</style>
