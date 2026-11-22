<script setup lang="ts">
import { computed, ref } from 'vue'
import { isLearned } from '@/core/vocab/boxes'
import { builtinWords } from '@/core/vocab/builtin'
import { allScenes } from '@/core/listen/scenes'
import { ownWords } from '@/core/vocab/round'
import { spellKey } from '@/core/vocab/spelling'
import { LANGS, type Lang } from '@/core/vocab/types'
import type { Api, ListenState, VocabState } from '@/services/api'

// On the parents' page, in the card of a child at Oberstufe: per language how many words he has learned (box 3 and up,
// counting only words that exist now), how many are due today, how many he spells right (Schreiben: spelling box 3 and
// up), how many listening scenes he understood (the Reimhaus: right at least once), and his lists to read. Fetched the
// first time it opens.
const props = defineProps<{ api: Api; personId: number; today: string }>()

const LANG_NAME: Record<Lang, string> = { en: 'Englisch', fr: 'Französisch' }
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const data = ref<VocabState | null>(null)
const heard = ref<ListenState | null>(null)

async function opened(event: Event) {
  if (!(event.target as HTMLDetailsElement).open || status.value === 'ready' || status.value === 'loading') return
  status.value = 'loading'
  try {
    ;[data.value, heard.value] = await Promise.all([props.api.playerVocab(props.personId), props.api.playerListen(props.personId)])
    status.value = 'ready'
  } catch {
    status.value = 'error'
  }
}

const perLang = computed(() => LANGS.map(lang => {
  const lists = data.value?.lists ?? []
  const progress = data.value?.progress ?? {}
  const keys = new Set([...ownWords(lists, lang), ...builtinWords(lang)].map(w => w.key))
  const known = Object.entries(progress).filter(([key]) => keys.has(key))
  const spellKeys = new Set([...keys].map(spellKey))
  const scenes = allScenes(lang).map(x => x.key)
  const listened = heard.value?.progress ?? {}
  return {
    lang,
    learned: known.filter(([, p]) => isLearned(p.box)).length,
    due: known.filter(([, p]) => p.due <= props.today).length,
    spelled: Object.entries(progress).filter(([key, p]) => spellKeys.has(key) && isLearned(p.box)).length,
    understood: scenes.filter(key => (listened[key]?.right ?? 0) > 0).length,
    scenes: scenes.length,
    lists: lists.filter(l => l.lang === lang),
  }
}))
</script>

<template>
  <details class="sprachen" data-test="sprachen" @toggle="opened">
    <summary>Sprachen</summary>
    <p v-if="status === 'loading'">Lädt …</p>
    <p v-else-if="status === 'error'">Konnte nicht geladen werden.</p>
    <template v-else-if="status === 'ready'">
      <section v-for="l in perLang" :key="l.lang" :data-test="`lang-${l.lang}`">
        <h3>{{ LANG_NAME[l.lang] }}</h3>
        <p>{{ l.learned }} {{ l.learned === 1 ? 'Wort' : 'Wörter' }} gelernt, {{ l.due }} heute fällig</p>
        <p>{{ l.spelled }} {{ l.spelled === 1 ? 'Wort' : 'Wörter' }} richtig geschrieben</p>
        <p>{{ l.understood }} von {{ l.scenes }} Hörszenen verstanden</p>
        <p v-if="!l.lists.length" class="none">Keine eigenen Listen.</p>
        <details v-for="list in l.lists" :key="list.id" :data-test="`vocab-list-${list.id}`">
          <summary>{{ list.name }} ({{ list.words.length }})</summary>
          <p v-for="(w, i) in list.words" :key="i">{{ w.de }} → {{ w.foreign }}</p>
        </details>
      </section>
    </template>
  </details>
</template>

<style scoped>
.sprachen { margin-top: 10px; }
h3 { margin: 10px 0 4px; font-size: 1.05em; }
p { margin: 2px 0; }
.none { color: #777; }
</style>
