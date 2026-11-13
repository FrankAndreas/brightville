<script setup lang="ts">
import { computed } from 'vue'
import Confetti from '@/components/Confetti.vue'
import { FURNITURE, furnitureDef, furnitureShelfOpen, type Spot } from '@/core/furniture'
import { useRoomStore } from '@/stores/room'
import { useWardrobeStore } from '@/stores/wardrobe'
import RoomPicture from '../haus/RoomPicture.vue'
import ShopShelves from '../shop/ShopShelves.vue'
import { useShop } from '../shop/useShop'
import type { BuildingResult } from '../types'

// The Möbelhaus (stage 8): three shelves of furniture for her room. Tapping a piece shows it on its spot in a small
// picture of her room; the ✔️ buys it and puts it there. The same rules as the Kleiderladen (shop/useShop.ts).
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

const room = useRoomStore()
const wardrobe = useWardrobeStore()

const { ownedIds, trying, celebrating, canBuy, ready, open, tap, buy } = useShop({
  items: FURNITURE,
  owned: () => room.owned.map(o => o.id),
  shelfOpen: furnitureShelfOpen,
  boughtToday: () => room.boughtToday || wardrobe.boughtToday,
  buy: id => room.buy(id),
  catchUp: () => room.load(),
  welcome: 'Willkommen im Möbelhaus! Tipp auf etwas, dann siehst du es in deinem Zimmer.',
  leave: () => emit('finished', { stars: 0 }),
})

/** Her room as it is, with the piece she is trying on its spot */
const preview = computed<Partial<Record<Spot, string>>>(() =>
  trying.value ? { ...room.placed, [trying.value.spot]: trying.value.id } : room.placed)
const emojiOf = (id: string) => furnitureDef(id)?.emoji
</script>

<template>
  <div class="moebelhaus" data-test="moebelhaus">
    <div class="preview">
      <RoomPicture :placed="preview" :emoji-of="emojiOf" small />
      <button
        v-if="canBuy" class="buy" data-test="buy" :data-ready="ready" :aria-label="`Kaufen für ${trying!.price} Sterne`"
        @click="buy"
      >✔️ <span class="price">⭐ {{ trying!.price }}</span></button>
    </div>
    <ShopShelves :items="FURNITURE" :owned="ownedIds" :trying="trying" :open="open" @tap="tap" />
    <Confetti v-if="celebrating" />
  </div>
</template>

<style scoped>
.moebelhaus {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3vw;
  /* Below the leave and 🔊 buttons in the top-left corner */
  padding: calc(100px + env(safe-area-inset-top)) 3vw 3vh;
  box-sizing: border-box;
  background: linear-gradient(#e3f4e1, #fff3c4);
  /* Smaller tiles than the Kleiderladen's: her room, beside them, has to be big enough to see a piece in */
  --tile: min(8vw, 96px);
}
.preview { display: flex; flex-direction: column; align-items: center; gap: 14px; width: min(33vw, 50vh * 4 / 3); flex: none; }
/* Upright: her room above the shelves, wide */
@media (orientation: portrait) {
  .moebelhaus { flex-direction: column; gap: 3vh; --tile: min(10.5vw, 96px); }
  .preview { width: min(80vw, 34vh * 4 / 3); }
}
.buy {
  min-width: 150px;
  height: 76px;
  border: 0;
  border-radius: 38px;
  background: #4bd37b;
  font: 800 30px system-ui, sans-serif;
  color: #1f5c38;
  box-shadow: 0 6px 0 #2f9e5b;
  cursor: pointer;
}
.buy[data-ready='false'] { background: #d6d6d6; color: #777; box-shadow: 0 6px 0 #b0b0b0; }
</style>
