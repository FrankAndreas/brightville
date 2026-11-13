<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import CharacterView from '@/components/CharacterView.vue'
import Confetti from '@/components/Confetti.vue'
import { starsSaid } from '@/core/diary'
import type { Dress } from '@/core/look'
import { numberWord } from '@/core/numbers'
import { OUTFITS, outfitDef, shelfOpen, shopMoney, type OutfitDef } from '@/core/outfits'
import { instruct, speak, stopSpeaking } from '@/services/tts'
import { usePlayerStore } from '@/stores/player'
import { useWardrobeStore } from '@/stores/wardrobe'
import { onLeaveRequest } from '../leave'
import type { BuildingResult } from '../types'

// The Kleiderladen (stage 7): three shelves of add-ons for her character. Tapping one tries it on; the ✔️ buys it.
// One purchase a day; saved Stars count half (the server decides, core/outfits.ts shows what it will decide).
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

const player = usePlayerStore()
const wardrobe = useWardrobeStore()

const SHELVES = [1, 2, 3] as const
const TO_OPEN = 2
const CONFETTI_MS = 2500

const sold = OUTFITS.filter(o => o.shelf !== undefined && o.price !== undefined)
const ownedIds = computed(() => wardrobe.owned.map(o => o.id))
const open = (shelf: 1 | 2 | 3) => shelfOpen(shelf, ownedIds.value)
const money = computed(() => shopMoney(player.stars, player.savings))

/** What she is trying on, not bought (yet) */
const trying = ref<OutfitDef | null>(null)
const busy = ref(false)
const celebrating = ref(false)
const dress = computed<Dress>(() => {
  const d = wardrobe.dress
  return trying.value ? { look: d.look, worn: { ...d.worn, [trying.value.place]: trying.value.id } } : d
})
const canBuy = computed(() => !!trying.value && !ownedIds.value.includes(trying.value.id) && open(trying.value.shelf!))
const ready = computed(() => canBuy.value && !wardrobe.boughtToday && money.value >= trying.value!.price!)

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const POSSESSIVE = { der: ['Der', 'ist deiner'], die: ['Die', 'ist deine'], das: ['Das', 'ist deins'], pl: ['Die', 'sind deine'] } as const
const yours = (o: OutfitDef) => `${POSSESSIVE[o.article][0]} ${o.name} ${POSSESSIVE[o.article][1]}!`

let closed = false
let stopLeaveRequests = () => {}
let confettiTimer: ReturnType<typeof setTimeout> | undefined

function tap(o: OutfitDef) {
  if (busy.value) return
  if (!open(o.shelf!)) {
    const above = ownedIds.value.filter(id => outfitDef(id)?.shelf === o.shelf! - 1).length
    const more = TO_OPEN - above
    void speak(more === 1
      ? 'Kauf noch ein Teil von oben, dann geht dieses Regal auf.'
      : `Kauf noch ${numberWord(more)} Teile von oben, dann geht dieses Regal auf.`)
    return
  }
  trying.value = o
  void instruct(ownedIds.value.includes(o.id) ? `${o.name}. Das hast du schon.` : `${o.name}. ${cap(starsSaid(o.price!))}.`)
}

async function buy() {
  const o = trying.value
  if (!o || !canBuy.value || busy.value) return
  if (wardrobe.boughtToday) {
    void speak('Heute hast du schon etwas gekauft. Morgen kannst du wieder etwas aussuchen.')
    return
  }
  if (money.value < o.price!) {
    const missing = o.price! - money.value
    void speak(`Dafür brauchst du noch ${missing === 1 ? 'einen Stern' : starsSaid(missing)}.`)
    return
  }
  busy.value = true
  const shelvesBefore = SHELVES.filter(open)
  const result = await wardrobe.buy(o.id)
  busy.value = false
  if (closed) return
  if (result === 'ok') {
    trying.value = null
    const newShelf = SHELVES.some(s => open(s) && !shelvesBefore.includes(s))
    void speak(newShelf ? `${yours(o)} Ein neues Regal!` : yours(o))
    celebrating.value = true
    clearTimeout(confettiTimer)
    confettiTimer = setTimeout(() => { celebrating.value = false }, CONFETTI_MS)
  } else if (result === 'bought_today') {
    void speak('Heute hast du schon etwas gekauft. Morgen kannst du wieder etwas aussuchen.')
  } else if (result === 'poor') {
    void speak('Dafür hast du noch nicht genug Sterne.')
  } else {
    void speak('Das hat gerade nicht geklappt. Versuch es nochmal.')
  }
}

function leave() {
  if (closed) return
  closed = true
  window.removeEventListener('keydown', onKey)
  stopLeaveRequests()
  stopSpeaking()
  emit('finished', { stars: 0 })
}

function onKey(e: KeyboardEvent) {
  if (e.code === 'Escape' && !e.repeat) leave()
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  stopLeaveRequests = onLeaveRequest(leave)
  void instruct('Willkommen im Kleiderladen! Tipp auf etwas, dann probierst du es an.')
})
onBeforeUnmount(() => {
  closed = true
  window.removeEventListener('keydown', onKey)
  stopLeaveRequests()
  clearTimeout(confettiTimer)
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
    <div class="shelves">
      <div
        v-for="s in SHELVES" :key="s" class="shelf" data-test="shelf" :data-shelf="s" :data-open="open(s)"
      >
        <button
          v-for="o in sold.filter(x => x.shelf === s)" :key="o.id" class="item" data-test="item" :data-id="o.id"
          :data-owned="ownedIds.includes(o.id)" :data-trying="trying?.id === o.id" :aria-label="o.name" @click="tap(o)"
        >
          <span class="emoji">{{ o.emoji }}</span>
          <span v-if="ownedIds.includes(o.id)" class="tag">✔️</span>
          <span v-else class="tag">⭐ {{ o.price }}</span>
        </button>
        <span v-if="!open(s)" class="lock" aria-hidden="true">🔒</span>
      </div>
    </div>
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
.lock { position: absolute; inset: 0; display: grid; place-items: center; font-size: min(8vh, 64px); pointer-events: none; }
.item {
  width: min(10.5vw, 96px);
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
