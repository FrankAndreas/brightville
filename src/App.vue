<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { BUILDINGS, stateOf, toDoors } from '@/buildings/registry'
import type { BuildingDef, BuildingResult } from '@/buildings/types'
import CityView from '@/city/CityView.vue'
import Confetti from '@/components/Confetti.vue'
import DoorPrompt from '@/components/DoorPrompt.vue'
import GoalBar from '@/components/GoalBar.vue'
import HelpOverlay from '@/components/HelpOverlay.vue'
import LeaveButton from '@/components/LeaveButton.vue'
import StarCounter from '@/components/StarCounter.vue'
import StartGate from '@/components/StartGate.vue'
import { DAILY_GOAL } from '@/core/daily'
import { numberWord } from '@/core/numbers'
import { detectDevice } from '@/services/device'
import { unlockAudio } from '@/services/sound'
import { speak } from '@/services/tts'
import { usePlayerStore } from '@/stores/player'

const props = withDefaults(defineProps<{ buildings?: BuildingDef[] }>(), { buildings: () => BUILDINGS })

const player = usePlayerStore()
const device = detectDevice()
// Doors follow the Stars and the daily goal: the town repaints them when they change
const doors = computed(() => toDoors(props.buildings, device, player.goalReached, player.stars))
const stateFor = (b: BuildingDef) => stateOf(b, device, player.goalReached, player.stars)

/** No mouse, so most likely no keyboard: explain and prompt with fingers */
const fingersOnly = device.touch && !device.keyboard

const CELEBRATION_MS = 3000

const started = ref(false)
const nearId = ref<string | null>(null)
/** The building the child is in; null while in the town */
const inside = shallowRef<BuildingDef | null>(null)

const find = (id: string | null) => props.buildings.find(b => b.id === id) ?? null
const near = computed(() => find(nearId.value))
/** The picture of what the daily goal opens */
const prize = computed(() => props.buildings.find(b => b.kind === 'play')?.icon ?? '🎉')

/** The controls, shown over the paused town */
const helpOpen = ref(false)
const inTown = computed(() => started.value && inside.value === null)

function start() {
  unlockAudio()
  started.value = true
  // A player who has never earned anything gets the controls explained without asking
  if (player.stars === 0 && player.day === '') helpOpen.value = true
}

