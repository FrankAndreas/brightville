<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

// When the game can't start: the server doesn't answer (a sleeping cloud; it tries again by itself),
// or this person may not play (a closed door, and one line for the parent who set it up).
const props = defineProps<{ kind: 'offline' | 'no_access' }>()
const emit = defineEmits<{ retry: [] }>()

const RETRY_MS = 5000
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  if (props.kind === 'offline') timer = setInterval(() => emit('retry'), RETRY_MS)
})
onBeforeUnmount(() => clearInterval(timer))
</script>

<template>
  <div class="screen" data-test="server-screen" :data-kind="kind" @pointerdown="kind === 'offline' && emit('retry')">
    <svg v-if="kind === 'offline'" viewBox="0 0 160 110" aria-hidden="true">
      <path d="M40 90 a26 26 0 0 1 4-52 a34 34 0 0 1 64-6 a26 26 0 0 1 12 58 z" class="cloud" />
      <path d="M62 62 q8 6 16 0 M90 62 q8 6 16 0" class="eyes" />
      <text x="122" y="30" class="z">z</text><text x="136" y="16" class="z small">z</text>
    </svg>
    <template v-else>
      <svg viewBox="0 0 100 120" aria-hidden="true">
        <rect x="18" y="8" width="64" height="104" rx="8" class="frame" />
        <rect x="28" y="18" width="44" height="94" rx="4" class="door" />
        <text x="50" y="74" class="lock">🔒</text>
      </svg>
      <p>Brightville ist für dich noch nicht freigeschaltet. Ein Elternteil kann das im Familien-Hub unter Einstellungen → Apps ändern.</p>
    </template>
  </div>
</template>

<style scoped>
.screen {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 24px;
  background: #bfe7ff;
  padding: 24px;
  text-align: center;
}
svg { width: min(50vw, 320px); }
.cloud { fill: #fff; stroke: #9cc7e8; stroke-width: 3; animation: bob 3s ease-in-out infinite; }
.eyes { fill: none; stroke: #6b7c93; stroke-width: 4; stroke-linecap: round; }
.z { font: 800 22px system-ui, sans-serif; fill: #6b7c93; animation: fade 2s ease-in-out infinite; }
.z.small { font-size: 16px; animation-delay: 1s; }
.frame { fill: #b8b8b8; }
.door { fill: #8a8a8a; }
.lock { font-size: 34px; text-anchor: middle; }
p { max-width: 34em; font: 500 18px/1.5 system-ui, sans-serif; color: #2b4c7e; }
@keyframes bob { 50% { transform: translateY(4px); } }
@keyframes fade { 50% { opacity: 0.2; } }
</style>
