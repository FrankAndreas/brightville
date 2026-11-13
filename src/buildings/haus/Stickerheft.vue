<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { STICKERS, type StickerDef } from '@/core/stickers'
import { speak } from '@/services/tts'
import { usePlayerStore } from '@/stores/player'

// The sticker book: a space for every sticker there is. Earned ones in colour, the rest as grey outlines,
// so she sees what is still to get. Tapping says what a sticker is for.
const PER_PAGE = 9
// New stickers keep their sparkle this long before they count as seen
const SEEN_AFTER_MS = 1500

const player = usePlayerStore()
const pageIndex = ref(0)
/** The stickers that were new when the book was opened: they keep their sparkle while it is open */
const fresh = new Set(player.unseen)
const pages = Math.ceil(STICKERS.length / PER_PAGE)
const onPage = computed(() => STICKERS.slice(pageIndex.value * PER_PAGE, (pageIndex.value + 1) * PER_PAGE))
const has = (id: string) => player.stickers.some(s => s.id === id)

let seenTimer: ReturnType<typeof setTimeout> | undefined

function say(s: StickerDef) {
  void speak(has(s.id) ? `${s.name}. ${s.for}` : s.for)
}

function turn(by: number) {
  pageIndex.value = Math.min(pages - 1, Math.max(0, pageIndex.value + by))
}

function onKey(e: KeyboardEvent) {
  if (e.code === 'ArrowLeft') turn(-1)
  if (e.code === 'ArrowRight') turn(1)
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  const n = player.stickers.length
  void speak(n === 0 ? 'Hier kommen deine Sticker hin.' : n === 1 ? 'Du hast einen Sticker.' : `Du hast ${n} Sticker.`)
  if (fresh.size) seenTimer = setTimeout(() => void player.sawAll(), SEEN_AFTER_MS)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  clearTimeout(seenTimer)
})
</script>

<template>
  <div class="heft" data-test="stickerheft">
    <button class="arrow" data-test="prev" aria-label="Zurück" :disabled="pageIndex === 0" @click="turn(-1)">◀</button>
    <div class="page">
      <button
        v-for="s in onPage" :key="s.id" class="slot" data-test="sticker" :data-id="s.id" :data-earned="has(s.id)"
        :data-new="fresh.has(s.id)" :aria-label="has(s.id) ? s.name : 'Noch nicht'" :style="{ '--badge': s.color }"
        @click="say(s)"
      >
        <span class="emoji">{{ s.emoji }}</span>
      </button>
    </div>
    <button class="arrow" data-test="next" aria-label="Weiter" :disabled="pageIndex >= pages - 1" @click="turn(1)">▶</button>
    <div class="dots" aria-hidden="true">
      <i v-for="n in pages" :key="n" :data-on="n - 1 === pageIndex" />
    </div>
  </div>
</template>

<style scoped>
.heft {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2vw;
  padding: 96px 3vw 7vh;
  box-sizing: border-box;
}
.page {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3vmin;
  padding: 4vmin;
  border-radius: 28px;
  background: #fff6e8;
  box-shadow: 0 10px 0 #e6d3b3;
}
.slot {
  width: min(17vw, 19vh);
  aspect-ratio: 1;
  border-radius: 50%;
  border: 4px dashed #d9c4a3;
  background: transparent;
  display: grid;
  place-items: center;
  cursor: pointer;
}
.emoji { font-size: min(9vw, 10vh); filter: grayscale(1); opacity: 0.25; }
.slot[data-earned='true'] { border: 6px solid #fff; background: var(--badge); box-shadow: 0 6px 0 rgb(0 0 0 / 12%); }
.slot[data-earned='true'] .emoji { filter: none; opacity: 1; }
.slot[data-new='true'] { animation: sparkle 1s ease-in-out infinite; }
@keyframes sparkle { 50% { transform: scale(1.08) rotate(4deg); box-shadow: 0 0 28px #ffd93d; } }
.arrow {
  width: 76px;
  height: 76px;
  flex: none;
  border-radius: 50%;
  border: 0;
  background: #fff;
  color: #b07d4c;
  font-size: 2rem;
  box-shadow: 0 6px 0 #e3c9a8;
  cursor: pointer;
}
.arrow:disabled { opacity: 0.3; cursor: default; }
.dots { position: absolute; bottom: 3vh; display: flex; gap: 10px; }
.dots i { width: 14px; height: 14px; border-radius: 50%; background: #e6d3b3; }
.dots i[data-on='true'] { background: #b07d4c; }
</style>
