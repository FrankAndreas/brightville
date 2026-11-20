<script setup lang="ts">
import { computed, ref } from 'vue'
import { BUILDINGS } from '@/buildings/registry'
import type { LogDay } from '@/core/diary'
import { LAST_STEP, type Ladder, type Ladders } from '@/core/ladders'
import { kgMark, lettersShare, overall, practice, STEP_TEXT, subjects, type Visits } from '@/core/lehrplan'
import { LETTERS } from '@/core/writing/letters'
import type { Letters } from '@/core/writing/levels'
import type { Api } from '@/services/api'

// On the parents' page, in a child's card: how far she is against the Lehrplan 21 (Zyklus 1), opening into the
// subjects, the School's two ladders (with a step to set) and this week's practice. Fetched the first time it is opened.
const props = defineProps<{ api: Api; personId: number }>()

const FAILED = 'Konnte nicht speichern. Nochmal versuchen?'
const LADDERS: { id: Ladder; name: string }[] = [{ id: 'zaehlen', name: 'Zählen' }, { id: 'rechnen', name: 'Rechnen' }]
const STEPS = Array.from({ length: LAST_STEP }, (_, i) => i + 1)

const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const ladders = ref<Ladders | null>(null)
const letters = ref<Letters>({})
const days = ref<LogDay[]>([])
const message = ref('')
const busy = ref(false)

/** The device's calendar day, 'YYYY-MM-DD' */
function deviceDay(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const today = ref(deviceDay())

async function opened(event: Event) {
  if (!(event.target as HTMLDetailsElement).open || status.value === 'ready' || status.value === 'loading') return
  status.value = 'loading'
  today.value = deviceDay()
  try {
    const [school, writing, diary] = await Promise.all([
      props.api.playerSchool(props.personId),
      props.api.playerWriting(props.personId),
      props.api.diary(props.personId),
    ])
    ladders.value = school
    letters.value = writing.letters
    days.value = diary.days
    status.value = 'ready'
  } catch {
    status.value = 'error'
  }
}

async function setStep(ladder: Ladder, event: Event) {
  const select = event.target as HTMLSelectElement
  const step = Number(select.value)
  busy.value = true
  try {
    ladders.value = await props.api.setPlayerStep(props.personId, ladder, step)
    message.value = ''
  } catch {
    message.value = FAILED
    // The list shows what the server kept
    if (ladders.value) select.value = String(ladders.value[ladder].step)
  } finally {
    busy.value = false
  }
}

const percent = computed(() => (ladders.value ? overall(ladders.value, letters.value) : 0))
const known = computed(() => Math.round(lettersShare(letters.value) * LETTERS.length))
const nameOf = (id: string) => BUILDINGS.find(b => b.id === id)?.spokenName ?? id
const visitText = (visits: Visits[]) => visits.map(v => `${nameOf(v.building)} ×${v.times}`).join(', ')
const otherSubjects = computed(() => subjects(days.value, today.value).filter(s => s.code !== 'MA'))
const week = computed(() => practice(days.value, today.value))
const stepLabel = (step: number) => (step >= LAST_STEP ? 'fertig' : `Stufe ${step} von ${LAST_STEP - 1}`)
</script>

<template>
  <details class="lehrplan" data-test="lehrplan" @toggle="opened">
    <summary>Lehrplan 21</summary>
    <p v-if="status === 'loading'">Lädt …</p>
    <p v-else-if="status === 'error'">Konnte nicht geladen werden.</p>
    <template v-else-if="status === 'ready' && ladders">
      <div class="overall">
        <div class="track" aria-hidden="true">
          <div class="fill" data-test="lehrplan-bar" :style="{ width: `${percent}%` }" />
          <div class="kg" data-test="lehrplan-kg" :style="{ left: `${kgMark()}%` }" />
        </div>
        <strong data-test="lehrplan-percent">{{ percent }} %</strong>
      </div>
      <p class="hint">100 % ist das Ende der 2. Klasse; die Linie zeigt, wo der Kindergarten ungefähr endet.</p>

      <h4>Mathematik</h4>
      <div v-for="l in LADDERS" :key="l.id" class="ladder" :data-test="`ladder-${l.id}`">
        <span class="name">{{ l.name }}</span>
        <span class="step">{{ stepLabel(ladders[l.id].step) }}</span>
        <span class="what">„{{ STEP_TEXT[l.id][ladders[l.id].step - 1] }}“</span>
        <select
          :data-test="`step-${l.id}`" :value="ladders[l.id].step" :disabled="busy" :aria-label="`${l.name}: Stufe ändern`"
          @change="setStep(l.id, $event)"
        >
          <option v-for="s in STEPS" :key="s" :value="s">{{ s >= LAST_STEP ? 'fertig' : `Stufe ${s}` }}</option>
        </select>
      </div>
      <p class="message" data-test="lehrplan-message" aria-live="polite">{{ message }}</p>

      <h4>Deutsch</h4>
      <p data-test="letters">Buchstaben: {{ known }} von {{ LETTERS.length }} gelernt</p>

      <h4>Diese Woche</h4>
      <ul class="list">
        <li v-for="s in otherSubjects" :key="s.code" data-test="subject">
          {{ s.name }}: {{ s.visits.length ? visitText(s.visits) : '–' }}
        </li>
      </ul>
      <ul class="list">
        <li v-for="z in week" :key="z.zugang" data-test="zugang" :data-done="z.visits.length > 0">
          <template v-if="z.visits.length">✓ {{ z.name }} ({{ visitText(z.visits) }})</template>
          <template v-else-if="!z.hasBuilding">– {{ z.name }} (noch kein Haus)</template>
          <template v-else>– {{ z.name }}</template>
        </li>
      </ul>
    </template>
  </details>
</template>

<style scoped>
.lehrplan { margin-top: 12px; }
.lehrplan summary { cursor: pointer; font-weight: 600; }
h4 { margin: 14px 0 6px; }
.overall { display: flex; align-items: center; gap: 12px; margin-top: 10px; }
.track { position: relative; flex: 1; height: 16px; border-radius: 8px; background: #eceef1; }
.fill { height: 100%; border-radius: 8px; background: #4caf7a; }
.kg { position: absolute; top: -5px; bottom: -5px; width: 3px; margin-left: -1px; background: #2b4c7e; }
.hint, .message { color: #4a5562; margin: 6px 0; }
.ladder { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; margin: 6px 0; }
.ladder .name { font-weight: 600; min-width: 5em; }
.ladder .what { flex: 1; color: #4a5562; min-width: 12em; }
select { font: inherit; padding: 8px 10px; min-height: 44px; border-radius: 8px; border: 1px solid #c9ced4; background: #fff; }
.list { margin: 6px 0; padding-left: 20px; }
.list li { margin: 4px 0; }
li[data-done='false'] { color: #8a939d; }
</style>