function onKey(e: KeyboardEvent) {
  if (e.repeat || (e.code !== 'KeyH' && e.code !== 'F1') || !inTown.value || helpOpen.value) return
  e.preventDefault()
  helpOpen.value = true
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

/** What the voice says in front of a door, by what the door is right now */
function doorLine(b: BuildingDef): string {
  const cost = numberWord(b.cost ?? 0)
  switch (stateFor(b)) {
    case 'locked': return 'Erst lernen, dann spielen!'
    case 'poor': return `Du brauchst ${cost} Sterne.`
    case 'open': return b.kind === 'play' && b.cost ? `${b.spokenName}. Das kostet ${cost} Sterne.` : b.spokenName
    default: return b.spokenName
  }
}

/**
 * The play building the child has just come out of. Its door offers nothing
 * until the child has walked away: the Enter that turned cards a moment ago
 * must not buy another round.
 */
const restingId = ref<string | null>(null)
/** True while a building's code is being fetched */
let entering = false

function onNearDoor(id: string | null) {
  nearId.value = id
  if (id !== restingId.value) restingId.value = null
  const building = find(id)
  if (building && id !== restingId.value) void speak(doorLine(building))
}

async function onEnter(id: string) {
  const building = find(id)
  if (!building || inside.value || entering || id === restingId.value) return
  // The day may have changed since anyone last looked at the clock
  player.refreshDay()
  if (stateFor(building) !== 'open') return
  entering = true
  try {
    await building.preload?.()
  } catch {
    // Offline or a new version on the server: stay in the town, keep the Stars
    return
  } finally {
    entering = false
  }
  if (inside.value || stateFor(building) !== 'open') return
  // Play costs Stars, taken at the door
  if (building.kind === 'play' && building.cost && !player.spend(building.cost)) return
  inside.value = building
}

/** What the voice says when today's learning is done: only an affordable door is called open */
function goalLine(): string {
  const prizes = props.buildings.filter(b => b.kind === 'play')
  if (prizes.some(b => stateFor(b) === 'open')) return 'Geschafft! Die Spielhalle ist offen!'
  const cost = Math.min(...prizes.map(b => b.cost ?? 0))
  return prizes.length > 0 ? `Geschafft! Jetzt brauchst du noch ${numberWord(cost)} Sterne.` : 'Geschafft!'
}

/** Confetti over the town when today's learning is done */
const celebrating = ref(false)
let celebrationTimer: ReturnType<typeof setTimeout> | undefined

function onFinished(result: BuildingResult) {
  const building = inside.value
  inside.value = null
  if (building?.kind === 'play') restingId.value = building.id
  // Only earning buildings give Stars and count towards the daily goal
  if (building?.kind !== 'earn' || !(result.stars > 0)) return
  player.award(result.stars)
  if (player.recordVisit()) {
    celebrating.value = true
    clearTimeout(celebrationTimer)
    celebrationTimer = setTimeout(() => { celebrating.value = false }, CELEBRATION_MS)
    void speak(goalLine())
  }
}

// A game left open overnight must notice the new day
const DAY_CHECK_MS = 60_000
const checkDay = () => player.refreshDay()
let dayTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  dayTimer = setInterval(checkDay, DAY_CHECK_MS)
  document.addEventListener('visibilitychange', checkDay)
})
onBeforeUnmount(() => {
  clearInterval(dayTimer)
  clearTimeout(celebrationTimer)
  document.removeEventListener('visibilitychange', checkDay)
})
</script>

<template>
  <StartGate v-if="!started" @start="start" />
  <main v-else class="game" data-test="game">
    <CityView :doors="doors" :paused="inside !== null || helpOpen" :touch="device.touch" @near-door="onNearDoor" @enter="onEnter" />
    <div class="hud">
      <StarCounter />
      <GoalBar :visits="player.visitsToday" :goal="DAILY_GOAL" :prize="prize" />
    </div>
    <DoorPrompt
      v-if="near && !inside && !helpOpen && near.id !== restingId"
      :icon="near.icon" :state="stateFor(near)" :cost="near.cost" :visits="player.visitsToday" :goal="DAILY_GOAL"
      :touch="fingersOnly" @enter="onEnter(near.id)"
    />
    <Confetti v-if="celebrating && !inside" />
    <button v-if="inTown && !helpOpen" class="help-button" data-test="help-button" aria-label="Hilfe" @pointerdown="helpOpen = true">?</button>
    <HelpOverlay v-if="helpOpen && inTown" :touch="fingersOnly" @close="helpOpen = false" />
    <section v-if="inside" class="building">
      <component :is="inside.component" @finished="onFinished" />
      <LeaveButton />
    </section>
  </main>
</template>

<style>
html, body, #app { height: 100%; margin: 0; overflow: hidden; }
body {
  background: #bfe7ff;
  font-family: system-ui, sans-serif;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  /* No long-press menu, no grey flash on taps, no rubber-band scrolling on the iPad */
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
  overscroll-behavior: none;
}
.game { position: fixed; inset: 0; }
.building { position: fixed; inset: 0; z-index: 10; }
.hud {
  position: fixed;
  top: calc(16px + env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 6px 20px 6px 12px;
  border-radius: 999px;
  background: rgb(255 255 255 / 85%);
  pointer-events: none;
}
.help-button {
  position: fixed;
  top: calc(16px + env(safe-area-inset-top));
  right: calc(16px + env(safe-area-inset-right));
  z-index: 5;
  width: 60px;
  height: 60px;
  border: 0;
  border-radius: 50%;
  background: rgb(255 255 255 / 85%);
  font: 800 34px system-ui, sans-serif;
  color: #6b4a00;
  cursor: pointer;
}
</style>
