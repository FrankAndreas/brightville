<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { BUILDINGS, canServe, toDoors } from '@/buildings/registry'
import type { BuildingDef, BuildingResult } from '@/buildings/types'
import CityView from '@/city/CityView.vue'
import DoorPrompt from '@/components/DoorPrompt.vue'
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

function start() {
  unlockAudio()
  started.value = true
}

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
    <CityView :doors="doors" :paused="inside !== null" @near-door="onNearDoor" @enter="onEnter" />
    <StarCounter />
    <DoorPrompt v-if="near && !inside" :icon="near.icon" :open="canServe(near, device)" />
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
</style>
