<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import ArrowPad from '@/components/ArrowPad.vue'
import Confetti from '@/components/Confetti.vue'
import type { Direction } from '@/core/direction'
import { MAZES, createGame, position, setDirection, update, type MazeGame } from '@/core/maze'
import { useGameLoop } from '@/services/gameLoop'
import { fillRoundRect } from '@/services/roundRect'
import { speak, stopSpeaking } from '@/services/tts'
import { onLeaveRequest } from '../leave'
import { useSteering } from '../steering'
import type { BuildingResult } from '../types'
import { MAZE_THEMES, type MazeTheme } from './themes'

// Collect every sweet in the maze while the chasers wander; a power-up turns the tables for a while.
// One round per visit, bought at the door, always at the slow speed.
const props = defineProps<{
  /** The look of this visit; at random when not given */
  theme?: MazeTheme
  /** The maze of this visit; one of MAZES at random when not given */
  maze?: string[]
  /** Where the chasers turn; for tests */
  random?: () => number
}>()
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

// The pause after a lost life
const HOPPLA_MS = 1500
// After the last word, before going back to the town
const END_MS = 3500

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]
const theme = props.theme ?? pick(MAZE_THEMES)
const game: MazeGame = createGame(props.maze ?? pick(Object.values(MAZES)), 'langsam')
const random = props.random ?? Math.random

const phase = ref<'ready' | 'playing' | 'hoppla' | 'over' | 'won'>('ready')
const lives = ref(game.lives)
const canvas = ref<HTMLCanvasElement | null>(null)
const fieldWrap = ref<HTMLElement | null>(null)

let closed = false
let resizer: ResizeObserver | null = null
const timers = new Set<ReturnType<typeof setTimeout>>()
function later(fn: () => void, ms: number) {
  const id = setTimeout(() => {
    timers.delete(id)
    if (!closed) fn()
  }, ms)
  timers.add(id)
}

const loop = useGameLoop(dt => {
  for (const event of update(game, dt, random)) {
    if (event === 'half') void speak('Super, schon die Hälfte!')
    if (event === 'life-lost' && !game.over) hoppla()
    if (event === 'game-over') end('over', 'Oh! Das nächste Mal klappt es.')
    if (event === 'cleared') end('won', 'Geschafft!')
  }
  lives.value = game.lives
  draw()
})

function onDir(dir: Direction) {
  if (closed || phase.value === 'over' || phase.value === 'won') return
  setDirection(game, dir)
  if (phase.value === 'ready') {
    phase.value = 'playing'
    loop.start()
  }
}

const steer = useSteering(onDir)

function hoppla() {
  loop.stop()
  phase.value = 'hoppla'
  void speak('Hoppla!')
  later(() => {
    if (phase.value !== 'hoppla') return
    phase.value = 'playing'
    loop.start()
  }, HOPPLA_MS)
}

function end(how: 'over' | 'won', line: string) {
  loop.stop()
  lives.value = game.lives
  phase.value = how
  void speak(line)
  later(leave, END_MS)
}

let stopLeaveRequests = () => {}

function shutDown() {
  if (closed) return
  closed = true
  loop.stop()
  for (const id of timers) clearTimeout(id)
  timers.clear()
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

// Keeps the maze's shape at the largest size the wrapper allows
function fitCanvas() {
  const el = canvas.value
  const wrap = fieldWrap.value
  if (!el || !wrap) return
  const { width, height } = wrap.getBoundingClientRect()
  const tile = Math.floor(Math.min(width / game.cols, height / game.rows)) || 20
  const dpr = window.devicePixelRatio || 1
  el.style.width = `${tile * game.cols}px`
  el.style.height = `${tile * game.rows}px`
  el.width = tile * game.cols * dpr
  el.height = tile * game.rows * dpr
  draw()
}

function draw() {
  const el = canvas.value
  const ctx = el?.getContext('2d')
  if (!el || !ctx) return
  const tile = el.width / game.cols
  const { colors } = theme
  ctx.fillStyle = colors.bg
  ctx.fillRect(0, 0, el.width, el.height)
  ctx.fillStyle = colors.wall
  for (const k of game.walls) {
    const [x, y] = k.split(',').map(Number)
    fillRoundRect(ctx, x * tile + 1, y * tile + 1, tile - 2, tile - 2, tile * 0.25)
  }
  ctx.fillStyle = colors.dot
  for (const k of game.dots) {
    const [x, y] = k.split(',').map(Number)
    ctx.beginPath()
    ctx.arc((x + 0.5) * tile, (y + 0.5) * tile, tile * 0.13, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `${Math.floor(tile * 0.8)}px system-ui, sans-serif`
  const sprite = (emoji: string, x: number, y: number) => ctx.fillText(emoji, (x + 0.5) * tile, (y + 0.55) * tile)
  for (const k of game.powers) {
    const [x, y] = k.split(',').map(Number)
    sprite(theme.power, x, y)
  }
  game.monsters.forEach((m, i) => {
    const p = position(m)
    // Just caught: harmless for a moment
    ctx.globalAlpha = m.safeMs ? 0.4 : 1
    sprite(m.scared ? theme.scared : theme.chasers[i % theme.chasers.length], p.x, p.y)
  })
  ctx.globalAlpha = 1
  const p = position(game.player)
  ctx.font = `${Math.floor(tile * 0.95)}px system-ui, sans-serif`
  sprite(theme.player, p.x, p.y)
}

onMounted(async () => {
  window.addEventListener('keydown', onEscape)
  stopLeaveRequests = onLeaveRequest(leave)
  void speak(theme.say)
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
    class="bonbonjagd" data-test="bonbonjagd" :data-phase="phase"
    @pointerdown="steer.down" @pointerup="steer.up" @pointercancel="steer.cancel"
  >
    <div class="lives">
      <span v-for="i in lives" :key="i" data-test="life">{{ theme.player }}</span>
    </div>
    <div class="stage">
      <div ref="fieldWrap" class="field-wrap">
        <canvas ref="canvas" class="field" />
        <div v-if="phase === 'ready'" class="hint">▲ ◀ ▶ ▼</div>
      </div>
      <ArrowPad color="#ff69b4" @dir="onDir" />
    </div>
    <Confetti v-if="phase === 'won'" />
  </div>
</template>

<style scoped>
.bonbonjagd {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #fff0f7;
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
}
.lives {
  padding: 22px 16px 6px;
  text-align: center;
  font-size: 1.6rem;
  letter-spacing: 4px;
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
.field { display: block; border-radius: 10px; }
.hint {
  position: absolute;
  bottom: 12%;
  padding: 10px 20px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.85);
  font-size: 1.6rem;
  color: #ff69b4;
  pointer-events: none;
}
</style>
