<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import CharacterView from '@/components/CharacterView.vue'
import {
  BODY_COLORS, GLASSES, HAIR_COLORS, HAIR_STYLES, randomLook, type Dress, type Glasses, type HairStyle, type Look,
} from '@/core/look'
import { instruct } from '@/services/tts'

// She designs her wobbly character (stage 7): on the first visit, and from the wardrobe. Free; nothing to read.
const props = defineProps<{ start: Look }>()
const emit = defineEmits<{ done: [look: Look] }>()

const look = ref<Look>({ ...props.start })
const dress = computed<Dress>(() => ({ look: look.value, worn: {} }))

// Pictures for the hair and glasses buttons
const HAIR_ICON: Record<HairStyle, string> = { none: '🚫', spiky: '🦔', ponytail: '🎀', buns: '🍡', curly: '🌀' }
const GLASSES_ICON: Record<Glasses, string> = { none: '🚫', round: '👓', star: '⭐', heart: '💗' }

function set<K extends keyof Look>(key: K, value: Look[K]) {
  look.value = { ...look.value, [key]: value }
}

onMounted(() => void instruct('So siehst du aus! Tipp auf die Farben und Haare, dann auf den Haken.'))
</script>

<template>
  <div class="look" data-test="look-screen">
    <div class="stage">
      <CharacterView :dress="dress" :size="300" />
      <div class="actions">
        <button class="round" data-test="look-random" aria-label="Zufall" @click="look = randomLook()">🎲</button>
        <button class="round done" data-test="look-done" aria-label="Fertig" @click="emit('done', look)">✔️</button>
      </div>
    </div>
    <div class="rows">
      <div class="row" aria-label="Farbe">
        <button
          v-for="c in BODY_COLORS" :key="c" class="swatch" data-test="look-body" :data-chosen="look.body === c"
          :style="{ background: c }" :aria-label="c" @click="set('body', c)"
        />
      </div>
      <div class="row" aria-label="Haare">
        <button
          v-for="h in HAIR_STYLES" :key="h" class="pick" data-test="look-hair" :data-chosen="look.hair === h"
          :aria-label="h" @click="set('hair', h)"
        >{{ HAIR_ICON[h] }}</button>
      </div>
      <div class="row" aria-label="Haarfarbe">
        <button
          v-for="c in HAIR_COLORS" :key="c" class="swatch small" data-test="look-hair-color" :data-chosen="look.hairColor === c"
          :style="{ background: c }" :aria-label="c" @click="set('hairColor', c)"
        />
      </div>
      <div class="row" aria-label="Brille">
        <button
          v-for="g in GLASSES" :key="g" class="pick" data-test="look-glasses" :data-chosen="look.glasses === g"
          :aria-label="g" @click="set('glasses', g)"
        >{{ GLASSES_ICON[g] }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.look {
  position: fixed;
  inset: 0;
  z-index: 15;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4vw;
  padding: calc(16px + env(safe-area-inset-top)) 16px 16px;
  box-sizing: border-box;
  background: linear-gradient(#bfe7ff, #fff3c4);
}
.stage { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.actions { display: flex; gap: 18px; }
.round {
  width: 76px;
  height: 76px;
  border: 0;
  border-radius: 50%;
  background: white;
  font-size: 38px;
  box-shadow: 0 5px 0 rgb(0 0 0 / 12%);
  cursor: pointer;
}
.done { background: #4bd37b; }
.rows { display: flex; flex-direction: column; gap: 18px; }
.row { display: flex; flex-wrap: wrap; gap: 10px; max-width: min(62vw, 560px); }
.swatch, .pick {
  width: 58px;
  height: 58px;
  border-radius: 50%;
  border: 4px solid white;
  box-shadow: 0 4px 0 rgb(0 0 0 / 12%);
  cursor: pointer;
  font-size: 30px;
  background: white;
  padding: 0;
}
.swatch.small { width: 48px; height: 48px; }
[data-chosen='true'] { border-color: #333; transform: scale(1.12); }

@media (max-aspect-ratio: 1 / 1) {
  .look { flex-direction: column; }
  .row { max-width: 92vw; justify-content: center; }
}
</style>
