<script setup lang="ts">
// A learning building's row of stars at the top: one per task of the visit, filled as she solves them. `edge`: the
// empty stars' outline, in the building's own colour; `size`: a star's width in px. `big`: the visit is over, and the
// card is empty: the stars show large in the middle instead.
withDefaults(
  defineProps<{ total: number; solved: number; edge?: string; size?: number; big?: boolean }>(),
  { edge: '#c6cbec', size: 46, big: false },
)
const BIG = 96
</script>

<template>
  <div class="progress" :data-big="big" aria-hidden="true">
    <svg
      v-for="n in total" :key="n" viewBox="0 0 24 24" data-test="progress-star" :data-done="n <= solved"
      :style="{ width: `${big ? BIG : size}px` }"
    >
      <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" :stroke="edge" />
    </svg>
  </div>
</template>

<style scoped>
.progress { display: flex; gap: 14px; }
.progress[data-big='true'] {
  position: fixed;
  inset: 0;
  z-index: 5;
  align-items: center;
  justify-content: center;
  gap: 24px;
  pointer-events: none;
}
.progress path { fill: rgb(255 255 255 / 70%); stroke-width: 1.2; stroke-linejoin: round; transition: fill 0.3s ease; }
.progress svg[data-done='true'] path { fill: #ffd93d; stroke: #e0a800; }
.progress svg[data-done='true'] { animation: pop 0.5s ease; }
@keyframes pop { 0% { transform: scale(0.3); } 70% { transform: scale(1.3); } }
</style>
