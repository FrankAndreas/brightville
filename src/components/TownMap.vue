<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { MARKER_SIZE, type MapMarker, type MapPicture } from '@/city/mapPicture'

// The town from above, all in pictures: tap a building or a district's stop and the bicycle rides there. Nothing here
// needs reading; the voice is App's.
const props = defineProps<{
  picture: MapPicture
  /** Where she is */
  her: { x: number; z: number }
  /** Her colour, as on her badge */
  color: string
}>()
const emit = defineEmits<{ choose: [marker: MapMarker]; close: [] }>()

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`
const box = computed(() => props.picture.box)
const width = computed(() => box.value.maxX - box.value.minX)
const height = computed(() => box.value.maxZ - box.value.minZ)
/** A point of the town as a place on the picture, in per cent of its width and height */
const place = (x: number, z: number) => ({
  left: `${((x - box.value.minX) / width.value) * 100}%`,
  top: `${((z - box.value.minZ) / height.value) * 100}%`,
})
/** A length in metres as a CSS length on the picture, which is a size container */
const metres = (m: number) => `${(m / width.value) * 100}cqw`

const streetPath = (s: { points: { x: number; z: number }[] }) =>
  s.points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.z}`).join(' ')

/** Blocky peaks along the band, the same every time; snow on their tops */
const peaks = computed(() => {
  const band = props.picture.mountains
  const foot = band.maxZ + 2
  const rise = band.maxZ - band.minZ
  const list: { rock: string; snow: string }[] = []
  const step = 13
  for (let i = 0, x = band.minX - 4; x < band.maxX + 4; i++, x += step) {
    const w = step * (1.1 + 0.25 * Math.sin(i * 2.3))
    const top = band.maxZ - rise * (0.55 + 0.35 * Math.abs(Math.sin(i * 1.7 + 0.4)))
    const peakX = x + w / 2
    const snowZ = top + (foot - top) * 0.32
    const snowHalf = (w / 2) * 0.32
    list.push({
      rock: `${x},${foot} ${peakX},${top} ${x + w},${foot}`,
      snow: `${peakX - snowHalf},${snowZ} ${peakX},${top} ${peakX + snowHalf},${snowZ}`,
    })
  }
  return list
})

/** Why a building can't be gone into now: still to learn, played enough today, or (at the door, the price) short of stars */
const CLOSED_SIGN: Partial<Record<MapMarker['state'], string>> = { locked: '🔒', timeUp: '🌙', poor: '⭐' }

