<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import type { Api, PlayerRow, Rules } from '@/services/api'
import FilmList from './FilmList.vue'

// The parents' page: plain German, for grown-ups who read. One card per person who may play,
// with today's numbers and three settings, then the Cinema's films.
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
        <div class="fields">
          <label>Tagesziel
            <select v-model.number="drafts[row.id].daily_goal" data-test="goal">
              <option v-for="n in 5" :key="n" :value="n">{{ n }} {{ n === 1 ? 'Besuch' : 'Besuche' }}</option>
            </select>
          </label>
          <label>Spielzeit pro Tag
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
</style>
