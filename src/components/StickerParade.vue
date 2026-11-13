<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import Confetti from '@/components/Confetti.vue'
import { giftFor } from '@/core/outfits'
import { stickerDef } from '@/core/stickers'
import { playBeat } from '@/services/sound'
import { speak } from '@/services/tts'

// New stickers, one after another: each grows big in the middle with confetti and is named, then flies off
// towards the house. The ids are taken when it opens; `done` names the ones shown.
const props = defineProps<{ ids: string[] }>()
const emit = defineEmits<{ done: [ids: string[]] }>()

const SHOW_MS = 3500

const ids = [...props.ids].filter(id => stickerDef(id))
const index = ref(0)
const current = computed(() => stickerDef(ids[index.value] ?? ''))
let timer: ReturnType<typeof setTimeout> | undefined
// "Und dazu …": what you get, by the add-on's article
const A_GIFT = { der: 'einen', die: 'eine', das: 'ein', pl: 'die' } as const

function show() {
  const s = current.value
  if (!s) {
    emit('done', ids)
    return
  }
  playBeat('sparkle')
  const gift = giftFor(s.id)
  void speak(gift ? `Ein neuer Sticker: ${s.name}! Und dazu ${A_GIFT[gift.article]} ${gift.name}!` : `Ein neuer Sticker: ${s.name}!`)
  timer = setTimeout(() => {
    index.value += 1
    show()
  }, SHOW_MS)
}

onMounted(show)
onBeforeUnmount(() => clearTimeout(timer))
</script>

<template>
  <div v-if="current" class="parade" aria-hidden="true">
    <div :key="current.id" class="sticker" data-test="sticker-parade" :data-id="current.id" :style="{ background: current.color }">
      {{ current.emoji }}
      <span v-if="giftFor(current.id)" class="gift" data-test="parade-gift">{{ giftFor(current.id)!.emoji }}</span>
    </div>
    <Confetti />
  </div>
</template>

<style scoped>
.parade { position: fixed; inset: 0; z-index: 15; display: grid; place-items: center; pointer-events: none; }
/* The add-on a sticker brings, on its edge */
.gift {
  position: absolute;
  right: -6%;
  bottom: -6%;
  width: 38%;
  aspect-ratio: 1;
  border-radius: 50%;
  border: 8px solid white;
  background: #fff3c4;
  display: grid;
  place-items: center;
  font-size: 0.4em;
}
.sticker {
  position: relative;
  width: min(42vw, 42vh);
  aspect-ratio: 1;
  border-radius: 50%;
  border: 12px solid white;
  display: grid;
  place-items: center;
  font-size: min(24vw, 24vh);
  box-shadow: 0 16px 0 rgb(0 0 0 / 15%);
  /* Grows in, waits, then flies off towards the house at the front */
  animation: arrive 3.5s ease-in-out both;
}
@keyframes arrive {
  0% { transform: scale(0.1) rotate(-30deg); opacity: 0; }
  15% { transform: scale(1.1) rotate(6deg); opacity: 1; }
  22% { transform: scale(1) rotate(0); }
  80% { transform: scale(1) translate(0, 0); opacity: 1; }
  100% { transform: scale(0.15) translate(-60vw, 120vh); opacity: 0; }
}
</style>
