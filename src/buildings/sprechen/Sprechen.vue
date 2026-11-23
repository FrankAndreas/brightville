<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import ProgressStars from '@/components/ProgressStars.vue'
import { buildSpeakRound } from '@/core/speak/round'
import { builtinWords } from '@/core/vocab/builtin'
import { ownWords } from '@/core/vocab/round'
import type { Lang } from '@/core/vocab/types'
import { playBeat } from '@/services/sound'
import { hasVoice, speak } from '@/services/tts'
import { usePlayerStore } from '@/stores/player'
import { useSpeakStore } from '@/stores/speak'
import { useVocabStore } from '@/stores/vocab'
import type { BuildingResult } from '../types'
import { useVisit } from '../visit'
import LanguagePick from '../vokabeln/LanguagePick.vue'
import { createSpeakFlow, MAX_TRIES } from './speakFlow'

// The Trommelhaus at Oberstufe (docs/superpowers/specs/2026-11-23-brightville-oberstufe-play-speak-look-design.md):
// he picks the language and says ten words and sentences: Nachsprechen (the text written and spoken) or Übersetzen
// (the German written, for words he knows well). The browser's recogniser checks (services/recogniser.ts).
const emit = defineEmits<{ finished: [result: BuildingResult] }>()

const VOICE: Record<Lang, string> = { en: 'en-GB', fr: 'fr-FR' }
const NEXT_MS = 1200

const record = useSpeakStore()
const vocab = useVocabStore()
const player = usePlayerStore()
// The child who started the visit: his answers count for him, even if the device changes hands meanwhile
const owner = record.who
const visit = useVisit(leave)
let recorded = false

type Screen = 'lang' | 'round' | 'end'
const screen = ref<Screen>('lang')
const lang = ref<Lang>('en')
const flow = shallowRef<ReturnType<typeof createSpeakFlow> | null>(null)

const localDay = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const item = computed(() => (flow.value && flow.value.state.phase !== 'done' ? flow.value.items[flow.value.state.index] : null))
const voiced = computed(() => hasVoice(VOICE[lang.value]))
const right = computed(() => flow.value?.state.results.filter(r => r.right).length ?? 0)

function say(text: string) {
  if (voiced.value) void speak(text, VOICE[lang.value])
}

function pick(chosen: Lang) {
  lang.value = chosen
  const words = [...ownWords(vocab.lists, chosen), ...builtinWords(chosen)]
  const items = buildSpeakRound(chosen, words, vocab.progress, record.progress, Math.random, player.day || localDay())
  flow.value = createSpeakFlow(items, chosen)
  screen.value = 'round'
}

// Each new item: a Nachsprechen item is said first
watch(() => [flow.value?.state.index, flow.value?.state.phase === 'ready'] as const, ([, ready], old) => {
  if (ready && item.value?.mode === 'repeat' && old?.[0] !== flow.value?.state.index) say(item.value.shown)
}, { immediate: true })

watch(() => flow.value?.state.phase, phase => {
  const f = flow.value
  if (!f) return
  if (phase === 'right') {
    playBeat('chime')
    const at = f.state.index
    visit.later(() => { if (f.state.index === at) f.next() }, NEXT_MS)
  } else if (phase === 'shown' && item.value) {
    say(item.value.shown)
  } else if (phase === 'done') {
    screen.value = 'end'
  }
})

function mic() {
  void flow.value?.listen()
}

function leave() {
  if (visit.isClosed()) return
  visit.shutDown()
  const f = flow.value
  f?.stop()
  if (f && !recorded && f.state.results.length) record.record(lang.value, f.state.results.map(r => ({ item: r.key, right: r.right })), owner)
  recorded = true
  emit('finished', { stars: f?.state.stars ?? 0 })
}

function onKey(e: KeyboardEvent) {
  if (e.code === 'Escape') leave()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  flow.value?.stop()
})
</script>

