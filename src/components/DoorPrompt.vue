<script setup lang="ts">
// Shown in front of a door: what is inside, and the key that goes in.
// A closed door shows the picture crossed out and no key.
defineProps<{ icon: string; open: boolean }>()
</script>

<template>
  <div class="prompt" data-test="door-prompt" :data-open="open" aria-hidden="true">
    <span class="icon" :class="{ closed: !open }">{{ icon }}</span>
    <svg v-if="open" class="key" viewBox="0 0 120 80">
      <rect x="4" y="4" width="112" height="66" rx="14" class="cap" />
      <path d="M86 22 v18 H40 M52 28 L38 40 L52 52" class="arrow" />
    </svg>
  </div>
</template>

<style scoped>
.prompt {
  position: fixed;
  left: 50%;
  bottom: 8vh;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 16px 32px;
  border-radius: 32px;
  background: rgb(255 255 255 / 90%);
  box-shadow: 0 6px 0 rgb(0 0 0 / 12%);
  z-index: 5;
  pointer-events: none;
}
.icon { font-size: 72px; line-height: 1; position: relative; }
.icon.closed { filter: grayscale(1); opacity: 0.6; }
.icon.closed::after {
  content: '';
  position: absolute;
  left: -8%;
  right: -8%;
  top: 46%;
  height: 8px;
  border-radius: 4px;
  background: #e5484d;
  transform: rotate(-35deg);
}
.key { width: 120px; animation: press 1s ease-in-out infinite; }
.cap { fill: #fff; stroke: #6b4a00; stroke-width: 5; filter: drop-shadow(0 6px 0 #c9a800); }
.arrow { fill: none; stroke: #6b4a00; stroke-width: 7; stroke-linecap: round; stroke-linejoin: round; }
@keyframes press { 50% { transform: translateY(6px); } }
</style>
