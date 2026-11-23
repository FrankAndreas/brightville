<script setup lang="ts" generic="T extends ShopItem">
import { SHELVES, type ShopItem } from './useShop'

// A shop's three shelves (stages 7 and 8): a tile per item with its price next to a Star, or ✔️ once she owns it;
// locked shelves greyed, with a 🔒 in the corner. `label`: a name under the picture (his range at Oberstufe: the word in
// his language, the German smaller underneath).
defineProps<{
  items: T[]
  owned: string[]
  trying: T | null
  open: (shelf: 1 | 2 | 3) => boolean
  label?: (item: T) => { main: string; lang: string; de: string } | null
}>()
const emit = defineEmits<{ tap: [item: T] }>()
</script>

<template>
  <div class="shelves">
    <div v-for="s in SHELVES" :key="s" class="shelf" data-test="shelf" :data-shelf="s" :data-open="open(s)">
      <button
        v-for="o in items.filter(x => x.shelf === s)" :key="o.id" class="item" data-test="item" :data-id="o.id"
        :data-owned="owned.includes(o.id)" :data-trying="trying?.id === o.id" :aria-label="o.name" @click="emit('tap', o)"
      >
        <span class="emoji">{{ o.emoji }}</span>
        <span v-if="label?.(o)" class="label" data-test="item-label">
          <span class="main" data-test="label-main" :lang="label(o)!.lang">{{ label(o)!.main }}</span>
          <span class="de" data-test="label-de" lang="de">{{ label(o)!.de }}</span>
        </span>
        <span v-if="owned.includes(o.id)" class="tag">✔️</span>
        <span v-else class="tag">⭐ {{ o.price }}</span>
      </button>
      <span v-if="!open(s)" class="lock" aria-hidden="true">🔒</span>
    </div>
  </div>
</template>

<style scoped>
/* Sized by the narrower side, so the names fit the tiles on an upright iPad too; a long word may break */
.label { display: flex; flex-direction: column; align-items: center; line-height: 1.1; max-width: 100%; padding: 0 3px; box-sizing: border-box; }
.label .main, .label .de { max-width: 100%; text-align: center; overflow-wrap: anywhere; hyphens: auto; }
.label .main { font: 700 clamp(9px, min(1.7vh, 1.55vw), 17px) system-ui, sans-serif; color: #23264a; }
.label .de { font: 500 clamp(8px, min(1.3vh, 1.25vw), 13px) system-ui, sans-serif; color: #5b6070; }
.shelves { display: flex; flex-direction: column; gap: 2.4vh; }
.shelf {
  position: relative;
  display: flex;
  gap: 1.4vw;
  padding: 1.4vh 1.4vw 2vh;
  border-bottom: 10px solid #c89b6d;
  border-radius: 8px;
  background: rgb(255 255 255 / 40%);
}
.shelf[data-open='false'] .item { filter: grayscale(1); opacity: 0.45; }
/* In the shelf's corner, so it hides no item */
.lock { position: absolute; top: -18px; left: -18px; font-size: min(6vh, 44px); pointer-events: none; }
.item {
  /* A shop that needs room for its own picture sets a smaller tile */
  width: var(--tile, min(10.5vw, 96px));
  aspect-ratio: 1;
  border: 4px solid white;
  border-radius: 18px;
  background: white;
  box-shadow: 0 4px 0 rgb(0 0 0 / 10%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  cursor: pointer;
  padding: 0;
}
.item[data-trying='true'] { border-color: #4f8fe8; transform: scale(1.08); }
.item[data-owned='true'] { background: #e8fbef; }
.emoji { font-size: min(5vw, 44px); line-height: 1; }
.tag { font: 700 min(2vw, 17px) system-ui, sans-serif; color: #6b4a00; }
</style>
