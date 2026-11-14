<script setup lang="ts">
// Her words and sentences as big cards, and a die for today's letters. The voice reads a card when she taps it
// (Schreiben says "Wir schreiben: …"), so nothing here needs reading.
defineProps<{ texts: string[] }>()
const emit = defineEmits<{ choose: [text: string | null] }>()
</script>

<template>
  <div class="menu">
    <button
      v-for="t in texts" :key="t" class="card" :class="{ long: t.length > 12 }" data-test="text-card"
      @click="emit('choose', t)"
    >{{ t }}</button>
    <button class="card dice" data-test="dice-card" aria-label="Heutige Buchstaben" @click="emit('choose', null)">🎲</button>
  </div>
</template>

<style scoped>
.menu {
  flex: 1;
  min-height: 0;
  width: min(100%, 1000px);
  display: flex;
  flex-wrap: wrap;
  align-content: center;
  justify-content: center;
  gap: 18px;
  overflow-y: auto;
  padding: 12px;
  box-sizing: border-box;
}
.card {
  min-width: 140px;
  min-height: 72px;
  max-width: 100%;
  padding: 16px 22px;
  font: 700 2rem/1.15 system-ui, sans-serif;
  letter-spacing: 0.08em;
  color: #4a3b2a;
  background: #fffdf8;
  border: 3px solid #e67e22;
  border-radius: 22px;
  box-shadow: 0 5px 0 #b35f12;
  cursor: pointer;
  overflow-wrap: anywhere;
}
.card.long { font-size: 1.5rem; }
.card:active { transform: translateY(3px); box-shadow: 0 2px 0 #b35f12; }
.dice { min-width: 96px; font-size: 2.6rem; letter-spacing: 0; border-color: #3fa7d6; box-shadow: 0 5px 0 #1f6f94; }
</style>
