<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { BUILDINGS, stateOf, toDoors } from '@/buildings/registry'
import type { BuildingDef, BuildingResult } from '@/buildings/types'
import CityView from '@/city/CityView.vue'
import Confetti from '@/components/Confetti.vue'
import DoorPrompt from '@/components/DoorPrompt.vue'
import GoalBar from '@/components/GoalBar.vue'
import HelpOverlay from '@/components/HelpOverlay.vue'
import LeaveButton from '@/components/LeaveButton.vue'
import LookScreen from '@/components/LookScreen.vue'
import ParentArea from '@/components/ParentArea.vue'
import ParentGate from '@/components/ParentGate.vue'
import SayAgain from '@/components/SayAgain.vue'
import ServerScreen from '@/components/ServerScreen.vue'
import StarCounter from '@/components/StarCounter.vue'
import StartGate from '@/components/StartGate.vue'
import StickerParade from '@/components/StickerParade.vue'
import WhoPlays from '@/components/WhoPlays.vue'
import { DEFAULT_LOOK, type Look } from '@/core/look'
import { numberWord } from '@/core/numbers'
import { httpApi, type Api } from '@/services/api'
import { detectDevice } from '@/services/device'
import { renewOnce } from '@/services/renew'
import { unlockAudio } from '@/services/sound'
import { forgetInstruction, speak } from '@/services/tts'
import { usePlayerStore } from '@/stores/player'
import { useWardrobeStore } from '@/stores/wardrobe'
import { useSessionStore } from '@/stores/session'

const props = withDefaults(defineProps<{ buildings?: BuildingDef[]; api?: Api }>(), {
  buildings: () => BUILDINGS,
  api: () => httpApi(),
})

const session = useSessionStore()
const player = usePlayerStore()
const wardrobe = useWardrobeStore()
const device = detectDevice()
/** The device, and whether the parents chose films for the Cinema */
const caps = computed(() => ({ ...device, films: player.films.length > 0 }))
// Doors follow the Stars, the daily goal, the play time and the films: the town repaints them when they change
const doors = computed(() => toDoors(props.buildings, caps.value, player.goalReached, player.stars, player.timeUp))
const stateFor = (b: BuildingDef) => stateOf(b, caps.value, player.goalReached, player.stars, player.timeUp)
/** No mouse, so most likely no keyboard: explain and prompt with fingers */
const fingersOnly = device.touch && !device.keyboard

const CELEBRATION_MS = 3000

const started = ref(false)
const nearId = ref<string | null>(null)
/** The building the child is in; null while in the town */
const inside = shallowRef<BuildingDef | null>(null)
/** The parents' page, over the paused town */
const parentsOpen = ref(false)

const find = (id: string | null) => props.buildings.find(b => b.id === id) ?? null
const near = computed(() => find(nearId.value))
/** The picture of what the daily goal opens */
const prize = computed(() => props.buildings.find(b => b.kind === 'play')?.icon ?? '🎉')

/** The game shows once someone plays and their Stars are known */
const playing = computed(() => session.status === 'ready' && player.loaded && wardrobe.loaded)
// A player without a look yet designs her character first (stage 7), before the town and its help
// Only when the server said so: a wardrobe that couldn't be asked is no reason to choose again
const designing = computed(() => playing.value && wardrobe.known && wardrobe.look === null)
/** The controls, shown over the paused town */
const helpOpen = ref(false)
const inTown = computed(() => started.value && playing.value && inside.value === null && !parentsOpen.value)

// The controls are explained once per person on this device, before their first Star
const helpSeenKey = () => `brightville.helped.${session.person?.id ?? 0}`
function helpSeen(): boolean {
  try {
    return window.localStorage.getItem(helpSeenKey()) === '1'
  } catch {
    return false
  }
}
function closeHelp() {
  helpOpen.value = false
  try {
    window.localStorage.setItem(helpSeenKey(), '1')
  } catch {
    // shown again next time; no harm
  }
}
function offerHelp() {
  if (started.value && playing.value && !designing.value && player.stars === 0 && player.visitsToday === 0 && !helpSeen()) helpOpen.value = true
}

/** Stickers celebrated: seen; and a sticker may have brought an add-on to the wardrobe */
function stickersShown(ids: string[]) {
  void player.celebrated(ids)
  void wardrobe.load()
}

async function lookChosen(look: Look) {
  await wardrobe.saveLook(look)
  offerHelp()
}

function start() {
  unlockAudio()
  started.value = true
  offerHelp()
}

// Someone (new) plays: their Stars come from the server
watch(() => (session.status === 'ready' ? session.person?.id : undefined), async id => {
  if (id === undefined) return
  // A login that ended shows as such: the hub's login, or the closed door
  player.init(props.api, id, undefined, () => void session.retry())
  wardrobe.init(props.api, id)
  await Promise.all([player.refresh(), wardrobe.load()])
  offerHelp()
}, { immediate: true })