function onKey(e: KeyboardEvent) {
  if (e.code === 'Escape' || e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="map" data-test="map" @pointerdown.self="emit('close')">
    <div
      class="picture" data-test="map-picture" :style="{ '--ratio': `${width} / ${height}`, '--aspect': width / height }"
      @pointerdown.stop
    >
      <svg :viewBox="picture.viewBox" preserveAspectRatio="none" aria-hidden="true">
        <rect :x="box.minX" :y="box.minZ" :width="width" :height="height" class="sky" />
        <g class="mountains">
          <template v-for="(p, i) in peaks" :key="i">
            <polygon :points="p.rock" class="rock" /><polygon :points="p.snow" class="snow" />
          </template>
        </g>
        <template v-for="d in picture.districts" :key="d.id">
          <rect
            v-for="(a, i) in d.areas" :key="i" :x="a.minX" :y="a.minZ" :width="a.maxX - a.minX" :height="a.maxZ - a.minZ"
            :fill="hex(a.ground)" :data-district="d.id"
          />
        </template>
        <circle v-for="(h, i) in picture.hills" :key="i" :cx="h.x" :cy="h.z" :r="h.radius * 0.8" class="hill" />
        <path
          v-for="(s, i) in picture.streets" :key="i" :d="streetPath(s)" :stroke-width="s.width"
          :class="s.kind === 'dirt' ? 'dirt' : 'street'"
        />
        <circle :cx="picture.plaza.x" :cy="picture.plaza.z" :r="picture.plaza.radius" class="plaza" />
        <ellipse :cx="picture.lake.x" :cy="picture.lake.z" :rx="picture.lake.rx" :ry="picture.lake.rz" class="lake" />
      </svg>

      <button
        v-for="m in picture.markers" :key="m.id" class="marker" :data-test="`map-marker-${m.id}`" :data-state="m.state"
        :aria-label="m.name" :style="{ ...place(m.pin.x, m.pin.z), width: metres(MARKER_SIZE) }"
        @pointerdown.stop="emit('choose', m)"
      >
        <span class="icon">{{ m.icon }}</span>
        <span v-if="CLOSED_SIGN[m.state]" class="closed-sign">{{ CLOSED_SIGN[m.state] }}</span>
      </button>

      <span class="her" data-test="map-her" aria-hidden="true" :style="{ ...place(her.x, her.z), background: color }" />
    </div>

    <button class="close" data-test="map-close" aria-label="Schliessen" @pointerdown.stop="emit('close')">✕</button>
  </div>
</template>

<style scoped>
.map {
  position: fixed;
  inset: 0;
  z-index: 8;
  display: grid;
  place-items: center;
  background: rgb(60 50 110 / 45%);
}
.picture {
  position: relative;
  container-type: inline-size;
  width: min(calc(100vw - 32px), calc((100vh - 32px) * var(--aspect)));
  width: min(calc(100vw - 32px), calc((100dvh - 32px) * var(--aspect)));
  aspect-ratio: var(--ratio);
  border: 6px solid #fffdf5;
  border-radius: 32px;
  overflow: hidden;
  box-sizing: border-box;
  box-shadow: 0 10px 0 rgb(0 0 0 / 15%);
}
svg { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.sky { fill: #bfe7ff; }
.rock { fill: #6f80a8; }
.snow { fill: #fff; }
.hill { fill: rgb(40 90 30 / 14%); }
.street, .dirt { fill: none; stroke-linecap: round; stroke-linejoin: round; }
.street { stroke: #e9dcc0; }
.dirt { stroke: #b98f5e; }
.plaza { fill: #f6e7c1; }
.lake { fill: #5fb3e8; stroke: #f3e2b3; stroke-width: 1.2; }

.marker {
  position: absolute;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  display: grid;
  place-items: center;
  padding: 0;
  border: 0.35cqw solid #ffd93d;
  border-radius: 50%;
  background: #fffdf5;
  box-shadow: 0 0.5cqw 0 rgb(0 0 0 / 22%);
  cursor: pointer;
  font-size: 4.2cqw;
  line-height: 1;
  touch-action: manipulation;
}
.marker[data-state='stop'] { background: #fff3c4; border-color: #e0a800; }
.marker[data-state='locked'], .marker[data-state='timeUp'], .marker[data-state='poor'] { background: #e6e2da; border-color: #b9b2a6; }
.marker[data-state='locked'] .icon, .marker[data-state='timeUp'] .icon, .marker[data-state='poor'] .icon { opacity: 0.45; }
.marker:active { transform: translate(-50%, -50%) scale(0.92); }
.closed-sign { position: absolute; right: -14%; top: -14%; font-size: 2.6cqw; line-height: 1; }

/* Her: a small dot in her colour, over the pictures but small enough not to hide the one she stands by, and a ripple
   that keeps opening out from it so she finds herself */
.her {
  position: absolute;
  width: 2.4cqw;
  height: 2.4cqw;
  transform: translate(-50%, -50%);
  border: 0.5cqw solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 0.3cqw rgb(0 0 0 / 25%);
  pointer-events: none;
}
.her::after {
  content: '';
  position: absolute;
  inset: -0.5cqw;
  border-radius: 50%;
  background: inherit;
  opacity: 0.5;
  animation: here 1.6s ease-out infinite;
}
@keyframes here {
  to { transform: scale(3.2); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .her::after { animation: none; opacity: 0; }
}

.close {
  position: fixed;
  top: calc(16px + env(safe-area-inset-top));
  right: calc(16px + env(safe-area-inset-right));
  width: 60px;
  height: 60px;
  border: 0;
  border-radius: 50%;
  background: rgb(255 255 255 / 85%);
  font: 800 30px system-ui, sans-serif;
  color: #6b4a00;
  cursor: pointer;
}
</style>
