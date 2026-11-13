<script setup lang="ts">
import type { Direction } from '@/core/direction'

defineProps<{ color?: string }>()
const emit = defineEmits<{ dir: [dir: Direction] }>()

const BUTTONS: { dir: Direction; icon: string; label: string }[] = [
  { dir: 'up', icon: '▲', label: 'Hoch' },
  { dir: 'left', icon: '◀', label: 'Links' },
  { dir: 'right', icon: '▶', label: 'Rechts' },
  { dir: 'down', icon: '▼', label: 'Runter' },
]
</script>

<template>
  <!-- pointerdown reacts at once; stop keeps a tap on the pad from counting as a swipe -->
  <div class="pad" :style="{ '--c': color ?? '#9b59b6' }">
    <button
      v-for="b in BUTTONS" :key="b.dir" :class="['arrow', b.dir]" data-test="arrow" :data-dir="b.dir"
      :aria-label="b.label" @pointerdown.prevent.stop="emit('dir', b.dir)"
    >{{ b.icon }}</button>
  </div>
</template>

<style scoped>
.pad {
  display: grid;
  grid-template-columns: repeat(3, 72px);
  grid-template-rows: repeat(3, 72px);
  gap: 6px;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}
.arrow {
  background: var(--c);
  color: white;
  font-size: 1.8rem;
  border: none;
  border-radius: 18px;
  box-shadow: 0 4px 0 rgba(0, 0, 0, 0.2);
  touch-action: none;
}
.arrow:active { transform: translateY(3px); box-shadow: 0 1px 0 rgba(0, 0, 0, 0.2); }
.up { grid-column: 2; grid-row: 1; }
.left { grid-column: 1; grid-row: 2; }
.right { grid-column: 3; grid-row: 2; }
.down { grid-column: 2; grid-row: 3; }
</style>
