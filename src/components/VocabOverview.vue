<script setup lang="ts">
import { computed, ref } from 'vue'
import { isLearned } from '@/core/vocab/boxes'
import { builtinWords } from '@/core/vocab/builtin'
import { asRec, KINDS, weakestKinds } from '@/core/dates/round'
import { GRAMMAR } from '@/core/grammar/content'
import { isSure, weakest } from '@/core/grammar/round'
import { allScenes } from '@/core/listen/scenes'
import { allTexts } from '@/core/reading/texts'
import { ownWords } from '@/core/vocab/round'
import { spellKey } from '@/core/vocab/spelling'
import { LANGS, type Lang } from '@/core/vocab/types'
import { saidCount } from '@/core/speak/round'
import type { Api, DatesState, SpeakState, GrammarState, ListenState, ReadingState, VocabState } from '@/services/api'

// On the parents' page, in the card of a child at Oberstufe: per language how many words he has learned (box 3 and up,
// counting only words that exist now), how many are due today, how many he spells right (Schreiben: spelling box 3 and
// up), how many listening scenes he understood (the Reimhaus: right at least once), his grammar topics sure and weak
// (the Musterwerkstatt), the texts he read (the Bibliothek), dates and times sure and weak by kind (the Kalender), what he said right (the Trommelhaus),
// and his lists to read. Fetched the
// first time it opens.
const props = defineProps<{ api: Api; personId: number; today: string }>()

const LANG_NAME: Record<Lang, string> = { en: 'Englisch', fr: 'Französisch' }
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const data = ref<VocabState | null>(null)
const heard = ref<ListenState | null>(null)
const grammar = ref<GrammarState | null>(null)
const texts = ref<ReadingState | null>(null)
const times = ref<DatesState | null>(null)
const said = ref<SpeakState | null>(null)

async function opened(event: Event) {
  if (!(event.target as HTMLDetailsElement).open || status.value === 'ready' || status.value === 'loading') return
  status.value = 'loading'
  try {
    ;[data.value, heard.value, grammar.value, texts.value, times.value, said.value] = await Promise.all([
      props.api.playerVocab(props.personId), props.api.playerListen(props.personId), props.api.playerGrammar(props.personId),
      props.api.playerReading(props.personId), props.api.playerDates(props.personId), props.api.playerSpeak(props.personId),
    ])
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
  const topics = grammar.value?.progress ?? {}
  const nameOf = (id: string) => GRAMMAR[lang].find(t => t.id === id)?.name ?? id
  return {
    lang,
    learned: known.filter(([, p]) => isLearned(p.box)).length,
    due: known.filter(([, p]) => p.due <= props.today).length,
    spelled: Object.entries(progress).filter(([key, p]) => spellKeys.has(key) && isLearned(p.box)).length,
    understood: scenes.filter(key => (listened[key]?.right ?? 0) > 0).length,
    scenes: scenes.length,
    sure: GRAMMAR[lang].filter(t => isSure(topics[`${lang}:${t.id}`])).length,
    topics: GRAMMAR[lang].length,
    weak: weakest(lang, topics).map(nameOf),
    read: allTexts(lang).filter(x => texts.value?.progress[x.key]).length,
    texts: allTexts(lang).length,
    kindsSure: KINDS.filter(k => isSure(asRec(times.value?.progress[`${lang}:${k.id}`]))).length,
    kinds: KINDS.length,
    weakKinds: weakestKinds(lang, times.value?.progress ?? {}).map(id => KINDS.find(k => k.id === id)!.name),
    spoken: saidCount(lang, said.value?.progress ?? {}),
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
        <p>Grammatik: {{ l.sure }} von {{ l.topics }} Themen sicher</p>
        <p v-if="l.weak.length" data-test="weak">Schwach: {{ l.weak.join(', ') }}</p>
        <p>{{ l.read }} von {{ l.texts }} Texten gelesen</p>
        <p>Uhrzeit und Datum: {{ l.kindsSure }} von {{ l.kinds }} Aufgabenarten sicher</p>
        <p>{{ l.spoken }} Sätze und Wörter gesprochen</p>
        <p v-if="l.weakKinds.length" data-test="weak-dates">Schwach (Kalender): {{ l.weakKinds.join(', ') }}</p>
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
