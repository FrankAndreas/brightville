<script setup lang="ts">
// No camera: a crossed-out camera and the key that leaves. Tapping leaves too, once `ready`.
const props = defineProps<{ ready: boolean }>()
const emit = defineEmits<{ leave: [] }>()
</script>

<template>
  <div class="no-camera" data-test="no-camera" aria-hidden="true" @pointerdown="props.ready && emit('leave')">
    <svg viewBox="0 0 120 100" class="camera-off">
      <rect x="14" y="30" width="92" height="56" rx="12" />
      <rect x="42" y="18" width="36" height="16" rx="5" />
      <circle cx="60" cy="58" r="17" class="lens" />
      <line x1="16" y1="92" x2="104" y2="14" class="strike" />
    </svg>
    <svg viewBox="0 0 120 80" class="key">
      <rect x="4" y="4" width="112" height="66" rx="14" class="cap" />
      <path d="M86 22 v18 H40 M52 28 L38 40 L52 52" class="arrow" />
    </svg>
  </div>
</template>

<style scoped>
.no-camera { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6vh; }
.camera-off { width: min(40vw, 40vh); }
.camera-off rect { fill: rgb(0 0 0 / 22%); }
.camera-off .lens { fill: rgb(255 255 255 / 60%); }
.camera-off .strike { stroke: #e5484d; stroke-width: 9; stroke-linecap: round; }
.key { width: 140px; animation: press 1s ease-in-out infinite; }
.cap { fill: #fff; stroke: #6b4a00; stroke-width: 5; }
.arrow { fill: none; stroke: #6b4a00; stroke-width: 7; stroke-linecap: round; stroke-linejoin: round; }
@keyframes press { 50% { transform: translateY(6px); } }
</style>
