<script setup lang="ts">
import { computed } from 'vue'
import { COACH_HINT } from '@/core/coach/words'
import type { Lang } from '@/core/vocab/types'
import { hasVoice, voiceCount } from '@/services/tts'
import { coachSay, COACH_VOICE } from './voice'

// The coach's current instruction, written in the language (with a title when there is one), a 🔊 that says it again
// in the language's voice, and under the first instruction of a visit the German hint.
const props = defineProps<{ lang: Lang; text: string; title?: string; first?: boolean }>()

const canSay = computed(() => {
  void voiceCount.value
  return hasVoice(COACH_VOICE[props.lang])
})
</script>

<template>
  <div class="coach-line" :lang="lang">
    <p v-if="title" class="title" data-test="coach-title">{{ title }}</p>
    <p class="say" data-test="coach-say">
      {{ text }}
      <button v-if="canSay" type="button" class="again" data-test="coach-again" aria-label="Nochmal hören" @click="coachSay(lang, text)">🔊</button>
    </p>
    <p v-if="first" class="hint" data-test="coach-hint" lang="de">{{ COACH_HINT }}</p>
  </div>
</template>

<style scoped>
.coach-line {
  display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px 18px; border-radius: 16px;
  background: rgba(255, 255, 255, 0.94); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12); text-align: center;
}
.title { margin: 0; font: 600 16px/1.2 system-ui, sans-serif; color: #5a5f86; text-transform: uppercase; letter-spacing: 0.05em; }
.say { margin: 0; font: 700 26px/1.3 system-ui, sans-serif; color: #23264a; }
.again { font-size: 24px; background: none; border: 0; vertical-align: middle; }
.hint { margin: 2px 0 0; font: 500 15px/1.2 system-ui, sans-serif; color: #5a5f86; }
</style>
