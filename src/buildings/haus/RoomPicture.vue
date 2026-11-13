<script setup lang="ts">
import { SPOTS, type Spot } from '@/core/furniture'

// Her room, drawn (stage 8): wall, window, floor and the seven furniture spots. In the house it is the room she
// taps in (interactive); in the Möbelhaus a small copy shows a piece on its spot before she buys it. Everything is
// placed in percent of the room and sized in container units, so the small copy is the same picture, smaller.
// The house lays its own things (book, album, trophies, wardrobe) over it, through the slot.
const props = defineProps<{
  placed: Partial<Record<Spot, string>>
  interactive?: boolean
  small?: boolean
  /** The emoji of a placed piece; a piece it doesn't know draws as an empty spot */
  emojiOf?: (id: string) => string | undefined
}>()
const emit = defineEmits<{ spot: [spot: Spot] }>()

/** Where each spot is, in percent of the room: left, top, width, height */
const RECTS: Record<Spot, [number, number, number, number]> = {
  bild: [5, 15, 13, 18],
  vorhang: [21, 9, 22, 7],
  lampe: [45, 1, 10, 13],
  bett: [2, 64, 27, 30],
  teppich: [30, 86, 32, 11],
  pflanze: [62, 66, 9, 26],
  spielzeug: [72, 74, 11, 20],
}

const emoji = (spot: Spot) => {
  const id = props.placed[spot]
  return id ? props.emojiOf?.(id) : undefined
}
const box = (spot: Spot) => {
  const [left, top, width, height] = RECTS[spot]
  return { left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }
}

function tap(spot: Spot) {
  if (props.interactive) emit('spot', spot)
}
</script>

<template>
  <div class="room-picture" :data-small="small">
    <div class="wall" />
    <div class="floor" />
    <div class="window" aria-hidden="true">☀️</div>
    <button
      v-for="spot in SPOTS" :key="spot" class="spot" data-test="spot" :data-spot="spot" :data-empty="!emoji(spot)"
      :style="box(spot)" :aria-label="spot" :tabindex="interactive ? 0 : -1" @click="tap(spot)"
    >
      <span v-if="emoji(spot)" class="piece">{{ emoji(spot) }}</span>
    </button>
    <slot />
  </div>
</template>

<style scoped>
.room-picture { position: absolute; inset: 0; container-type: size; overflow: hidden; }
.room-picture[data-small='true'] { position: relative; inset: auto; width: 100%; aspect-ratio: 4 / 3; border-radius: 18px; }
.wall { position: absolute; inset: 0 0 38% 0; background: #fbe8d3; }
.floor { position: absolute; inset: 62% 0 0 0; background: #d9a877; }
.window {
  position: absolute;
  left: 23%;
  top: 14%;
  width: 18%;
  height: 24%;
  display: grid;
  place-items: center;
  font-size: 12cqh;
  border: 1.4cqh solid #fff;
  border-radius: 2cqh;
  background: #bfe7ff;
  box-sizing: border-box;
}
.spot {
  position: absolute;
  border: 0;
  padding: 0;
  background: none;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.spot[data-empty='true'] { border: 0.5cqh dashed rgb(160 120 80 / 45%); border-radius: 2cqh; }
.spot[data-spot='teppich'][data-empty='true'] { border-radius: 50%; }
.piece { font-size: 20cqh; line-height: 1; filter: drop-shadow(0 0.8cqh 0 rgb(0 0 0 / 12%)); }
.spot[data-spot='vorhang'] .piece, .spot[data-spot='teppich'] .piece { font-size: 9cqh; }
.spot[data-spot='lampe'] .piece { font-size: 11cqh; }
.spot[data-spot='bild'] .piece { font-size: 14cqh; }
.room-picture[data-small='true'] .spot { cursor: default; }
</style>
