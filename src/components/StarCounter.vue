<script setup lang="ts">
import { usePlayerStore } from '@/stores/player'

const player = usePlayerStore()
</script>

<template>
  <div class="stars" data-test="stars" aria-label="Sterne">
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z" />
    </svg>
    <span>{{ player.stars }}</span>
  </div>
</template>

<style scoped>
.stars {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 20px 6px 12px;
  border-radius: 999px;
  background: rgb(255 255 255 / 85%);
  font-size: 36px;
  font-weight: 800;
  color: #6b4a00;
  pointer-events: none;
  z-index: 5;
}
svg { width: 44px; height: 44px; }
path { fill: #ffd93d; stroke: #e0a800; stroke-width: 1.2; stroke-linejoin: round; }
</style>
