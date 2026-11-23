<script setup lang="ts">
import { ref } from 'vue'
import type { Lang } from '@/core/vocab/types'
import { useLaddersStore } from '@/stores/ladders'
import type { BuildingResult } from '../types'
import { useVisit } from '../visit'
import LanguagePick from '../vokabeln/LanguagePick.vue'
import SimonSays from './SimonSays.vue'

// The Tanzsaal at Oberstufe (docs/superpowers/specs/2026-11-22-brightville-oberstufe-coach-design.md): he picks the language,
// then "Simon says" / "Jacques a dit" with a coach in English or French.
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

const owner = useLaddersStore().who
const lang = ref<Lang | null>(null)
// Leaving on the language screen; once the game is open, it answers the leave button itself
const visit = useVisit(() => {
  if (visit.isClosed() || lang.value) return
  visit.shutDown()
  emit('finished', { stars: 0 })
})
</script>

<template>
  <div class="coach-room" data-test="coach-simon">
    <div v-if="!lang" class="pick"><LanguagePick :owner="owner" @pick="l => (lang = l)" /></div>
    <SimonSays v-else :lang="lang" @finished="r => emit('finished', r)" />
  </div>
</template>

<style scoped>
.coach-room { position: absolute; inset: 0; }
.pick {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; padding: 6vh 104px 16px;
  box-sizing: border-box; background: #2b2450;
}
</style>
