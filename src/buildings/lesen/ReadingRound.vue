<script setup lang="ts">
import { computed, ref } from 'vue'
import ProgressStars from '@/components/ProgressStars.vue'
import { segments } from '@/core/reading/rules'
import type { ReadingText } from '@/core/reading/texts'
import type { Lang } from '@/core/vocab/types'
import { hasVoice, speak, voiceCount } from '@/services/tts'

// One text on the screen: its title and sentences (each glossary word a button that shows its German, 🔊 per sentence
// when the device has a voice for the language), and below it the current question with its four answers in their
// mixed order. After the answer: right or wrong (the right one marked) and "Weiter".
const props = defineProps<{
  textKey: string
  text: ReadingText
  lang: Lang
  index: number
  order: number[]
  picked: number | null
  rights: boolean[]
}>()
const emit = defineEmits<{ answer: [index: number]; next: [] }>()

const VOICE: Record<Lang, string> = { en: 'en-GB', fr: 'fr-FR' }

const parts = computed(() => props.text.sentences.map(s => segments(s, props.text.glossary)))
/** The glossary words tapped open, by sentence and part */
const open = ref(new Set<string>())
function toggle(at: string) {
  const next = new Set(open.value)
  if (next.has(at)) next.delete(at)
  else next.add(at)
  open.value = next
}
const canSay = computed(() => {
  void voiceCount.value
  return hasVoice(VOICE[props.lang])
})

const question = computed(() => props.text.questions[props.index])
const answered = computed(() => props.picked !== null)
</script>

<template>
  <div class="reading" data-test="reading" :data-text="textKey">
    <ProgressStars :total="text.questions.length" :solved="rights.filter(Boolean).length" :size="26" />
    <article class="text" :lang="lang">
      <h2>{{ text.title }}</h2>
      <p v-for="(sentence, s) in parts" :key="s" class="sentence">
        <template v-for="(part, p) in sentence" :key="p">
          <span v-if="!('de' in part)">{{ part.text }}</span>
          <span v-else class="word">
            <button type="button" class="gloss" data-test="gloss" :class="{ open: open.has(`${s}:${p}`) }" @click="toggle(`${s}:${p}`)">{{ part.text }}</button>
            <span v-if="open.has(`${s}:${p}`)" class="de" data-test="gloss-de" lang="de">{{ part.de }}</span>
          </span>
        </template>
        <button v-if="canSay" type="button" class="say" data-test="say" aria-label="Vorlesen" @click="speak(text.sentences[s], VOICE[lang])">🔊</button>
      </p>
    </article>

    <section v-if="question" class="ask">
      <p class="question" data-test="question">{{ question.question }}</p>
      <div class="answers">
        <button
          v-for="i in order" :key="i" type="button" data-test="answer" :disabled="answered"
          :class="{ right: answered && i === question.right, wrong: picked === i && i !== question.right }" @click="emit('answer', i)"
        >
          {{ question.answers[i] }}
        </button>
      </div>
      <template v-if="answered">
        <p class="verdict" :class="picked === question.right ? 'ok' : 'miss'" data-test="verdict">
          {{ picked === question.right ? 'Richtig!' : `Richtig wäre: ${question.answers[question.right]}` }}
        </p>
        <button type="button" class="main" data-test="next" @click="emit('next')">Weiter</button>
      </template>
    </section>
  </div>
</template>

<style scoped>
.reading { display: flex; flex-direction: column; align-items: center; gap: 12px; width: 100%; max-width: 820px; }
.text { width: 100%; background: #fff; border-radius: 14px; padding: 12px 22px; box-sizing: border-box; color: #23264a; }
.text h2 { margin: 4px 0 8px; font: 700 26px/1.25 system-ui, sans-serif; }
.sentence { margin: 6px 0; font: 400 21px/1.55 system-ui, sans-serif; }
.word { white-space: nowrap; }
.gloss { font: inherit; color: inherit; background: none; border: 0; padding: 0; border-bottom: 2px dotted #4a5bd4; cursor: pointer; }
.gloss.open { background: #eef0ff; }
.de { margin-left: 4px; padding: 1px 6px; border-radius: 6px; background: #fff3c4; font-size: 17px; color: #5a4a00; }
.say { font-size: 18px; background: none; border: 0; padding: 0 0 0 6px; }
.ask { width: 100%; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.question { margin: 4px 0 0; font: 700 24px/1.3 system-ui, sans-serif; color: #23264a; text-align: center; }
.answers { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%; }
.answers button, .main {
  font: 600 20px/1.2 system-ui, sans-serif; padding: 12px; border-radius: 12px; border: 2px solid #c6cbec; background: #fff; color: #23264a;
}
.answers button:disabled { opacity: 0.6; }
.answers button.right { opacity: 1; border-color: #1e7d3c; background: #e5f5ea; }
.answers button.wrong { opacity: 1; border-color: #b3261e; background: #fbe9e7; }
.verdict { margin: 0; font: 600 21px/1.3 system-ui, sans-serif; }
.ok { color: #1e7d3c; }
.miss { color: #23264a; }
.main { background: #4a5bd4; border-color: #4a5bd4; color: #fff; padding: 12px 28px; }
</style>
