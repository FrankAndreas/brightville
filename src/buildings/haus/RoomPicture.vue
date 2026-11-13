<script setup lang="ts">
import { SPOTS, type Spot } from '@/core/furniture'
import { SPOT_NAMES, SPOT_RECTS, WINDOW_RECT, percent } from './roomLayout'

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

const emoji = (spot: Spot) => {
  const id = props.placed[spot]
  return id ? props.emojiOf?.(id) : undefined
}
const box = (spot: Spot) => percent(SPOT_RECTS[spot])
const windowBox = percent(WINDOW_RECT)

function tap(spot: Spot) {
  if (props.interactive) emit('spot', spot)
}
</script>

<template>
  <div class="room-picture" :data-small="small" :data-interactive="interactive">
    <div class="wall" />
    <div class="floor" />
    <div class="window" :style="windowBox" aria-hidden="true">☀️</div>
    <button
      v-for="spot in SPOTS" :key="spot" class="spot" data-test="spot" :data-spot="spot" :data-empty="!emoji(spot)"
      :style="box(spot)" :aria-label="SPOT_NAMES[spot]" :tabindex="interactive ? 0 : -1" :aria-hidden="!interactive"
      @click="tap(spot)"
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
/* Sized by the smaller of the room's height and width, so a tall (upright) screen keeps every piece in its spot */
.piece { font-size: min(20cqh, 14cqw); line-height: 1; filter: drop-shadow(0 0.8cqh 0 rgb(0 0 0 / 12%)); }
.spot[data-spot='vorhang'] .piece, .spot[data-spot='teppich'] .piece { font-size: min(9cqh, 8cqw); }
.spot[data-spot='lampe'] .piece { font-size: min(11cqh, 8cqw); }
.spot[data-spot='bild'] .piece { font-size: min(14cqh, 10cqw); }
/* Not to be chosen (no furniture yet, or the shop's small picture): no buttons that do nothing */
.room-picture:not([data-interactive='true']) .spot { pointer-events: none; cursor: default; }
</style>
