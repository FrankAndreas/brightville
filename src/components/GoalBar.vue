<script setup lang="ts">
// Today's learning as slots that fill up, and what opens when they are full
defineProps<{ visits: number; goal: number; prize: string }>()
</script>

<template>
  <div class="goal" data-test="goal-bar" aria-hidden="true">
    <span v-for="n in goal" :key="n" class="slot" data-test="goal-slot" :data-done="n <= visits">
      <svg v-if="n <= visits" viewBox="0 0 24 24"><path d="M5 12.5 L10 17.5 L19 7.5" /></svg>
    </span>
    <span class="prize" data-test="goal-prize" :data-open="visits >= goal">{{ prize }}</span>
  </div>
</template>

<style scoped>
.goal { display: flex; align-items: center; gap: 8px; }
.slot {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 4px dashed #c9a800;
  box-sizing: border-box;
  display: grid;
  place-items: center;
}
.slot[data-done='true'] { border: 0; background: #4bd37b; animation: pop 0.4s ease; }
.slot path { fill: none; stroke: #fff; stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; }
.prize { font-size: 34px; line-height: 1; filter: grayscale(1); opacity: 0.45; transition: all 0.4s ease; }
.prize[data-open='true'] { filter: none; opacity: 1; transform: scale(1.15); }
@keyframes pop { 0% { transform: scale(0.3); } 70% { transform: scale(1.25); } }
</style>
