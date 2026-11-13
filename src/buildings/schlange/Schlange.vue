<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import ArrowPad from '@/components/ArrowPad.vue'
import type { Direction } from '@/core/direction'
import { numberWord } from '@/core/numbers'
import { SIZE, createSnake, step, tickMs, turn, type SnakeState } from '@/core/snake'
import { useGameLoop } from '@/services/gameLoop'
import { fillRoundRect } from '@/services/roundRect'
import { instruct, speak, stopSpeaking } from '@/services/tts'
import { onLeaveRequest } from '../leave'
import { useSteering } from '../steering'
import type { BuildingResult } from '../types'
import { SNAKE_THEMES, type SnakeTheme } from './themes'

// The snake from Spielzeugkiste: one round per visit, bought at the door. It ends when the snake bites itself.
const props = defineProps<{
  /** The look of this visit; at random when not given */
  theme?: SnakeTheme
  /** Where the round starts, for tests */
  snake?: SnakeState
}>()
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

// A cheer every this many things
const MILESTONE = 5
// After the crash is said, before going back to the town
const OVER_MS = 3000

const theme = props.theme ?? SNAKE_THEMES[Math.floor(Math.random() * SNAKE_THEMES.length)]
const state = shallowRef<SnakeState>(props.snake ?? createSnake(theme.items))
const phase = ref<'ready' | 'playing' | 'over'>('ready')
const collected = ref(state.value.collected)
const head = ref({ ...state.value.snake[0] })
const canvas = ref<HTMLCanvasElement | null>(null)
const fieldWrap = ref<HTMLElement | null>(null)

let closed = false
let acc = 0
let overTimer: ReturnType<typeof setTimeout> | undefined
let resizer: ResizeObserver | null = null

const loop = useGameLoop(dt => {
  const s = state.value
  acc += dt
  while (acc >= tickMs(s.collected)) {
    acc -= tickMs(s.collected)
    const event = step(s)
    if (event === 'ate' && s.collected % MILESTONE === 0) {
      void speak(`Toll, schon ${numberWord(s.collected)} ${theme.collective}!`)
    }
    if (event === 'crashed') {
      gameOver()
      break
    }
  }
  collected.value = s.collected
  head.value = { ...s.snake[0] }
  draw()
})

function onDir(dir: Direction) {
  if (closed || phase.value === 'over') return
  turn(state.value, dir)
  if (phase.value === 'ready') {
    phase.value = 'playing'
    acc = 0
    loop.start()
  }
}

const steer = useSteering(onDir)

function crashLine(n: number): string {
  if (n === 0) return 'Oh! Das war knapp.'
  if (n === 1) return 'Oh! Du hast einen Schatz gesammelt.'
  return `Oh! Du hast ${numberWord(n)} ${theme.collective} gesammelt.`
}

function gameOver() {
  loop.stop()
  phase.value = 'over'
  void speak(crashLine(state.value.collected))
  overTimer = setTimeout(leave, OVER_MS)
}

let stopLeaveRequests = () => {}

function shutDown() {
  if (closed) return
  closed = true
  loop.stop()
  clearTimeout(overTimer)
  resizer?.disconnect()
  window.removeEventListener('resize', fitCanvas)
  window.removeEventListener('keydown', onEscape)
  stopLeaveRequests()
  stopSpeaking()
}

function leave() {
  if (closed) return
  shutDown()
  // Playing costs Stars at the door; it never earns any
  emit('finished', { stars: 0 })
}

function onEscape(e: KeyboardEvent) {
  if (e.code === 'Escape' && !e.repeat) leave()
}

// The field is square and as large as its wrapper allows, crisp on the device's pixels
function fitCanvas() {
  const el = canvas.value
  const wrap = fieldWrap.value
  if (!el || !wrap) return
  const { width, height } = wrap.getBoundingClientRect()
  const size = Math.floor(Math.min(width, height)) || 300
  const dpr = window.devicePixelRatio || 1
  el.style.width = `${size}px`
  el.style.height = `${size}px`
  el.width = size * dpr
  el.height = size * dpr
  draw()
}

function draw() {
  const el = canvas.value
  const ctx = el?.getContext('2d')
  if (!el || !ctx) return
  const cell = el.width / SIZE
  const { colors, face } = theme
  ctx.fillStyle = colors.bg
  ctx.fillRect(0, 0, el.width, el.height)
  ctx.strokeStyle = colors.grid
  ctx.lineWidth = 1
  for (let i = 1; i < SIZE; i++) {
    ctx.beginPath(); ctx.moveTo(i * cell, 0); ctx.lineTo(i * cell, el.height); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i * cell); ctx.lineTo(el.width, i * cell); ctx.stroke()
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `${Math.floor(cell * 0.8)}px system-ui, sans-serif`
  for (const item of state.value.items) ctx.fillText(item.kind, (item.x + 0.5) * cell, (item.y + 0.55) * cell)
  // Body from the tail up, so the head is drawn on top
  const snake = state.value.snake
  for (let i = snake.length - 1; i > 0; i--) {
    ctx.fillStyle = colors.body[(i - 1) % colors.body.length]
    fillRoundRect(ctx, snake[i].x * cell + 1, snake[i].y * cell + 1, cell - 2, cell - 2, cell * 0.3)
  }
  if (snake.length) {
    ctx.fillStyle = colors.head
    fillRoundRect(ctx, snake[0].x * cell, snake[0].y * cell, cell, cell, cell * 0.35)
    ctx.font = `${Math.floor(cell * 0.85)}px system-ui, sans-serif`
    ctx.fillText(face, (snake[0].x + 0.5) * cell, (snake[0].y + 0.55) * cell)
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onEscape)
  stopLeaveRequests = onLeaveRequest(leave)
  void instruct(theme.say)
  await nextTick()
  if (typeof ResizeObserver !== 'undefined' && fieldWrap.value) {
    resizer = new ResizeObserver(fitCanvas)
    resizer.observe(fieldWrap.value)
  }
  window.addEventListener('resize', fitCanvas)
  fitCanvas()
})
onBeforeUnmount(shutDown)
</script>

<template>
  <div
    class="schlange" data-test="schlange" :data-phase="phase"
    @pointerdown="steer.down" @pointerup="steer.up" @pointercancel="steer.cancel"
  >
    <div class="score">
      <span>{{ theme.items[0] }} {{ collected }}</span>
    </div>
    <div class="stage">
      <div ref="fieldWrap" class="field-wrap">
        <canvas ref="canvas" class="field" />
        <span class="probe" data-test="head" :data-x="head.x" :data-y="head.y" />
        <div v-if="phase === 'ready'" class="hint">{{ theme.face }} ▲ ◀ ▶ ▼</div>
      </div>
      <ArrowPad color="#9b59b6" @dir="onDir" />
    </div>
  </div>
</template>

<style scoped>
.schlange {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #f7efff;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}
.score {
  /* The board starts below the leave and 🔊 buttons in the top-left corner */
  padding: calc(56px + env(safe-area-inset-top)) 16px 6px;
  text-align: center;
  font-size: 1.6rem;
  font-weight: bold;
  color: #9b59b6;
}
.stage {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 0 12px calc(16px + env(safe-area-inset-bottom));
}
@media (orientation: landscape) {
  .stage { flex-direction: row; justify-content: center; }
}
.field-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  min-width: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.field { display: block; border-radius: 14px; box-shadow: 0 4px 0 #6f3d87; }
.probe { display: none; }
.hint {
  position: absolute;
  bottom: 12%;
  padding: 10px 20px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.85);
  font-size: 1.6rem;
  color: #9b59b6;
  pointer-events: none;
}
</style>
