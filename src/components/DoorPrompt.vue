<script setup lang="ts">
import type { DoorState } from '@/core/access'

// Shown in front of a door, all in pictures:
//  open        what is inside (and its price in Stars) and the key that goes in
//  unavailable the picture crossed out: this device can't play it
//  locked      a lock and today's learning slots: learn first
//  poor        the price in Stars, which the child doesn't have yet
//
// The picture of an open door is also the button that goes in, for fingers and the mouse.
const props = defineProps<{
  icon: string
  state: DoorState
  cost?: number
  visits?: number
  goal?: number
  /** Shows a tapping finger instead of the Enter key */
  touch?: boolean
}>()
const emit = defineEmits<{ enter: [] }>()

function tap() {
  if (props.state === 'open') emit('enter')
}

const STAR = 'M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z'
</script>

<template>
  <div class="prompt" data-test="door-prompt" :data-state="state" aria-hidden="true" @pointerdown="tap">
    <span v-if="state === 'locked'" class="icon">🔒</span>
    <span class="icon" :class="{ crossed: state === 'unavailable', dim: state === 'locked' || state === 'poor' }">{{ icon }}</span>

    <span v-if="state === 'locked'" class="slots">
      <i v-for="n in goal ?? 0" :key="n" :class="{ done: n <= (visits ?? 0) }" />
    </span>

    <span v-if="cost && (state === 'open' || state === 'poor')" class="price" :class="{ missing: state === 'poor' }" data-test="door-price">
      <svg viewBox="0 0 24 24"><path :d="STAR" /></svg>
      <b>{{ cost }}</b>
    </span>

    <svg v-if="state === 'open' && touch" class="key tap" data-test="tap" viewBox="0 0 100 100">
      <circle cx="50" cy="42" r="30" class="ripple" />
      <path d="M50 42 v38 M38 62 v14 a12 12 0 0 0 24 0 v-14" class="finger" />
      <circle cx="50" cy="42" r="9" class="tip" />
    </svg>
    <svg v-else-if="state === 'open'" class="key" data-test="key" viewBox="0 0 120 80">
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
.prompt[data-state='open'] { pointer-events: auto; cursor: pointer; touch-action: none; }
.icon { font-size: 72px; line-height: 1; position: relative; }
.icon.dim { filter: grayscale(1); opacity: 0.55; }
.icon.crossed { filter: grayscale(1); opacity: 0.6; }
.icon.crossed::after {
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
.slots { display: flex; gap: 10px; }
.slots i { width: 40px; height: 40px; border-radius: 50%; border: 5px dashed #c9a800; box-sizing: border-box; }
.slots i.done { border: 0; background: #4bd37b; }
.price { display: flex; align-items: center; gap: 4px; font-size: 54px; font-weight: 800; color: #6b4a00; }
.price svg { width: 60px; }
.price path { fill: #ffd93d; stroke: #e0a800; stroke-width: 1.2; stroke-linejoin: round; }
.price.missing { animation: wiggle 0.8s ease-in-out infinite; }
.key { width: 120px; animation: press 1s ease-in-out infinite; }
.cap { fill: #fff; stroke: #6b4a00; stroke-width: 5; filter: drop-shadow(0 6px 0 #c9a800); }
.tap { width: 96px; }
.ripple { fill: #ffe89a; stroke: #ffd93d; stroke-width: 4; }
.finger { fill: none; stroke: #6b4a00; stroke-width: 8; stroke-linecap: round; stroke-linejoin: round; }
.tip { fill: #6b4a00; }
.arrow { fill: none; stroke: #6b4a00; stroke-width: 7; stroke-linecap: round; stroke-linejoin: round; }
@keyframes press { 50% { transform: translateY(6px); } }
@keyframes wiggle { 25% { transform: rotate(-6deg); } 75% { transform: rotate(6deg); } }
</style>