<template>
  <div class="sprechen" data-test="sprechen">
    <LanguagePick v-if="screen === 'lang'" :owner="owner" @pick="pick" />

    <div v-else-if="screen === 'round' && flow && item" class="round" data-test="item" :data-index="flow.state.index">
      <div data-test="stars" :data-solved="right"><ProgressStars :total="flow.items.length" :solved="right" /></div>
      <p class="mode" data-test="mode">{{ item.mode === 'repeat' ? '🎤 Nachsprechen' : '🔁 Übersetzen' }}</p>

      <template v-if="item.mode === 'repeat'">
        <p class="big" data-test="say" :lang="lang">{{ item.shown }}</p>
        <button v-if="voiced" type="button" class="again" aria-label="Nochmal hören" data-test="hear" @click="say(item.shown)">🔊</button>
      </template>
      <template v-else>
        <p class="big" data-test="prompt-de" lang="de">{{ item.de }}</p>
        <p class="hint">Sag es auf {{ lang === 'en' ? 'Englisch' : 'Französisch' }}.</p>
      </template>

      <button
        v-if="flow.state.phase !== 'right' && flow.state.phase !== 'shown'" type="button" class="mic"
        :class="{ on: flow.state.phase === 'listening' }" data-test="mic" aria-label="Sprechen" @click="mic"
      >🎤</button>

      <p v-if="flow.state.phase === 'listening'" class="line">Ich höre zu …</p>
      <p v-if="flow.state.phase === 'right'" class="line good" data-test="right">Richtig! ⭐</p>
      <template v-if="flow.state.phase === 'wrong'">
        <p class="line" data-test="heard">Gehört: „{{ flow.state.heard }}“</p>
        <p class="line" data-test="tries">Nochmal versuchen ({{ flow.state.tries + 1 }} von {{ MAX_TRIES }})</p>
      </template>
      <p v-if="flow.state.phase === 'nothing'" class="line" data-test="nothing">Nichts gehört – tipp nochmal auf 🎤</p>
      <p v-if="flow.state.phase === 'denied'" class="line" data-test="denied">
        Das Mikrofon ist nicht erlaubt. Bitte in den Einstellungen erlauben, dann nochmal auf 🎤 tippen.
      </p>
      <template v-if="flow.state.phase === 'shown'">
        <p class="line" data-test="heard">Gehört: „{{ flow.state.heard }}“</p>
        <p class="line" data-test="shown">So heisst es: <strong :lang="lang">{{ item.shown }}</strong></p>
        <button type="button" class="next" data-test="next" @click="flow.next()">Weiter</button>
      </template>
    </div>

    <div v-else-if="screen === 'end' && flow" class="end" data-test="end">
      <ProgressStars :total="flow.items.length" :solved="right" big />
      <p>{{ right }} von {{ flow.items.length }} richtig – {{ flow.state.stars }} ⭐</p>
      <button type="button" data-test="finish" @click="leave">Fertig</button>
    </div>
  </div>
</template>

<style scoped>
.sprechen {
  position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: flex-start;
  /* Clear of the leave button in the top left corner (and the same on the right, to stay centred) */
  padding: 6vh 104px 16px; box-sizing: border-box; overflow: auto; background: #fdf1e4;
  font-family: system-ui, sans-serif; color: #23264a;
}
.round { display: flex; flex-direction: column; align-items: center; gap: 14px; width: 100%; max-width: 760px; text-align: center; }
.mode { font: 600 22px/1.2 system-ui, sans-serif; margin: 6px 0 0; color: #7a4a14; }
.big { font: 700 clamp(28px, 5vh, 44px)/1.25 system-ui, sans-serif; margin: 8px 0 0; overflow-wrap: anywhere; }
.hint { margin: 0; font-size: 20px; color: #5b6070; }
.again { font-size: 30px; border: 0; background: #fff; border-radius: 50%; width: 60px; height: 60px; box-shadow: 0 3px 0 #e2c9a8; }
.mic {
  font-size: 56px; width: 120px; height: 120px; border-radius: 50%; border: 0; margin-top: 10px;
  background: #ff8a3d; box-shadow: 0 7px 0 #c45d14; cursor: pointer;
}
.mic.on { animation: pulse 1s ease-in-out infinite; background: #ff5f3d; }
.line { font: 600 22px/1.3 system-ui, sans-serif; margin: 0; }
.good { color: #1f8a3b; }
.next, .end button {
  font: 600 26px/1.2 system-ui, sans-serif; padding: 18px 40px; min-width: 300px; border-radius: 14px;
  border: 3px solid #e2c9a8; background: #fff; color: #23264a;
}
.end { display: flex; flex-direction: column; align-items: center; gap: 18px; font: 600 26px/1.3 system-ui, sans-serif; }
@keyframes pulse { 50% { transform: scale(1.08); } }
</style>
