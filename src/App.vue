<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { BUILDINGS, canServe, toDoors } from '@/buildings/registry'
import type { BuildingDef, BuildingResult } from '@/buildings/types'
import CityView from '@/city/CityView.vue'
import DoorPrompt from '@/components/DoorPrompt.vue'
import HelpOverlay from '@/components/HelpOverlay.vue'
import StarCounter from '@/components/StarCounter.vue'
import StartGate from '@/components/StartGate.vue'
import { detectDevice } from '@/services/device'
import { unlockAudio } from '@/services/sound'
import { speak } from '@/services/tts'
import { usePlayerStore } from '@/stores/player'

const props = withDefaults(defineProps<{ buildings?: BuildingDef[] }>(), { buildings: () => BUILDINGS })

const player = usePlayerStore()
const device = detectDevice()
const doors = toDoors(props.buildings, device)

const started = ref(false)
const nearId = ref<string | null>(null)
/** The building the child is in; null while in the town */
const inside = shallowRef<BuildingDef | null>(null)

const find = (id: string | null) => props.buildings.find(b => b.id === id) ?? null
const near = computed(() => find(nearId.value))

/** The controls, shown over the paused town */
const helpOpen = ref(false)
const inTown = computed(() => started.value && inside.value === null)

function start() {
  unlockAudio()
  started.value = true
  // A new player gets the controls explained once without asking
  if (player.stars === 0) helpOpen.value = true
}

function onKey(e: KeyboardEvent) {
  if ((e.code !== 'KeyH' && e.code !== 'F1') || !inTown.value || helpOpen.value) return
  e.preventDefault()
  helpOpen.value = true
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

function onNearDoor(id: string | null) {
  nearId.value = id
  const building = find(id)
  if (building) void speak(building.spokenName)
}

function onEnter(id: string) {
  const building = find(id)
  if (!building || !canServe(building, device)) return
  inside.value = building
}

function onFinished(result: BuildingResult) {
  player.award(result.stars)
  inside.value = null
}
</script>

<template>
  <StartGate v-if="!started" @start="start" />
  <main v-else class="game" data-test="game">
    <CityView :doors="doors" :paused="inside !== null || helpOpen" @near-door="onNearDoor" @enter="onEnter" />
    <StarCounter />
    <DoorPrompt v-if="near && !inside && !helpOpen" :icon="near.icon" :open="canServe(near, device)" />
    <button v-if="inTown && !helpOpen" class="help-button" data-test="help-button" aria-label="Hilfe" @pointerdown="helpOpen = true">?</button>
    <HelpOverlay v-if="helpOpen && inTown" @close="helpOpen = false" />
    <section v-if="inside" class="building">
      <component :is="inside.component" @finished="onFinished" />
    </section>
  </main>
</template>

<style>
html, body, #app { height: 100%; margin: 0; overflow: hidden; }
body { background: #bfe7ff; font-family: system-ui, sans-serif; touch-action: none; user-select: none; }
.game { position: fixed; inset: 0; }
.building { position: fixed; inset: 0; z-index: 10; }
.help-button {
  position: fixed;
  top: 16px;
  right: 16px;
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
