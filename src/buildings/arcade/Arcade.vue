<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import Confetti from '@/components/Confetti.vue'
import { buildDeck, createMemory, pickPairs, type Card } from '@/core/memory'
import { playBeat } from '@/services/sound'
import { speak, stopSpeaking } from '@/services/tts'
import type { BuildingResult } from '../types'
import { ANIMALS, COLUMNS, PAIRS_PER_ROUND } from './cards'

const props = defineProps<{
  /** The cards of this round; dealt at random when not given */
  deck?: Card[]
}>()
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

// How long two cards that don't match stay face up
const MISS_MS = 1200
// The last animal's name is said before the cheer
const CHEER_AFTER_MS = 800
const CONFETTI_MS = 3000

const deck = props.deck ?? buildDeck(pickPairs(ANIMALS, PAIRS_PER_ROUND))
const game = createMemory(deck)
const view = reactive({ open: game.open, matched: game.matched, done: false })
/** The card the arrow keys are on */
const focus = ref(0)

let closed = false
const timers = new Set<ReturnType<typeof setTimeout>>()
function later(fn: () => void, ms: number) {
  const id = setTimeout(() => {
    timers.delete(id)
    if (!closed) fn()
  }, ms)
  timers.add(id)
}

function sync() {
  view.open = game.open
  view.matched = game.matched
  view.done = game.done
}

function flip(index: number) {
  const card = deck[index]
  if (closed || !card) return
  focus.value = index
  const result = game.flip(card.key)
  if (result === 'ignored') return
  sync()
  void speak(card.say)
  if (result === 'match') playBeat('chime')
  if (result === 'miss') later(() => { game.hideMisses(); sync() }, MISS_MS)
  if (game.done) {
    later(() => void speak('Super gemacht!'), CHEER_AFTER_MS)
    later(leave, CHEER_AFTER_MS + CONFETTI_MS)
  }
}

function shutDown() {
  if (closed) return
  closed = true
  for (const id of timers) clearTimeout(id)
  timers.clear()
  window.removeEventListener('keydown', onKey)
  stopSpeaking()
}

function leave() {
  if (closed) return
  shutDown()
  // Playing costs Stars at the door; it never earns any
  emit('finished', { stars: 0 })
}

const MOVES: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
}

function onKey(e: KeyboardEvent) {
  if (e.repeat) return
  if (e.code === 'Escape') leave()
  else if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space') flip(focus.value)
  else if (MOVES[e.code]) {
    e.preventDefault()
    const rows = Math.ceil(deck.length / COLUMNS)
    const col = Math.min(COLUMNS - 1, Math.max(0, (focus.value % COLUMNS) + MOVES[e.code][0]))
    const row = Math.min(rows - 1, Math.max(0, Math.floor(focus.value / COLUMNS) + MOVES[e.code][1]))
    focus.value = Math.min(deck.length - 1, row * COLUMNS + col)
  }
}

const isUp = (key: string) => view.open.includes(key) || view.matched.includes(key)

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(shutDown)
</script>

<template>
  <div class="arcade">
    <div class="grid" :style="{ gridTemplateColumns: `repeat(${COLUMNS}, 1fr)` }">
      <button
        v-for="(card, i) in deck" :key="card.key" class="card" data-test="card" :data-key="card.key"
        :data-face="isUp(card.key) ? 'up' : 'down'" :data-matched="view.matched.includes(card.key)"
        :data-focus="focus === i" tabindex="-1" @pointerdown="flip(i)"
      ><span v-if="isUp(card.key)" class="picture">{{ card.emoji }}</span></button>
    </div>
    <Confetti v-if="view.done" />
  </div>
</template>

<style scoped>
.arcade {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 4vh 4vw;
  box-sizing: border-box;
  background: #fff3c4;
}
.grid { display: grid; grid-auto-rows: 1fr; gap: min(2.4vh, 2vw); height: 100%; max-width: 100%; aspect-ratio: 4 / 3.2; }
.card {
  border: 0;
  padding: 0;
  border-radius: 22px;
  min-height: 0;
  overflow: hidden;
  cursor: pointer;
  display: grid;
  place-items: center;
  background: repeating-linear-gradient(45deg, #ff9a3c 0 14px, #ffb35c 14px 28px);
  box-shadow: 0 7px 0 #c96a00;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.2s ease;
}
.card[data-face='up'] { background: #fff; box-shadow: 0 7px 0 #e3d39a; }
.card[data-matched='true'] { background: #e9ffe9; box-shadow: 0 7px 0 #9fd8a3; animation: found 0.5s ease; }
.card[data-focus='true'] { outline: 8px solid #4d96ff; outline-offset: 2px; transform: translateY(-4px); }
.picture { font-size: clamp(40px, 13vh, 110px); line-height: 1; }
@keyframes found { 50% { transform: scale(1.1) rotate(4deg); } }
</style>
