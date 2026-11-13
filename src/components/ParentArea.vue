<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { BUILDINGS } from '@/buildings/registry'
import { dayLine, type LogDay } from '@/core/diary'
import { stickerDef } from '@/core/stickers'
import { outfitDef } from '@/core/outfits'
import type { Api, PlayerRow, Rules, StickerRow } from '@/services/api'
import FilmList from './FilmList.vue'

// The parents' page: plain German, for grown-ups who read. One card per person who may play,
// with today's numbers, three settings and their logbook of the last days, then the Cinema's films.
const props = defineProps<{
  api: Api
  /** With the family hub: where to log out; the page adds its own address */
  logoutUrl?: string | null
  /** Without a hub: hand the device to someone else */
  canSwitch?: boolean
}>()
const emit = defineEmits<{ close: []; saved: [id: number]; switch: []; filmsChanged: [] }>()

const PLAY_CHOICES: (number | null)[] = [null, 5, 10, 15, 20, 30, 45, 60, 90, 120, 180]

const rows = ref<PlayerRow[]>([])
const drafts = reactive<Record<number, Rules>>({})
const status = ref<'loading' | 'ready' | 'error'>('loading')
const saving = ref<number | null>(null)
const message = reactive<Record<number, string>>({})

async function load() {
  status.value = 'loading'
  try {
    rows.value = await props.api.players()
    for (const row of rows.value) {
      drafts[row.id] = { daily_goal: row.daily_goal, play_minutes: row.play_minutes, stars: row.stars }
    }
    status.value = 'ready'
  } catch {
    status.value = 'error'
  }
}

async function save(id: number) {
  const draft = drafts[id]
  const row = rows.value.find(r => r.id === id)!
  const stars = Math.round(Number(draft.stars))
  if (!Number.isFinite(stars) || stars < 0 || stars > 9999) {
    message[id] = 'Sterne: eine Zahl von 0 bis 9999.'
    return
  }
  // Stars only when they were changed here: a child may have earned some since the page was loaded
  const rules: Rules = { daily_goal: draft.daily_goal, play_minutes: draft.play_minutes }
  if (stars !== row.stars) rules.stars = stars
  saving.value = id
  try {
    const saved = await props.api.setRules(id, rules)
    Object.assign(row, saved)
    drafts[id].stars = saved.stars
    message[id] = 'Gespeichert.'
    emit('saved', id)
  } catch {
    message[id] = 'Speichern hat nicht geklappt. Bitte nochmal versuchen.'
  } finally {
    saving.value = null
  }
}

/** Each person's logbook, fetched the first time its section is opened */
const diaries = reactive<Record<number, { status: 'loading' | 'ready' | 'error'; days: LogDay[]; stickers: StickerRow[] }>>({})
const nameOf = (id: string) => BUILDINGS.find(b => b.id === id)?.spokenName ?? outfitDef(id)?.name ?? id
/** Her add-ons as pictures; ids the catalogue no longer has are left out */
const ownedEmojis = (row: PlayerRow) => (row.owned ?? []).map(id => outfitDef(id)?.emoji).filter(Boolean).join(' ')

async function openDiary(id: number, event: Event) {
  if (!(event.target as HTMLDetailsElement).open || diaries[id]?.status === 'ready') return
  diaries[id] = { status: 'loading', days: [], stickers: [] }
  try {
    const { days, stickers } = await props.api.diary(id)
    diaries[id] = { status: 'ready', days, stickers }
  } catch {
    diaries[id].status = 'error'
  }
}

/** "Sticker: Bücherwurm (12.11.), Springfloh (14.11.)" */
function stickerLine(rows: StickerRow[]): string {
  const when = (at: string) => `${Number(at.slice(8, 10))}.${Number(at.slice(5, 7))}.`
  return `Sticker: ${rows.map(r => `${stickerDef(r.id)?.name ?? r.id} (${when(r.earned_at)})`).join(', ')}`
}

const minutes = (seconds: number) => Math.floor(seconds / 60)
const logout = () => props.logoutUrl && window.location.assign(props.logoutUrl + encodeURIComponent(window.location.href))

onMounted(load)
</script>

