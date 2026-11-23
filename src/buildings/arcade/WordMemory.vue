<script setup lang="ts">
import { ref } from 'vue'
import { builtinWords } from '@/core/vocab/builtin'
import { dueToday, pickMemoryWords, wordDeck, type WordCard } from '@/core/vocab/memoryWords'
import { ownWords } from '@/core/vocab/round'
import type { Lang, VocabWord } from '@/core/vocab/types'
import { usePlayerStore } from '@/stores/player'
import { useVocabStore } from '@/stores/vocab'
import type { BuildingResult } from '../types'
import { useVisit } from '../visit'
import LanguagePick from '../vokabeln/LanguagePick.vue'
import Arcade from './Arcade.vue'

// The Spielhalle at Oberstufe (docs/superpowers/specs/2026-11-23-brightville-oberstufe-play-speak-look-design.md): he
// picks the language, then plays memory with six words, each a pair of cards: the word and its German. A pair found at
// the first try counts in the School for a word due today; nothing else changes his record.
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

const vocab = useVocabStore()
const player = usePlayerStore()
const owner = vocab.who
const lang = ref<Lang | null>(null)
const deck = ref<WordCard[]>([])
/** First-try pairs of words due today, recorded when the round ends or he leaves */
const right: string[] = []
let recorded = false

const localDay = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
/** The progress as the round starts: a word found now is judged by its day then */
let progress = vocab.progress

// Leaving on the language screen; once the cards are dealt, the Spielhalle answers the leave button itself
const visit = useVisit(() => {
  if (visit.isClosed() || lang.value) return
  visit.shutDown()
  emit('finished', { stars: 0 })
})

function pick(chosen: Lang) {
  progress = vocab.progress
  const seen = new Set<string>()
  const words: VocabWord[] = [...ownWords(vocab.lists, chosen), ...builtinWords(chosen)].filter(w => !seen.has(w.key) && seen.add(w.key))
  deck.value = wordDeck(pickMemoryWords(words, progress, Math.random), chosen, Math.random)
  lang.value = chosen
}

function onPair(word: string, firstTry: boolean) {
  if (firstTry && dueToday(word, progress, player.day || localDay())) right.push(word)
}

function finished(result: BuildingResult) {
  if (!recorded && lang.value && right.length) vocab.record(lang.value, right.map(word => ({ word, right: true })), owner)
  recorded = true
  emit('finished', result)
}
</script>

<template>
  <div class="word-memory" data-test="word-memory">
    <div v-if="!lang" class="pick"><LanguagePick :owner="owner" @pick="pick" /></div>
    <Arcade v-else :deck="deck" @pair="onPair" @finished="finished" />
  </div>
</template>

<style scoped>
.word-memory { position: absolute; inset: 0; }
.pick {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; padding: 6vh 104px 16px;
  box-sizing: border-box; background: #fff3c4;
}
</style>
