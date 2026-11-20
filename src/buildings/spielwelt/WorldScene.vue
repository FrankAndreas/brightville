<script setup lang="ts">
import { computed } from 'vue'
import { CAR, GROUND, WORLD_WIDTH, type WorldObject } from '@/core/world'

// The world's landscape and its objects, drawn once in world units (100 high, WORLD_WIDTH wide). Flat and friendly;
// the house is cut open so its room shows.
const props = defineProps<{ objects: WorldObject[]; lit: string | null }>()
/** The car is drawn last: it drives in front of whatever it passes */
const drawn = computed(() => [...props.objects].sort((a, b) => Number(a.id === CAR) - Number(b.id === CAR)))
const emit = defineEmits<{ object: [id: string, event: PointerEvent] }>()

const left = (o: WorldObject) => o.x - o.w / 2
const top = (o: WorldObject) => GROUND - o.h
</script>

<template>
  <g>
    <!-- Sky, hills, the ground -->
    <rect x="0" y="0" :width="WORLD_WIDTH" height="100" fill="#cfeaff" />
    <ellipse v-for="hx in [120, 420, 700]" :key="hx" :cx="hx" cy="82" rx="130" ry="26" fill="#bfe3b0" />
    <rect x="0" :y="GROUND" :width="WORLD_WIDTH" :height="100 - GROUND" fill="#8fd17c" />
    <!-- The house, cut open: its back wall, floor and roof -->
    <rect x="2" y="30" width="166" :height="GROUND - 30" fill="#fff3d9" stroke="#d9b98c" stroke-width="1.2" />
    <polygon points="-4,31 85,8 174,31" fill="#e57373" stroke="#b44f4f" stroke-width="1.2" />
    <rect x="2" :y="GROUND" width="166" height="3" fill="#c9a06b" />
    <!-- The pond under the bridge -->
    <ellipse cx="395" :cy="GROUND + 6" rx="58" ry="8" fill="#5fb3e8" />
    <!-- The street by the garage -->
    <rect x="640" :y="GROUND" width="130" height="9" fill="#9aa1a8" />
    <rect v-for="sx in [655, 685, 715, 745]" :key="sx" :x="sx" :y="GROUND + 4" width="12" height="1.2" fill="#fff" />

    <g
      v-for="o in drawn" :key="o.id" class="object" :data-test="`object-${o.id}`" :data-x="o.x"
      :data-lit="lit === `object-${o.id}`" @pointerdown="emit('object', o.id, $event)"
    >
      <template v-if="o.id === 'bett'">
        <rect :x="left(o)" :y="top(o) + 6" :width="o.w" height="5" rx="1.5" fill="#7e57c2" />
        <rect :x="left(o)" :y="top(o)" width="3" :height="o.h" fill="#8d6e63" />
        <rect :x="left(o) + o.w - 3" :y="top(o) + 4" width="3" :height="o.h - 4" fill="#8d6e63" />
        <rect :x="left(o) + 4" :y="top(o) + 3" width="8" height="3.5" rx="1.5" fill="#fff" />
      </template>
      <template v-else-if="o.id === 'tisch'">
        <rect :x="left(o)" :y="top(o)" :width="o.w" height="2.5" fill="#a1887f" />
        <rect :x="left(o) + 2" :y="top(o)" width="2" :height="o.h" fill="#8d6e63" />
        <rect :x="left(o) + o.w - 4" :y="top(o)" width="2" :height="o.h" fill="#8d6e63" />
      </template>
      <template v-else-if="o.id === 'schrank'">
        <rect :x="left(o)" :y="top(o)" :width="o.w" :height="o.h" rx="1" fill="#bcaaa4" stroke="#8d6e63" stroke-width="1" />
        <line :x1="o.x" :y1="top(o) + 2" :x2="o.x" :y2="GROUND - 2" stroke="#8d6e63" stroke-width="0.8" />
      </template>
      <template v-else-if="o.id === 'kiste' || o.id === 'sandkasten'">
        <rect :x="left(o)" :y="top(o)" :width="o.w" :height="o.h" :fill="o.id === 'kiste' ? '#ffb74d' : '#c8a165'" stroke="#a1774a" stroke-width="1" />
        <rect v-if="o.id === 'sandkasten'" :x="left(o) + 1.5" :y="top(o) + 1" :width="o.w - 3" height="2.5" fill="#f2dc9b" />
        <!-- The box is open: its dark inside shows at the top -->
        <rect v-if="o.id === 'kiste'" :x="left(o) + 1.5" :y="top(o) + 0.8" :width="o.w - 3" height="2.2" fill="#a1662f" />
      </template>
      <template v-else-if="o.id === 'baum'">
        <rect :x="o.x - 3" :y="GROUND - 30" width="6" height="30" fill="#8d6e63" />
        <circle :cx="o.x" :cy="top(o) + 16" r="15" fill="#66bb6a" />
        <circle :cx="o.x - 9" :cy="top(o) + 24" r="9" fill="#5cae60" />
        <circle :cx="o.x + 9" :cy="top(o) + 24" r="9" fill="#5cae60" />
      </template>
      <template v-else-if="o.id === 'bank'">
        <rect :x="left(o)" :y="top(o)" :width="o.w" height="2.5" fill="#8d6e63" />
        <rect :x="left(o)" :y="top(o) - 6" :width="o.w" height="2" fill="#8d6e63" />
        <rect :x="left(o) + 2" :y="top(o)" width="2" :height="o.h" fill="#6d4c41" />
        <rect :x="left(o) + o.w - 4" :y="top(o)" width="2" :height="o.h" fill="#6d4c41" />
      </template>
      <template v-else-if="o.id === 'zaun'">
        <rect v-for="k in 5" :key="k" :x="left(o) + (k - 1) * 7" :y="top(o)" width="3" :height="o.h" fill="#fff8e1" stroke="#bfae8c" stroke-width="0.6" />
        <rect :x="left(o)" :y="top(o) + 4" :width="o.w" height="2" fill="#fff8e1" />
      </template>
      <template v-else-if="o.id === 'bruecke'">
        <path :d="`M${left(o)} ${GROUND} Q${o.x} ${top(o) - 6} ${left(o) + o.w} ${GROUND}`" fill="none" stroke="#a1887f" stroke-width="3" />
        <rect :x="left(o)" :y="top(o)" :width="o.w" height="2" fill="#8d6e63" />
      </template>
      <template v-else-if="o.id === 'rutschbahn'">
        <rect :x="left(o)" :y="top(o)" width="2" :height="o.h" fill="#e53935" />
        <rect :x="left(o) + 8" :y="top(o)" width="2" :height="o.h" fill="#e53935" />
        <path :d="`M${left(o) + 9} ${top(o)} L${left(o) + o.w} ${GROUND}`" stroke="#fbc02d" stroke-width="3" />
        <rect :x="left(o)" :y="top(o)" width="10" height="2" fill="#e53935" />
      </template>
      <template v-else-if="o.id === 'schaukel'">
        <path :d="`M${left(o)} ${GROUND} L${o.x} ${top(o)} L${left(o) + o.w} ${GROUND}`" fill="none" stroke="#1e88e5" stroke-width="2" />
        <line :x1="o.x" :y1="top(o)" :x2="o.x - 3" :y2="(o.top ?? GROUND)" stroke="#555" stroke-width="0.6" />
        <line :x1="o.x" :y1="top(o)" :x2="o.x + 3" :y2="(o.top ?? GROUND)" stroke="#555" stroke-width="0.6" />
        <rect :x="o.x - 5" :y="(o.top ?? GROUND)" width="10" height="1.8" fill="#6d4c41" />
      </template>
      <template v-else-if="o.id === 'garage' || o.id === 'hundehuette'">
        <rect :x="left(o)" :y="top(o) + o.h * 0.3" :width="o.w" :height="o.h * 0.7" :fill="o.id === 'garage' ? '#b0bec5' : '#a1887f'" />
        <polygon :points="`${left(o) - 2},${top(o) + o.h * 0.32} ${o.x},${top(o)} ${left(o) + o.w + 2},${top(o) + o.h * 0.32}`" :fill="o.id === 'garage' ? '#78909c' : '#6d4c41'" />
        <rect :x="o.x - o.w * 0.25" :y="top(o) + o.h * 0.5" :width="o.w * 0.5" :height="o.h * 0.5" :fill="o.id === 'garage' ? '#eceff1' : '#3e2723'" />
      </template>
      <template v-else-if="o.id === 'auto'">
        <rect :x="left(o)" :y="top(o) + 3" :width="o.w" :height="o.h - 6" rx="3" fill="#e53935" />
        <path :d="`M${left(o) + 6} ${top(o) + 4} L${left(o) + 10} ${top(o) - 3} L${left(o) + 21} ${top(o) - 3} L${left(o) + 25} ${top(o) + 4} Z`" fill="#ef5350" />
        <rect :x="left(o) + 11" :y="top(o) - 1.5" width="9" height="4.5" fill="#bbdefb" />
        <circle :cx="left(o) + 7" :cy="GROUND - 3" r="3.2" fill="#333" />
        <circle :cx="left(o) + o.w - 7" :cy="GROUND - 3" r="3.2" fill="#333" />
      </template>
      <template v-else-if="o.id === 'stein'">
        <ellipse :cx="o.x" :cy="GROUND - o.h / 2" :rx="o.w / 2" :ry="o.h / 2" fill="#9e9e9e" />
      </template>
      <template v-else-if="o.id === 'busch'">
        <circle v-for="(c, k) in [[-8, 6], [0, 9], [8, 6]]" :key="k" :cx="o.x + c[0]" :cy="GROUND - c[1]" r="9" fill="#43a047" />
      </template>
    </g>
  </g>
</template>

<style scoped>
.object[data-lit='true'] { filter: drop-shadow(0 0 2px #ffd93d) drop-shadow(0 0 2px #ffd93d); }
</style>
