<script setup lang="ts">
import { computed, ref } from 'vue'
import { parseList } from '@/core/vocab/parse'
import type { Lang, VocabList } from '@/core/vocab/types'
import { useVocabStore, type ListRefusal } from '@/stores/vocab'

// One of his lists, new or to change: a name and a text box he can paste a whole list into, one pair per line, German
// first. What will be kept shows below as he types; lines that can't be read are named and left out.
const props = defineProps<{ lang: Lang; list?: VocabList }>()
const emit = defineEmits<{ done: []; cancel: [] }>()

const vocab = useVocabStore()
const name = ref(props.list?.name ?? '')
const text = ref(props.list?.words.map(w => `${w.de} - ${w.foreign}`).join('\n') ?? '')
const parsed = computed(() => parseList(text.value))
const message = ref('')
const busy = ref(false)
const asking = ref(false)

const SAYS: Record<ListRefusal | 'away', string> = {
  'too-many': 'Du hast schon 30 Listen in dieser Sprache.',
  'too-long': 'Zu lang: höchstens 60 Wortpaare, 60 Zeichen pro Seite und 40 für den Namen.',
  empty: 'Die Liste braucht einen Namen und mindestens ein Wortpaar.',
  'bad-lang': 'Das ging nicht.',
  unknown: 'Diese Liste gibt es nicht mehr.',
  away: 'Keine Verbindung – versuch es später nochmal.',
}

async function save() {
  if (busy.value) return
  if (!name.value.trim() || parsed.value.pairs.length === 0) {
    message.value = SAYS.empty
    return
  }
  busy.value = true
  const answer = await vocab.saveList({ id: props.list?.id, lang: props.lang, name: name.value, words: parsed.value.pairs })
  busy.value = false
  if (answer === 'ok') emit('done')
  else message.value = SAYS[answer]
}

async function remove() {
  if (!props.list || busy.value) return
  busy.value = true
  const answer = await vocab.deleteList(props.list.id)
  busy.value = false
  if (answer === 'ok') emit('done')
  else message.value = SAYS.away
}
</script>

<template>
  <div class="editor" data-test="editor">
    <label>Name der Liste
      <input v-model="name" data-test="list-name" maxlength="40" placeholder="z. B. Unit 3 – Travel" autocomplete="off">
    </label>
    <label>Wörter: eine Zeile pro Paar, zuerst Deutsch (Deutsch - {{ lang === 'en' ? 'Englisch' : 'Französisch' }})
      <textarea
        v-model="text" data-test="list-text" rows="8" autocomplete="off" autocapitalize="off" spellcheck="false"
        :placeholder="lang === 'en' ? 'der Bahnhof - railway station / train station' : 'der Bahnhof - la gare'"
      />
    </label>
    <p v-if="parsed.bad.length" class="bad" data-test="bad-lines">
      Nicht lesbar, wird nicht gespeichert: Zeile {{ parsed.bad.join(', ') }}
    </p>
    <ul class="pairs">
      <li v-for="(p, i) in parsed.pairs" :key="i" data-test="pair">{{ p.de }} → {{ p.foreign }}</li>
    </ul>
    <p v-if="message" class="message" data-test="refusal">{{ message }}</p>
    <div class="buttons">
      <button type="button" class="main" data-test="save" :disabled="busy" @click="save">Speichern</button>
      <button type="button" data-test="cancel" @click="emit('cancel')">Abbrechen</button>
      <template v-if="list">
        <button v-if="!asking" type="button" class="danger" data-test="delete" @click="asking = true">Löschen</button>
        <button v-else type="button" class="danger" data-test="delete-sure" :disabled="busy" @click="remove">Wirklich löschen?</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.editor { display: flex; flex-direction: column; gap: 12px; width: 100%; max-width: 720px; text-align: left; }
label { display: flex; flex-direction: column; gap: 6px; font: 600 18px/1.3 system-ui, sans-serif; color: #23264a; }
input, textarea { font: 400 20px/1.4 system-ui, sans-serif; padding: 10px; border: 2px solid #c6cbec; border-radius: 10px; }
.pairs { max-height: 22vh; overflow: auto; margin: 0; padding-left: 20px; font: 400 17px/1.5 system-ui, sans-serif; }
.bad, .message { margin: 0; color: #b3261e; font: 600 17px/1.3 system-ui, sans-serif; }
.buttons { display: flex; gap: 10px; flex-wrap: wrap; }
button { font: 600 19px/1 system-ui, sans-serif; padding: 12px 18px; border-radius: 10px; border: 2px solid #c6cbec; background: #fff; }
button.main { background: #4a5bd4; border-color: #4a5bd4; color: #fff; }
button.danger { margin-left: auto; color: #b3261e; border-color: #e9b4b0; }
</style>
