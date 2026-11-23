<script setup lang="ts">
import { computed, ref } from 'vue'
import { keptLang, lastLangKey } from '@/core/vocab/lastLang'
import type { Lang } from '@/core/vocab/types'
import { hasVoice, voiceCount } from '@/services/tts'

// The first screen of the Oberstufe's language buildings: English or French, the last one he chose marked (the same
// for the School, Schreiben and the Reimhaus). `needsVoice`: a building that speaks; a language without a voice on
// this device can't be picked there.
const props = defineProps<{ owner: number | null; needsVoice?: boolean }>()
const emit = defineEmits<{ pick: [lang: Lang] }>()

const VOICE: Record<Lang, string> = { en: 'en-GB', fr: 'fr-FR' }
const LANGS: { lang: Lang; label: string }[] = [{ lang: 'en', label: '🇬🇧 Englisch' }, { lang: 'fr', label: '🇫🇷 Französisch' }]

const LAST_LANG = lastLangKey(props.owner)
const lastLang = ref<Lang | null>(keptLang(props.owner))

/** The languages without a voice here, counted again when the voices arrive late */
const mute = computed(() => {
  void voiceCount.value
  return new Set(props.needsVoice ? LANGS.filter(l => !hasVoice(VOICE[l.lang])).map(l => l.lang) : [])
})

function pick(chosen: Lang) {
  if (mute.value.has(chosen)) return
  try {
    window.localStorage.setItem(LAST_LANG, chosen)
  } catch {
    // Not remembered
  }
  emit('pick', chosen)
}
</script>

<template>
  <div class="langs">
    <h2>Welche Sprache?</h2>
    <button
      v-for="l in LANGS" :key="l.lang" type="button" :data-test="`lang-${l.lang}`"
      :class="{ last: lastLang === l.lang }" :disabled="mute.has(l.lang)" @click="pick(l.lang)"
    >
      <span class="name">{{ l.label }}</span><small v-if="mute.has(l.lang)">Keine Stimme</small>
    </button>
  </div>
</template>

<style scoped>
.langs { display: flex; flex-direction: column; gap: 16px; align-items: center; margin-top: 8vh; }
.langs h2 { font: 700 32px/1.2 system-ui, sans-serif; color: #23264a; margin: 0 0 8px; }
.langs button {
  font: 600 26px/1.2 system-ui, sans-serif; padding: 18px 40px; min-width: 300px; border-radius: 14px;
  border: 3px solid #c6cbec; background: #fff; color: #23264a;
}
.langs button.last { border-color: #4a5bd4; }
.langs button:disabled { color: #9a9db8; }
.langs button:disabled .name { text-decoration: line-through; }
.langs small { display: block; font-size: 16px; }
</style>
