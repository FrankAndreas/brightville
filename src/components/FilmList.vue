<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { thumbnail } from '@/buildings/kino/youtube'
import { ApiError, type Api, type Film, type Level } from '@/services/api'

// The Cinema's films, in the parents' page: one list per level (Kindergarten, Oberstufe), switched above the list
const props = defineProps<{ api: Api }>()
const emit = defineEmits<{ changed: [] }>()

const MESSAGES: Record<string, string> = {
  not_youtube: 'Das ist kein YouTube-Link.',
  already_there: 'Dieser Film ist schon in der Liste.',
  too_many: 'Die Liste ist voll (30 Filme). Bitte zuerst einen entfernen.',
}
const FAILED = 'Das hat nicht geklappt. Bitte nochmal versuchen.'

const all = ref<Film[]>([])
/** The list shown, and the one a new film goes on */
const level = ref<Level>('kindergarten')
const films = computed(() => all.value.filter(f => (f.level ?? 'kindergarten') === level.value))
const LEVELS: { id: Level; name: string }[] = [{ id: 'kindergarten', name: 'Kindergarten' }, { id: 'oberstufe', name: 'Oberstufe' }]
const url = ref('')
const title = ref('')
const message = ref('')
const busy = ref(false)

async function load() {
  try {
    all.value = await props.api.films()
  } catch {
    message.value = 'Die Filme konnten nicht geladen werden.'
  }
}

const why = (e: unknown) => (e instanceof ApiError && MESSAGES[e.code]) || FAILED

async function add() {
  if (busy.value || !url.value.trim()) return
  busy.value = true
  try {
    const film = await props.api.addFilm(url.value.trim(), title.value.trim(), level.value)
    all.value = [...all.value, { ...film, level: film.level ?? level.value }]
    url.value = ''
    title.value = ''
    message.value = 'Hinzugefügt.'
    emit('changed')
  } catch (e) {
    message.value = why(e)
  } finally {
    busy.value = false
  }
}

async function remove(film: Film) {
  // Asked first: one tap must not take a film away from every child (UX review)
  if (!window.confirm(`${film.title || 'Diesen Film'} aus dem Kino entfernen?`)) return
  try {
    await props.api.removeFilm(film.id)
    all.value = all.value.filter(f => f.id !== film.id)
    message.value = ''
    emit('changed')
  } catch (e) {
    // Gone already: the list is what counts
    if (e instanceof ApiError && e.status === 404) all.value = all.value.filter(f => f.id !== film.id)
    else message.value = FAILED
  }
}

onMounted(load)
</script>

<template>
  <section class="films" data-test="film-list">
    <h2>🎬 Kino</h2>
    <p class="hint">
      Filme für das Kino, je eine Liste für den Kindergarten und die Oberstufe: jedes Kind sieht die Liste seiner Stufe.
      Ein Film kostet drei Sterne und zählt zur Spielzeit. Ohne Filme bleibt das Kino zu.
    </p>
    <div class="levels" role="tablist">
      <button
        v-for="l in LEVELS" :key="l.id" type="button" role="tab" :aria-selected="level === l.id"
        :class="{ on: level === l.id }" :data-test="`film-level-${l.id}`" @click="level = l.id; message = ''"
      >{{ l.name }}</button>
    </div>
    <ul>
      <li v-for="f in films" :key="f.id" data-test="film-row">
        <img :src="thumbnail(f.youtube_id)" alt="" />
        <span class="name">{{ f.title || 'Ohne Namen' }}</span>
        <button data-test="film-remove" :aria-label="`${f.title || 'Film'} entfernen`" @click="remove(f)">Entfernen</button>
      </li>
    </ul>
    <form @submit.prevent="add">
      <label>YouTube-Link
        <input v-model="url" data-test="film-url" type="url" inputmode="url" placeholder="https://www.youtube.com/watch?v=…" maxlength="500" />
      </label>
      <label>Name (für euch)
        <input v-model="title" data-test="film-title" type="text" maxlength="60" />
      </label>
      <button class="add" type="submit" :disabled="busy">Hinzufügen</button>
    </form>
    <p class="message" data-test="film-message">{{ message }}</p>
  </section>
</template>

<style scoped>
.films { background: #fff; border-radius: 16px; padding: 16px; margin-top: 16px; box-shadow: 0 2px 0 rgb(0 0 0 / 6%); }
h2 { font-size: 20px; margin: 0 0 4px; }
.hint { margin: 0 0 12px; color: #4a5562; }
ul { list-style: none; padding: 0; margin: 0 0 12px; display: flex; flex-direction: column; gap: 8px; }
li { display: flex; align-items: center; gap: 12px; }
li img { width: 96px; aspect-ratio: 16 / 9; object-fit: cover; border-radius: 8px; background: #ddd; }
.name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
form { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 12px; }
label { display: flex; flex-direction: column; gap: 4px; font-weight: 600; font-size: 14px; flex: 1 1 220px; }
input { font: inherit; padding: 8px 10px; border: 1px solid #c9ced4; border-radius: 8px; }
button { font: inherit; padding: 10px 16px; border-radius: 10px; border: 1px solid #c9ced4; background: #fff; cursor: pointer; }
.levels { display: flex; gap: 8px; margin: 0 0 12px; }
.levels .on { background: #2b6cb0; color: #fff; border-color: #2b6cb0; }
.add { background: #2b6cb0; color: #fff; border-color: #2b6cb0; }
.message { color: #4a5562; min-height: 1.4em; margin: 8px 0 0; }
</style>
