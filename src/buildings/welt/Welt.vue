<script setup lang="ts">
import { ref } from 'vue'
import type { Lang } from '@/core/vocab/types'
import { useLaddersStore } from '@/stores/ladders'
import Spielwelt from '../spielwelt/Spielwelt.vue'
import type { BuildingResult } from '../types'
import { useVisit } from '../visit'
import LanguagePick from '../vokabeln/LanguagePick.vue'

// The Spielwelt at Oberstufe (docs/superpowers/specs/2026-11-22-brightville-oberstufe-coach-design.md): he picks the
// language, then the same world, with its five tasks given in English or French, spoken and written.
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

const owner = useLaddersStore().who
const lang = ref<Lang | null>(null)

// Leaving on the language screen; once the world is open, it answers the leave button itself
const visit = useVisit(() => {
  if (visit.isClosed() || lang.value) return
  visit.shutDown()
  emit('finished', { stars: 0 })
})
</script>

<template>
  <div class="welt" data-test="welt">
    <div v-if="!lang" class="pick">
      <LanguagePick :owner="owner" @pick="l => (lang = l)" />
    </div>
    <Spielwelt v-else :lang="lang" @finished="r => emit('finished', r)" />
  </div>
</template>

<style scoped>
.welt { position: absolute; inset: 0; }
.pick {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; padding: 6vh 104px 16px;
  box-sizing: border-box; background: #eaf5ff;
}
</style>
