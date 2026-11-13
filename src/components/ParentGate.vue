<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'

// The way into the parents' page, for a device logged in as a parent that a child plays on (security review,
// Nov 2026): the gear must be held for a while, then a multiplication a young child can't do opens it. Nothing is spoken here,
// so the voice doesn't help a child through it.
const emit = defineEmits<{ open: [] }>()

const HOLD_MS = 3000

const holding = ref(false)
const hint = ref(false)
const asking = ref(false)
const a = ref(0)
const b = ref(0)
const answer = ref('')
const input = ref<HTMLInputElement | null>(null)
let holdTimer: ReturnType<typeof setTimeout> | undefined
let hintTimer: ReturnType<typeof setTimeout> | undefined

// Products of 6 to 9: two-digit, beyond counting on fingers
const factor = () => 6 + Math.floor(Math.random() * 4)

async function ask() {
  holding.value = false
  a.value = factor()
  b.value = factor()
  answer.value = ''
  asking.value = true
  await nextTick()
  input.value?.focus()
}

function press(e: PointerEvent) {
  ;(e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId)
  holding.value = true
  hint.value = false
  clearTimeout(holdTimer)
  holdTimer = setTimeout(() => void ask(), HOLD_MS)
}

function release() {
  if (!holding.value) return
  holding.value = false
  clearTimeout(holdTimer)
  // Let go too early: a quiet hint for grown-ups, nothing that invites a child to try again
  hint.value = true
  clearTimeout(hintTimer)
  hintTimer = setTimeout(() => { hint.value = false }, 2000)
}

function check() {
  const right = Number(answer.value.trim()) === a.value * b.value
  asking.value = false
  if (right) emit('open')
}

onBeforeUnmount(() => {
  clearTimeout(holdTimer)
  clearTimeout(hintTimer)
})
</script>

<template>
  <span class="gate">
    <button
      class="round gear" data-test="parents-button" aria-label="Eltern: gedrückt halten" :data-holding="holding"
      @pointerdown="press" @pointerup="release" @pointercancel="release" @pointerleave="release"
      @keydown.enter.prevent="ask" @keydown.space.prevent="ask" @contextmenu.prevent
    >⚙️</button>
    <!-- A ring drawn round the gear while it is held, full when the question comes -->
    <svg v-if="holding" class="ring" viewBox="0 0 68 68" aria-hidden="true"><circle cx="34" cy="34" r="31" pathLength="100" /></svg>
    <span v-if="hint" class="hint" data-test="parents-hint">Eltern: 3 Sekunden halten</span>
  </span>
  <div v-if="asking" class="veil" data-test="parents-question" :data-a="a" :data-b="b" @click.self="asking = false">
    <form class="card" @submit.prevent="check">
      <p class="who">Für Eltern</p>
      <label>Wie viel ist {{ a }} × {{ b }}?
        <input
          ref="input" v-model="answer" data-test="parents-answer" type="text" inputmode="numeric" autocomplete="off"
          maxlength="3"
        />
      </label>
      <div class="actions">
        <button type="button" data-test="parents-cancel" @click="asking = false">Abbrechen</button>
        <button type="submit" data-test="parents-ok">OK</button>
      </div>
    </form>
  </div>
</template>

<style scoped>
.gate { position: relative; display: inline-flex; }
.gear {
  font-size: 28px;
  position: relative;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
.ring {
  position: absolute;
  inset: -4px;
  width: calc(100% + 8px);
  height: calc(100% + 8px);
  pointer-events: none;
  transform: rotate(-90deg);
}
.ring circle {
  fill: none;
  stroke: #4f8fe8;
  stroke-width: 5;
  stroke-linecap: round;
  stroke-dasharray: 100;
  stroke-dashoffset: 100;
  animation: fill 3s linear forwards;
}
@keyframes fill { to { stroke-dashoffset: 0; } }
.hint {
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 6px;
  white-space: nowrap;
  font-size: 13px;
  color: #444;
  background: rgb(255 255 255 / 90%);
  padding: 4px 8px;
  border-radius: 8px;
}
.veil {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  background: rgb(0 0 0 / 45%);
}
.card {
  background: white;
  border-radius: 16px;
  padding: 20px 24px;
  min-width: min(320px, calc(100vw - 32px));
  box-sizing: border-box;
  font-size: 18px;
  color: #222;
}
.who { margin: 0 0 8px; font-size: 14px; color: #666; }
label { display: grid; gap: 10px; }
input { font-size: 22px; padding: 8px 10px; border: 2px solid #ccc; border-radius: 10px; }
.actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px; }
.actions button { font-size: 16px; padding: 8px 16px; border-radius: 10px; border: none; background: #eee; }
.actions button[type='submit'] { background: #4f8fe8; color: white; }
</style>
