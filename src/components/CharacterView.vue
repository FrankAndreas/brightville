<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Dress } from '@/core/look'
import { createPreview, type Preview } from '@/city/preview'

// Her character, turning slowly: in the look screen, the shop and the wardrobe (city/preview.ts)
const props = withDefaults(defineProps<{ dress: Dress; size?: number }>(), { size: 280 })

const canvas = ref<HTMLCanvasElement | null>(null)
let preview: Preview | null = null

onMounted(() => {
  try {
    preview = createPreview(canvas.value!)
    preview.setDress(props.dress)
  } catch {
    // No WebGL: the screens still work, without the turning character
    preview = null
  }
})
watch(() => props.dress, dress => preview?.setDress(dress), { deep: true })
onBeforeUnmount(() => preview?.dispose())
</script>

<template>
  <canvas
    ref="canvas" class="character" data-test="character" aria-hidden="true"
    :style="{ width: `${size}px`, height: `${size}px` }"
  />
</template>

<style scoped>
.character { display: block; max-width: 100%; aspect-ratio: 1; }
</style>
