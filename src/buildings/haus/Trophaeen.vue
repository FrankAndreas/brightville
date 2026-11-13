<script setup lang="ts">
import { computed } from 'vue'
import { STICKERS, type StickerDef } from '@/core/stickers'
import { speak } from '@/services/tts'
import { usePlayerStore } from '@/stores/player'

// The trophy shelf in her room (stage 8): every sticker she earned stands on it as a trophy, the others as faint
// outlines, so she sees what is still to get. Tapping one says what it is for, as in the album.
const player = usePlayerStore()

const PER_BOARD = 6
const boards = computed(() => {
  const rows: StickerDef[][] = []
  for (let i = 0; i < STICKERS.length; i += PER_BOARD) rows.push(STICKERS.slice(i, i + PER_BOARD))
  return rows
})
const has = (id: string) => player.stickers.some(s => s.id === id)

function say(s: StickerDef) {
  void speak(has(s.id) ? `${s.name}. ${s.for}` : s.for)
}
</script>

<template>
  <div class="trophies" aria-label="Pokale">
    <div v-for="(board, i) in boards" :key="i" class="board">
      <div class="row">
        <button
          v-for="s in board" :key="s.id" class="trophy" data-test="trophy" :data-id="s.id" :data-earned="has(s.id)"
          :aria-label="s.name" @click.stop="say(s)"
        >
          <span class="cup" :style="has(s.id) ? { background: s.color } : undefined">{{ s.emoji }}</span>
          <span class="foot" />
        </button>
      </div>
      <span class="plank" />
    </div>
  </div>
</template>

<style scoped>
.trophies { display: flex; flex-direction: column; gap: 0.6vh; }
.row { display: flex; justify-content: center; gap: 0.5vw; padding: 0 0.6vw; }
.plank { display: block; height: 10px; border-radius: 5px; background: #9c6b3e; box-shadow: 0 4px 0 #7d5530; }
.trophy {
  border: 0;
  padding: 0;
  background: none;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.cup {
  width: min(4.6vw, 7vh, 48px);
  aspect-ratio: 1;
  border-radius: 50% 50% 40% 40%;
  border: 3px solid #fff;
  display: grid;
  place-items: center;
  font-size: min(2.6vw, 4vh, 28px);
  box-shadow: 0 3px 0 rgb(0 0 0 / 15%);
}
.foot { display: block; width: 60%; height: 7px; margin-top: 2px; border-radius: 3px 3px 0 0; background: #e0b84a; }
.trophy[data-earned='false'] .cup {
  background: none;
  border: 3px dashed #c9a27a;
  box-shadow: none;
  filter: grayscale(1);
  opacity: 0.35;
}
.trophy[data-earned='false'] .foot { background: #d8c3a8; opacity: 0.5; }
.trophy:active .cup { transform: scale(0.94); }
</style>
