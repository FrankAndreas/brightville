<script setup lang="ts">
// A shower of coloured paper for a job well done
const COLORS = ['#ff8fab', '#ffd93d', '#8ecae6', '#95d5b2', '#c8b6ff', '#ff9a3c']
const pieces = Array.from({ length: 60 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  color: COLORS[i % COLORS.length],
  delay: `${((i * 53) % 100) / 100}s`,
  duration: `${1.8 + ((i * 29) % 100) / 80}s`,
  turn: `${((i * 71) % 360) - 180}deg`,
}))
</script>

<template>
  <div class="confetti" data-test="confetti" aria-hidden="true">
    <i
      v-for="(p, i) in pieces" :key="i"
      :style="{ left: p.left, background: p.color, animationDelay: p.delay, animationDuration: p.duration, '--turn': p.turn }"
    />
  </div>
</template>

<style scoped>
.confetti { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 20; }
i {
  position: absolute;
  top: -5%;
  width: 14px;
  height: 22px;
  border-radius: 3px;
  animation: fall linear forwards;
}
@keyframes fall {
  to { transform: translateY(115vh) rotate(var(--turn)) rotateX(720deg); }
}
</style>
