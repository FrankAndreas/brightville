<script setup lang="ts">
import { computed } from 'vue'
import type { Point, ViewBox } from '@/core/writing/letters'

// Her word or sentence along the top: each letter she wrote in her own lines, the one she writes now
// highlighted, the ones still to come as plain letters, and a gap between words.
const props = defineProps<{
  text: string
  /** Her lines for each letter written so far, in letter space */
  inks: Point[][][]
  /** The letter being written now (spaces not counted) */
  current: number
  view: ViewBox
}>()

/** The words, each a list of its letters with their place among all letters; a word never breaks across rows */
const words = computed(() => {
  let n = 0
  return props.text.split(' ').map(word => [...word].map(c => ({ c, n: n++ })))
})
const box = computed(() => `${props.view.x} ${props.view.y} ${props.view.width} ${props.view.height}`)
const points = (line: Point[]) => line.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
</script>

<template>
  <div class="ink-row" data-test="ink-row" aria-hidden="true">
    <template v-for="(word, w) in words" :key="w">
      <span v-if="w > 0" class="gap" data-test="ink-gap" />
      <span class="word">
        <span
          v-for="s in word" :key="s.n" class="slot" data-test="ink-slot"
          :data-done="s.n < inks.length" :data-current="s.n === current"
        >
          <svg v-if="s.n < inks.length" :viewBox="box">
            <polyline v-for="(line, k) in inks[s.n]" :key="k" :points="points(line)" />
          </svg>
          <span v-else>{{ s.c }}</span>
        </span>
      </span>
    </template>
  </div>
</template>

<style scoped>
.ink-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  row-gap: 6px;
  /* Clear of the leave and 🔊 buttons in the top left corner, centred */
  max-width: min(calc(100% - 2 * 150px), 1000px);
}
.slot {
  width: 40px;
  height: 48px;
  display: grid;
  place-items: center;
  font: 700 1.6rem system-ui, sans-serif;
  color: #c9b79c;
  background: rgb(255 255 255 / 70%);
  border: 2px solid #f0dcc0;
  border-radius: 12px;
  box-sizing: border-box;
}
.slot[data-current='true'] { border-color: #e67e22; color: #e67e22; transform: scale(1.08); }
.slot[data-done='true'] { background: #fffdf8; border-color: #7ed957; }
.slot svg { width: 100%; height: 100%; }
.slot polyline { fill: none; stroke: #2c3e50; stroke-width: 9; stroke-linecap: round; stroke-linejoin: round; }
/* A word stays on one row, unless it alone is wider than the row */
.word { display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; max-width: 100%; }
.gap { width: 14px; }
</style>
