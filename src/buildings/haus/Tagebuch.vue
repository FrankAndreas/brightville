<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { entrySaid, shortDate, spokenDate, type LogDay, type LogEntry } from '@/core/diary'
import { stickerDef } from '@/core/stickers'
import { paintingUrl, type Api } from '@/services/api'
import { furnitureDef } from '@/core/furniture'
import { outfitDef } from '@/core/outfits'
import { speak } from '@/services/tts'
import { BUILDINGS } from '../registry'

// The logbook: one page per day she did something, newest first. Pictures only; tapping says what it was.
const props = defineProps<{ api: Api }>()

const PAGE_DAYS = 7

const days = ref<LogDay[]>([])
const index = ref(0)
const status = ref<'loading' | 'ready' | 'error'>('loading')
/** Whether the server may have older days than those loaded */
const more = ref(true)
let fetching = false

const page = computed(() => days.value[index.value] ?? null)
const canOlder = computed(() => index.value < days.value.length - 1 || more.value)

const building = (id: string) => BUILDINGS.find(b => b.id === id)
// A purchase names what was bought (an add-on or a piece of furniture: their ids never clash) where a visit names its
// building
const bought = (id: string) => outfitDef(id) ?? furnitureDef(id)
const nameOf = (id: string, kind?: LogEntry['kind']) =>
  (kind === 'buy' ? bought(id)?.name : building(id)?.spokenName) ?? id
const iconOf = (id: string, kind?: LogEntry['kind']) => (kind === 'buy' ? bought(id)?.emoji : building(id)?.icon) ?? '❓'

async function fetchMore(): Promise<number> {
  if (fetching) return 0
  fetching = true
  try {
    const before = days.value.at(-1)?.day
    const got = await props.api.logbook(before, PAGE_DAYS)
    days.value = [...days.value, ...got]
    if (got.length < PAGE_DAYS) more.value = false
    return got.length
  } finally {
    fetching = false
  }
}

function sayDay() {
  if (page.value) void speak(spokenDate(page.value.day))
}

async function older() {
  if (index.value >= days.value.length - 1) {
    if (!more.value) return
    try {
      if ((await fetchMore()) === 0) return
    } catch {
      return
    }
  }
  index.value += 1
  sayDay()
}

function newer() {
  if (index.value === 0) return
  index.value -= 1
  sayDay()
}

const sayEntry = (e: LogEntry) => void speak(entrySaid(e, nameOf))
const saySticker = (id: string) => void speak(`${stickerDef(id)?.name ?? id}.`)

function onKey(e: KeyboardEvent) {
  if (e.code === 'ArrowLeft') void older()
  if (e.code === 'ArrowRight') newer()
}

onMounted(async () => {
  window.addEventListener('keydown', onKey)
  try {
    await fetchMore()
    status.value = 'ready'
  } catch {
    status.value = 'error'
    return
  }
  if (page.value) sayDay()
  else void speak('Dein Tagebuch ist noch leer.')
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="tagebuch" data-test="tagebuch">
    <p v-if="status === 'error'" class="empty" data-test="error">📖❓</p>
    <p v-else-if="status === 'ready' && !page" class="empty" data-test="empty">📖</p>

    <template v-else-if="page">
      <button class="arrow" data-test="older" aria-label="Früher" :disabled="!canOlder" @click="older">◀</button>
      <article class="page" data-test="page" :data-day="page.day">
        <header>
          <span v-if="page.goal_reached" class="sun" data-test="sun" aria-hidden="true">☀️</span>
          <button class="date" aria-label="Datum" @click="sayDay">{{ shortDate(page.day) }}</button>
        </header>
        <div class="entries">
          <button
            v-for="(e, i) in page.entries" :key="i" class="entry" data-test="entry" :data-kind="e.kind" :data-spent="e.stars < 0"
            :aria-label="nameOf(e.building, e.kind)" @click="sayEntry(e)"
          >
            <span class="icon">{{ iconOf(e.building, e.kind) }}</span>
            <span v-if="e.kind !== 'free'" class="stars">{{ e.stars > 0 ? `+${e.stars}` : `−${-e.stars}` }}</span>
          </button>
        </div>
        <div v-if="page.stickers.length || page.paintings.length" class="extras">
          <button
            v-for="id in page.stickers" :key="id" class="day-sticker" data-test="day-sticker"
            :style="{ background: stickerDef(id)?.color }" :aria-label="stickerDef(id)?.name" @click="saySticker(id)"
          >{{ stickerDef(id)?.emoji }}</button>
          <img
            v-for="p in page.paintings" :key="p.id" class="painting" data-test="day-painting" alt=""
            :src="paintingUrl(p, 'thumb')" draggable="false"
          />
        </div>
      </article>
      <button class="arrow" data-test="newer" aria-label="Später" :disabled="index === 0" @click="newer">▶</button>
    </template>
  </div>
</template>

<style scoped>
.tagebuch {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2vw;
  padding: 96px 3vw 4vh;
  box-sizing: border-box;
}
.empty { font-size: 20vmin; margin: 0; opacity: 0.6; }
.page {
  flex: 1;
  max-width: 900px;
  height: 100%;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 3vh;
  padding: 3vh 3vw;
  box-sizing: border-box;
  border-radius: 28px;
  background: #fffdf6;
  box-shadow: 0 10px 0 #e6d3b3, inset 6px 0 0 #e9b4a0;
}
header { display: flex; align-items: center; gap: 16px; }
.sun { font-size: 64px; animation: spin 8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.date { border: 0; background: none; font: 600 18px system-ui, sans-serif; color: #9a8467; cursor: pointer; }
.entries { display: flex; flex-wrap: wrap; gap: 16px; }
.entry {
  position: relative;
  width: min(15vw, 120px);
  aspect-ratio: 1;
  border: 0;
  border-radius: 24px;
  background: #fff3df;
  box-shadow: 0 6px 0 #ead9b5;
  cursor: pointer;
}
/* Stars spent (a round of play, a purchase) are grey; earned ones green */
.entry[data-spent='true'] { background: #eef0f3; box-shadow: 0 6px 0 #d7dbe0; }
.icon { font-size: min(8vw, 64px); }
.stars {
  position: absolute;
  right: -8px;
  bottom: -8px;
  padding: 2px 10px;
  border-radius: 14px;
  background: #4bd37b;
  color: white;
  font: 800 20px system-ui, sans-serif;
}
.entry[data-spent='true'] .stars { background: #9aa3ad; }
.extras { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; }
.day-sticker {
  width: 84px;
  height: 84px;
  border-radius: 50%;
  border: 5px solid white;
  font-size: 44px;
  box-shadow: 0 5px 0 rgb(0 0 0 / 12%);
  cursor: pointer;
}
.painting { width: 120px; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 12px; border: 5px solid white; box-shadow: 0 5px 0 rgb(0 0 0 / 12%); }
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
</style>
