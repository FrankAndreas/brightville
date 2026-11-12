<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import TouchControls from '@/components/TouchControls.vue'
import { keyboardIntents, type IntentSource } from '@/input/intents'
import { mergeIntents } from '@/input/merge'
import { touchIntents } from '@/input/touch'
import { createCity, type City } from './city'
import type { DoorDef } from './doors'

const props = defineProps<{
  doors: DoorDef[]
  paused: boolean
  /** Shows the stick and the jump button */
  touch?: boolean
}>()
const emit = defineEmits<{ 'near-door': [id: string | null]; enter: [id: string] }>()

const canvas = ref<HTMLCanvasElement | null>(null)
let city: City | null = null
// Fingers and keys both steer; the town reads them as one
const fingers = touchIntents()
let intents: IntentSource | null = null
let unmounted = false

onMounted(async () => {
  intents = mergeIntents(keyboardIntents(), fingers)
  const initialDoors = props.doors
  const created = await createCity({
    canvas: canvas.value!,
    intents,
    doors: initialDoors,
    onNearDoor: id => emit('near-door', id),
    onEnter: id => emit('enter', id),
  })
  // The physics engine loads asynchronously; the view may be gone by then
  if (unmounted) {
    created.dispose()
    return
  }
  city = created
  // The doors may have changed while the town was loading
  if (props.doors !== initialDoors) city.setDoors(props.doors)
  if (props.paused) city.pause()
})

watch(() => props.paused, paused => {
  if (paused) city?.pause()
  else city?.resume()
})

watch(() => props.doors, doors => city?.setDoors(doors))

onBeforeUnmount(() => {
  unmounted = true
  city?.dispose()
  intents?.dispose()
})
</script>

<template>
  <canvas ref="canvas" class="city" data-test="city" />
  <TouchControls v-if="touch && !paused" :source="fingers" />
</template>

<style scoped>
.city { position: fixed; inset: 0; width: 100%; height: 100%; display: block; }
</style>
