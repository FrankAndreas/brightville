<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { keyboardIntents, type IntentSource } from '@/input/intents'
import { createCity, type City } from './city'
import type { DoorDef } from './doors'

const props = defineProps<{ doors: DoorDef[]; paused: boolean }>()
const emit = defineEmits<{ 'near-door': [id: string | null]; enter: [id: string] }>()

const canvas = ref<HTMLCanvasElement | null>(null)
let city: City | null = null
let intents: IntentSource | null = null
let unmounted = false

onMounted(async () => {
  intents = keyboardIntents()
  const created = await createCity({
    canvas: canvas.value!,
    intents,
    doors: props.doors,
    onNearDoor: id => emit('near-door', id),
    onEnter: id => emit('enter', id),
  })
  // The physics engine loads asynchronously; the view may be gone by then
  if (unmounted) {
    created.dispose()
    return
  }
  city = created
  if (props.paused) city.pause()
})

watch(() => props.paused, paused => {
  if (paused) city?.pause()
  else city?.resume()
})

onBeforeUnmount(() => {
  unmounted = true
  city?.dispose()
  intents?.dispose()
})
</script>

<template>
  <canvas ref="canvas" class="city" data-test="city" />
</template>

<style scoped>
.city { position: fixed; inset: 0; width: 100%; height: 100%; display: block; }
</style>
