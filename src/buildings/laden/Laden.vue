<script setup lang="ts">
import { computed } from 'vue'
import CharacterView from '@/components/CharacterView.vue'
import Confetti from '@/components/Confetti.vue'
import type { Dress } from '@/core/look'
import { forLevel, shelfOpen, type OutfitDef } from '@/core/outfits'
import { lastPickedLang } from '@/core/vocab/lastLang'
import { usePlayerStore } from '@/stores/player'
import { useRoomStore } from '@/stores/room'
import { useVocabStore } from '@/stores/vocab'
import { useWardrobeStore } from '@/stores/wardrobe'
import ShopShelves from '../shop/ShopShelves.vue'
import { useShop } from '../shop/useShop'
import type { BuildingResult } from '../types'

// The Kleiderladen (stage 7): three shelves of add-ons for her character. Tapping one tries it on; the ✔️ buys it.
// One purchase a day across both shops; saved Stars count half (shop/useShop.ts).
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

const wardrobe = useWardrobeStore()
const room = useRoomStore()

type Sold = OutfitDef & { shelf: 1 | 2 | 3; price: number }
const player = usePlayerStore()
// Each child's own range: hers, or at Oberstufe his
const level = player.level
const sold = forLevel(level).filter((o): o is Sold => o.shelf !== undefined && o.price !== undefined)

// At Oberstufe each item is labelled in the language he picked last (English if none), its German underneath
const ARTICLE: Record<OutfitDef['article'], string> = { der: 'der', die: 'die', das: 'das', pl: 'die' }
// The same child the language screen remembers it for (the vocabulary store's)
const labelLang = lastPickedLang(useVocabStore().who)
const label = level === 'oberstufe'
  ? (o: Sold) => ({ main: o[labelLang] ?? o.name, lang: labelLang, de: `${ARTICLE[o.article]} ${o.name}` })
  : undefined

const { ownedIds, trying, celebrating, canBuy, ready, open, tap, buy } = useShop({
  items: sold,
  owned: () => wardrobe.owned.map(o => o.id),
  shelfOpen: (shelf, owned) => shelfOpen(shelf, owned, level),
  boughtToday: () => wardrobe.boughtToday || room.boughtToday,
  buy: id => wardrobe.buy(id),
  // Both stores: a purchase in either shop counts for both (and yesterday's, after midnight, for neither). Only this
  // shop's own is waited for: the other one hanging mustn't hold up a purchase
  catchUp: () => { void room.load(); return wardrobe.load() },
  welcome: 'Willkommen im Kleiderladen! Tipp auf etwas, dann probierst du es an.',
  leave: () => emit('finished', { stars: 0 }),
})

const dress = computed<Dress>(() => {
  const d = wardrobe.dress
  return trying.value ? { look: d.look, worn: { ...d.worn, [trying.value.place]: trying.value.id } } : d
})
</script>

<template>
  <div class="laden" data-test="laden">
    <div class="mirror">
      <CharacterView :dress="dress" :size="260" />
      <button
        v-if="canBuy" class="buy" data-test="buy" :data-ready="ready" :aria-label="`Kaufen für ${trying!.price} Sterne`"
        @click="buy"
      >✔️ <span class="price">⭐ {{ trying!.price }}</span></button>
    </div>
    <ShopShelves :items="sold" :owned="ownedIds" :trying="trying" :open="open" :label="label" @tap="tap" />
    <Confetti v-if="celebrating" />
  </div>
</template>

<style scoped>
.laden {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3vw;
  /* Below the leave and 🔊 buttons in the top-left corner */
  padding: calc(100px + env(safe-area-inset-top)) 3vw 3vh;
  box-sizing: border-box;
  background: linear-gradient(#ffe5f1, #fff3c4);
}
.mirror { display: flex; flex-direction: column; align-items: center; gap: 14px; }
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