<template>
  <div class="parents" data-test="parent-area">
    <div class="page">
      <header>
        <h1>Eltern</h1>
        <button class="close" data-test="parent-close" @click="emit('close')">Zurück zum Spiel</button>
      </header>

      <p v-if="status === 'loading'">Lädt …</p>
      <p v-else-if="status === 'error'">
        Die Liste konnte nicht geladen werden.
        <button data-test="parent-reload" @click="load">Nochmal</button>
      </p>

      <article v-for="row in rows" :key="row.id" class="card" data-test="parent-card" :data-id="row.id">
        <h2><span class="dot" :style="{ background: row.color ?? '#ff9a3c' }" />{{ row.name }}<small v-if="row.role === 'PARENT'"> (Elternteil)</small></h2>
        <p class="today">
          Heute: {{ row.visits }} von {{ row.daily_goal }} Lernbesuchen, {{ minutes(row.play_seconds) }} Minuten gespielt
        </p>
        <p v-if="row.savings > 0" class="today" data-test="savings">
          {{ row.stars }} Sterne, davon gespart: {{ row.savings }} (zählen im Kleiderladen halb)
        </p>
        <p v-if="ownedEmojis(row)" class="owned" data-test="owned" aria-label="Kleider">{{ ownedEmojis(row) }}</p>
        <div class="fields">
          <!-- A parent has no daily goal or play time to keep (UX review): only their Stars -->
          <label v-if="row.role !== 'PARENT'">Tagesziel
            <select v-model.number="drafts[row.id].daily_goal" data-test="goal">
              <option v-for="n in 5" :key="n" :value="n">{{ n }} {{ n === 1 ? 'Besuch' : 'Besuche' }}</option>
            </select>
          </label>
          <label v-if="row.role !== 'PARENT'">Spielzeit pro Tag
            <select v-model="drafts[row.id].play_minutes" data-test="minutes">
              <option v-for="m in PLAY_CHOICES" :key="String(m)" :value="m">{{ m === null ? 'Ohne Grenze' : `${m} Minuten` }}</option>
            </select>
          </label>
          <label>Sterne
            <input v-model.number="drafts[row.id].stars" data-test="stars-input" type="number" min="0" max="9999" step="1" inputmode="numeric" />
          </label>
        </div>
        <div class="actions">
          <button class="save" data-test="save" :disabled="saving === row.id" @click="save(row.id)">Speichern</button>
          <span class="message" data-test="message">{{ message[row.id] }}</span>
        </div>
        <details class="diary" data-test="diary" @toggle="openDiary(row.id, $event)">
          <summary>Tagebuch</summary>
          <p v-if="diaries[row.id]?.status === 'loading'">Lädt …</p>
          <p v-else-if="diaries[row.id]?.status === 'error'">Das Tagebuch konnte nicht geladen werden.</p>
          <template v-else-if="diaries[row.id]">
            <p v-if="!diaries[row.id].days.length">Noch nichts eingetragen.</p>
            <p v-for="d in diaries[row.id].days" :key="d.day" data-test="diary-day">{{ dayLine(d, nameOf) }}</p>
            <p v-if="diaries[row.id].stickers.length" data-test="diary-stickers">{{ stickerLine(diaries[row.id].stickers) }}</p>
          </template>
        </details>
      </article>

      <FilmList :api="api" @changed="emit('filmsChanged')" />

      <footer>
        <button v-if="canSwitch" data-test="switch" @click="emit('switch')">Jemand anderes spielt</button>
        <button v-if="logoutUrl" data-test="logout" @click="logout">Abmelden</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.owned { margin: 4px 0 0; font-size: 1.5rem; letter-spacing: 4px; }
.parents {
  position: fixed;
  inset: 0;
  z-index: 25;
  overflow-y: auto;
  background: #f6f4ef;
  font: 16px/1.4 system-ui, sans-serif;
  color: #26323f;
  user-select: text;
  -webkit-user-select: text;
  touch-action: pan-y;
}
.page { max-width: 760px; margin: 0 auto; padding: calc(20px + env(safe-area-inset-top)) 16px 40px; }
header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
h1 { font-size: 28px; margin: 0; }
h2 { font-size: 20px; margin: 0 0 4px; display: flex; align-items: center; gap: 8px; }
h2 small { font-weight: 400; color: #66717d; }
.dot { width: 16px; height: 16px; border-radius: 50%; display: inline-block; }
.card { background: #fff; border-radius: 16px; padding: 16px; margin-top: 16px; box-shadow: 0 2px 0 rgb(0 0 0 / 6%); }
.today { margin: 0 0 12px; color: #4a5562; }
.fields { display: flex; flex-wrap: wrap; gap: 12px 20px; }
label { display: flex; flex-direction: column; gap: 4px; font-weight: 600; font-size: 14px; }
select, input { font: inherit; padding: 8px 10px; border: 1px solid #c9ced4; border-radius: 8px; background: #fff; min-width: 140px; }
.actions { display: flex; align-items: center; gap: 12px; margin-top: 12px; }
button { font: inherit; padding: 10px 16px; border-radius: 10px; border: 1px solid #c9ced4; background: #fff; cursor: pointer; }
.save { background: #2b6cb0; color: #fff; border-color: #2b6cb0; }
.save:disabled { opacity: 0.6; }
.message { color: #4a5562; }
footer { display: flex; gap: 12px; margin-top: 24px; }
.diary { margin-top: 12px; }
.diary summary { cursor: pointer; font-weight: 600; }
.diary p { margin: 6px 0; color: #4a5562; }
</style>