function onKey(e: KeyboardEvent) {
  if (e.repeat || (e.code !== 'KeyH' && e.code !== 'F1') || !inTown.value || helpOpen.value) return
  e.preventDefault()
  helpOpen.value = true
}

/** What the voice says in front of a door, by what the door is right now */
function doorLine(b: BuildingDef): string {
  const cost = numberWord(b.cost ?? 0)
  switch (stateFor(b)) {
    case 'locked': return b.kind === 'shop' ? 'Erst lernen, dann einkaufen!' : 'Erst lernen, dann spielen!'
    case 'timeUp': return 'Für heute ist genug gespielt. Morgen wieder!'
    case 'poor': return `Du brauchst ${cost} Sterne.`
    case 'open': return b.kind === 'play' && b.cost ? `${b.spokenName}. Das kostet ${cost} Sterne.` : b.spokenName
    default: return b.spokenName
  }
}

/** What the voice says when today's learning is done: only an affordable door is called open */
function goalLine(): string {
  const prizes = props.buildings.filter(b => b.kind === 'play')
  if (prizes.some(b => stateFor(b) === 'open')) return 'Geschafft! Die Spielhalle ist offen!'
  if (prizes.length > 0 && prizes.every(b => stateFor(b) === 'timeUp')) return 'Geschafft!'
  const cost = Math.min(...prizes.map(b => b.cost ?? 0))
  return prizes.length > 0 ? `Geschafft! Jetzt brauchst du noch ${numberWord(cost)} Sterne.` : 'Geschafft!'
}

/**
 * The play building the child has just come out of. Its door offers nothing
 * until the child has walked away: the Enter that turned cards a moment ago
 * must not buy another round.
 */
const restingId = ref<string | null>(null)
/** True while a building's code is loading or the server is asked at the door */
let entering = false

function onNearDoor(id: string | null) {
  nearId.value = id
  if (id !== restingId.value) restingId.value = null
  const building = find(id)
  if (building && id !== restingId.value) void speak(doorLine(building))
}

async function onEnter(id: string) {
  const building = find(id)
  if (!building || inside.value || entering || id === restingId.value || !playing.value) return
  if (stateFor(building) !== 'open') return
  entering = true
  try {
    try {
      await building.preload?.()
    } catch {
      // Offline or a new version on the server: stay in the town, keep the Stars
      return
    }
    if (inside.value || stateFor(building) !== 'open') return
    // Play costs Stars, taken at the door by the server, which also knows the clock and the play time
    if (building.kind === 'play' && building.cost) {
      const bought = await player.buy(building.id)
      if (bought !== 'ok') {
        if (bought !== 'offline') void speak(doorLine(building))
        return
      }
    }
    if (inside.value) return
    inside.value = building
  } finally {
    entering = false
  }
}

// Time inside a play building counts towards today's play time, reported now and then and on leaving
const PLAY_REPORT_MS = 30_000
let playClock: ReturnType<typeof setInterval> | undefined
let playSince = 0
// Timers stop while the iPad sleeps: one report never counts more than this, so a night with the Arcade open
// doesn't use up the next day's play time
const MAX_PLAY_REPORT_S = 45
function reportPlay() {
  const now = Date.now()
  const seconds = Math.min((now - playSince) / 1000, MAX_PLAY_REPORT_S)
  playSince = now
  void player.reportPlayTime(seconds)
}
// A building's instruction is its own: none is left over for the next building or the town
watch(inside, () => forgetInstruction())

watch(inside, (building, before) => {
  if (before?.kind === 'play') {
    clearInterval(playClock)
    reportPlay()
  }
  if (building?.kind === 'play') {
    playSince = Date.now()
    playClock = setInterval(reportPlay, PLAY_REPORT_MS)
  }
})

// The hub login is in its last week: through the hub once a day at most, while the child walks around
watch(() => session.renewWanted && inTown.value, go => {
  const loginUrl = session.me?.login_url
  if (go && loginUrl) renewOnce(loginUrl, session.navigate)
})

/** Confetti over the town when today's learning is done */
const celebrating = ref(false)
let celebrationTimer: ReturnType<typeof setTimeout> | undefined

async function onFinished(result: BuildingResult) {
  const building = inside.value
  inside.value = null
  if (building?.kind === 'play') {
    restingId.value = building.id
    void player.refresh()
  }
  // Malen and Ausmalen go into the logbook (and count towards a sticker) when something was made; the house doesn't
  if (building?.kind === 'free' && !building.unlogged && result.made) void player.visitFree(building.id)
  // Only earning buildings give Stars and count towards the daily goal
  if (building?.kind !== 'earn' || !(result.stars > 0)) return
  if (await player.earn(building.id, result.stars)) {
    celebrating.value = true
    clearTimeout(celebrationTimer)
    celebrationTimer = setTimeout(() => { celebrating.value = false }, CELEBRATION_MS)
    void speak(goalLine())
  }
}

