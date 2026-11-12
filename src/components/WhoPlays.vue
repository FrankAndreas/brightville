<script setup lang="ts">
import type { Person } from '@/services/api'

// Without the family hub: who is playing? A big coloured circle per person, with the first letter
defineProps<{ people: Person[] }>()
const emit = defineEmits<{ choose: [id: number] }>()
</script>

<template>
  <div class="who" data-test="who-plays">
    <div class="people">
      <button
        v-for="p in people" :key="p.id" class="person" data-test="person" :data-id="p.id"
        @click="emit('choose', p.id)"
      >
        <span class="circle" :style="{ background: p.color ?? '#ff9a3c' }">{{ p.name.slice(0, 1).toUpperCase() }}</span>
        <span class="name">{{ p.name }}</span>
        <span v-if="p.role === 'PARENT'" class="gear" aria-hidden="true">⚙️</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.who { position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; background: #bfe7ff; }
.people { display: flex; flex-wrap: wrap; justify-content: center; gap: 5vw; padding: 24px; }
.person {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  border: 0;
  background: none;
  cursor: pointer;
  font: inherit;
}
.circle {
  width: min(26vw, 200px);
  aspect-ratio: 1;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #fff;
  font: 800 min(14vw, 110px) system-ui, sans-serif;
  border: 8px solid #fff;
  box-shadow: 0 10px 0 rgb(0 0 0 / 12%);
}
.person:active .circle { transform: translateY(6px); box-shadow: 0 4px 0 rgb(0 0 0 / 12%); }
.name { font: 700 clamp(18px, 3vw, 28px) system-ui, sans-serif; color: #2b4c7e; }
.gear { position: absolute; top: 0; right: 0; font-size: 40px; }
</style>
