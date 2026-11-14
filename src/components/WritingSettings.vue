<script setup lang="ts">
import { ref } from 'vue'
import { DIGITS, LETTERS } from '@/core/writing/letters'
import { checkText, normalizeText, type Letters, type TextProblem } from '@/core/writing/levels'
import { ApiError, type Api } from '@/services/api'

// On the parents' page, in a child's card: her words and sentences for Schreiben, and how well she knows each letter.
// Fetched the first time it is opened; each change sends the whole list, and the list shows what the server kept.
const props = defineProps<{ api: Api; personId: number }>()

const REASONS: Record<TextProblem, string> = {
  empty: 'Bitte etwas eingeben.',
  letters: 'Nur Buchstaben A–Z, Ä, Ö, Ü, Zahlen und Leerzeichen (kein ß, keine Satzzeichen).',
  'too-long': 'Höchstens 30 Zeichen.',
  exists: 'Das steht schon in der Liste.',
  'too-many': 'Höchstens 20 Einträge.',
}
const FAILED = 'Konnte nicht speichern. Nochmal versuchen?'
const LEVELS = ['neu', 'ganzer Buchstabe', 'Punkte', 'Startpunkt', 'gelernt']

const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const texts = ref<string[]>([])
const letters = ref<Letters>({})
const draft = ref('')
const message = ref('')
const busy = ref(false)

async function opened(event: Event) {
  if (!(event.target as HTMLDetailsElement).open || status.value === 'ready' || status.value === 'loading') return
  status.value = 'loading'
  try {
    const state = await props.api.playerWriting(props.personId)
    texts.value = state.texts
    letters.value = state.letters
    status.value = 'ready'
  } catch {
    status.value = 'error'
  }
}

async function send(next: string[]): Promise<boolean> {
  busy.value = true
  try {
    const state = await props.api.setPlayerTexts(props.personId, next)
    texts.value = state.texts
    letters.value = state.letters
    message.value = ''
    return true
  } catch (e) {
    const code = e instanceof ApiError ? e.code : ''
    message.value = code in REASONS ? REASONS[code as TextProblem] : FAILED
    return false
  } finally {
    busy.value = false
  }
}

async function add() {
  const problem = checkText(draft.value, texts.value)
  if (problem) {
    message.value = REASONS[problem]
    return
  }
  if (await send([...texts.value, normalizeText(draft.value)])) draft.value = ''
}

/** Swaps the text at `i` with its neighbour above (-1) or below (+1) */
function move(i: number, by: -1 | 1) {
  const next = [...texts.value]
  ;[next[i + by], next[i]] = [next[i], next[i + by]]
  void send(next)
}

function remove(i: number) {
  void send(texts.value.filter((_, k) => k !== i))
}

const levelOf = (glyph: string) => letters.value[glyph]?.level ?? 0
</script>

<template>
  <details class="writing" data-test="writing" @toggle="opened">
    <summary>Schreiben</summary>
    <p v-if="status === 'loading'">Lädt …</p>
    <p v-else-if="status === 'error'">Konnte nicht geladen werden.</p>
    <template v-else-if="status === 'ready'">
      <p class="hint">Wörter und kurze Sätze für das Schreibhaus. Sie werden in Grossbuchstaben geschrieben.</p>
      <ol class="texts">
        <li v-for="(t, i) in texts" :key="t" data-test="text-item">
          <span class="text" data-test="text">{{ t }}</span>
          <button
            data-test="text-up" :disabled="busy || i === 0" :aria-label="`${t} nach oben`" @click="move(i, -1)"
          >↑</button>
          <button
            data-test="text-down" :disabled="busy || i === texts.length - 1" :aria-label="`${t} nach unten`"
            @click="move(i, 1)"
          >↓</button>
          <button data-test="text-remove" :disabled="busy" :aria-label="`${t} entfernen`" @click="remove(i)">✕</button>
        </li>
      </ol>
      <form class="add" @submit.prevent="add">
        <input v-model="draft" data-test="new-text" maxlength="60" autocapitalize="characters" aria-label="Neues Wort oder neuer Satz" />
        <button type="submit" data-test="add-text" :disabled="busy" @click.prevent="add">Hinzufügen</button>
      </form>
      <p class="message" data-test="writing-message" aria-live="polite">{{ message }}</p>

      <div class="grid" aria-label="Buchstaben">
        <span
          v-for="g in [...LETTERS, ...DIGITS]" :key="g" class="tile" data-test="letter-tile"
          :data-level="levelOf(g)" :title="LEVELS[levelOf(g)]"
        >{{ g }}</span>
      </div>
      <p class="legend">
        <span v-for="(name, l) in LEVELS" :key="l"><span class="tile small" :data-level="l" />{{ name }}</span>
      </p>
    </template>
  </details>
</template>

<style scoped>
.writing { margin-top: 12px; }
.writing summary { cursor: pointer; font-weight: 600; }
.hint, .message { color: #4a5562; margin: 6px 0; }
.texts { padding-left: 24px; margin: 8px 0; }
.texts li { display: flex; align-items: center; gap: 8px; margin: 4px 0; }
.text { flex: 1; font-weight: 600; letter-spacing: 0.05em; overflow-wrap: anywhere; }
.texts button { padding: 4px 10px; min-width: 44px; min-height: 44px; }
button { font: inherit; padding: 10px 16px; border-radius: 10px; border: 1px solid #c9ced4; background: #fff; cursor: pointer; }
button:disabled { opacity: 0.5; }
.add { display: flex; gap: 8px; flex-wrap: wrap; }
.add input {
  flex: 1; min-width: 0; font: inherit; padding: 8px 10px; border: 1px solid #c9ced4; border-radius: 8px;
}
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(36px, 1fr)); gap: 6px; margin-top: 12px; }
.tile {
  display: grid; place-items: center; height: 36px; border-radius: 8px; font-weight: 700;
  background: #eceef1; color: #8a939d;
}
.tile[data-level='1'] { background: #fde2c4; color: #8a4b0f; }
.tile[data-level='2'] { background: #fbefb0; color: #7a6205; }
.tile[data-level='3'] { background: #d8efb5; color: #3f6b12; }
.tile[data-level='4'] { background: #7ed957; color: #1f4a0a; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 14px; color: #4a5562; font-size: 14px; }
.legend > span { display: inline-flex; align-items: center; gap: 6px; }
.tile.small { width: 16px; height: 16px; border-radius: 4px; }
</style>