function onSaved(id: number) {
  // A parent may have changed their own numbers
  if (id === session.person?.id) void player.refresh()
}

function switchPerson() {
  parentsOpen.value = false
  session.switchPerson()
}

// A game left open overnight, or a parent's change elsewhere, must show without a reload
const REFRESH_MS = 60_000
const refresh = () => {
  if (document.visibilityState !== 'hidden' && playing.value) {
    void player.refresh()
    // Sends what waited on the device, then takes the server's wardrobe
    void wardrobe.load()
  }
}
let refreshTimer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  window.addEventListener('keydown', onKey)
  refreshTimer = setInterval(refresh, REFRESH_MS)
  document.addEventListener('visibilitychange', refresh)
  window.addEventListener('online', refresh)
  if (session.status === 'loading' && !session.api) void session.start(props.api)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  clearInterval(refreshTimer)
  clearInterval(playClock)
  clearTimeout(celebrationTimer)
  document.removeEventListener('visibilitychange', refresh)
  window.removeEventListener('online', refresh)
})
</script>

<template>
  <StartGate v-if="!started" @start="start" />
  <WhoPlays v-else-if="session.status === 'choose'" :people="session.people" @choose="session.choose" />
  <ServerScreen v-else-if="session.status === 'offline'" kind="offline" @retry="session.retry" />
  <ServerScreen v-else-if="session.status === 'no_access'" kind="no_access" />
  <LookScreen v-else-if="designing" :start="DEFAULT_LOOK" @done="lookChosen" />
  <main v-else-if="playing" class="game" data-test="game">
    <CityView
      :doors="doors" :paused="inside !== null || helpOpen || parentsOpen" :touch="device.touch" :dress="wardrobe.dress"
      @near-door="onNearDoor" @enter="onEnter"
    />
    <div class="hud">
      <button
        class="badge" data-test="who" :aria-label="session.person?.name"
        :style="{ background: session.person?.color ?? '#ff9a3c' }"
        @pointerdown="session.canSwitch && inTown && switchPerson()"
      >{{ session.person?.name.slice(0, 1).toUpperCase() }}</button>
      <StarCounter />
      <GoalBar :visits="player.visitsToday" :goal="player.dailyGoal" :prize="prize" />
    </div>
    <DoorPrompt
      v-if="near && !inside && !helpOpen && !parentsOpen && near.id !== restingId"
      :icon="near.icon" :state="stateFor(near)" :cost="near.cost" :visits="player.visitsToday" :goal="player.dailyGoal"
      :touch="fingersOnly" @enter="onEnter(near.id)"
    />
    <Confetti v-if="celebrating && !inside" />
    <StickerParade
      v-if="inTown && !celebrating && !helpOpen && player.toCelebrate.length"
      :ids="player.toCelebrate.slice(0, 3)" @done="stickersShown"
    />
    <div v-if="inTown && !helpOpen" class="corner">
      <ParentGate v-if="session.isParent" @open="parentsOpen = true" />
      <button class="round" data-test="help-button" aria-label="Hilfe" @pointerdown="helpOpen = true">?</button>
    </div>
    <HelpOverlay v-if="helpOpen && inTown" :touch="fingersOnly" @close="closeHelp" />
    <ParentArea
      v-if="parentsOpen && session.api" :api="session.api" :logout-url="session.me?.logout_url" :can-switch="session.canSwitch"
      @close="parentsOpen = false" @saved="onSaved" @switch="switchPerson" @films-changed="player.refresh()"
    />
    <section v-if="inside" class="building">
      <component :is="inside.component" @finished="onFinished" />
      <LeaveButton />
      <SayAgain />
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
  padding: 6px 20px 6px 6px;
  border-radius: 999px;
  background: rgb(255 255 255 / 85%);
}
.badge {
  width: 48px;
  height: 48px;
  border: 3px solid #fff;
  border-radius: 50%;
  color: #fff;
  font: 800 24px system-ui, sans-serif;
  cursor: pointer;
  padding: 0;
}
.corner {
  position: fixed;
  top: calc(16px + env(safe-area-inset-top));
  right: calc(16px + env(safe-area-inset-right));
  z-index: 5;
  display: flex;
  gap: 12px;
}
.round {
  width: 60px;
  height: 60px;
  border: 0;
  border-radius: 50%;
  background: rgb(255 255 255 / 85%);
  font: 800 34px system-ui, sans-serif;
  color: #6b4a00;
  cursor: pointer;
}
.round[data-test='parents-button'] { font-size: 28px; }
</style>
