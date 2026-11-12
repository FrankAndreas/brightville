<script setup lang="ts">
import { ref } from 'vue'
import StarCounter from '@/components/StarCounter.vue'
import StartGate from '@/components/StartGate.vue'
import { unlockAudio } from '@/services/sound'

const started = ref(false)

function start() {
  unlockAudio()
  started.value = true
}
</script>

<template>
  <StartGate v-if="!started" @start="start" />
  <main v-else class="game" data-test="game">
    <StarCounter />
  </main>
</template>

<style>
html, body, #app { height: 100%; margin: 0; overflow: hidden; }
body { background: #bfe7ff; font-family: system-ui, sans-serif; touch-action: none; user-select: none; }
.game { position: fixed; inset: 0; }
</style>
