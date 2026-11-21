<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import TouchControls from '@/components/TouchControls.vue'
import { keyboardIntents, type IntentSource } from '@/input/intents'
import { mergeIntents } from '@/input/merge'
import { touchIntents } from '@/input/touch'
import { createCity, type City } from './city'
import { START } from './map'
import type { DoorDef } from './doors'
import type { Dress } from '@/core/look'
import type { RideTarget } from './ride'

const props = defineProps<{
  doors: DoorDef[]
  paused: boolean
  /** Shows the stick and the jump button */
  touch?: boolean
  /** Her look and what she wears */
  dress?: Dress
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
  if (props.dress) city.setDress(props.dress)
})

watch(() => props.paused, paused => {
  if (paused) city?.pause()
  else city?.resume()
})

watch(() => props.doors, doors => city?.setDoors(doors))
watch(() => props.dress, dress => { if (dress) city?.setDress(dress) }, { deep: true })

/** Rides her there on the bicycle; 'there' when she already is, or before the town has loaded */
function rideTo(target: RideTarget): 'riding' | 'there' {
  return city?.rideTo(target) ?? 'there'
}
/** Where she is in the town; the start before it has loaded */
function position(): { x: number; z: number } {
  return city?.position() ?? { x: START.x, z: START.z }
}
defineExpose({ rideTo, position })

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
