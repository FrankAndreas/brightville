<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { speak, stopSpeaking } from '@/services/tts'

// The controls as pictures, read aloud. The few words are for a grown-up
// looking over the shoulder; nothing here needs reading.
const props = defineProps<{
  /** Fingers only: show the on-screen controls instead of the keys */
  touch?: boolean
}>()
const emit = defineEmits<{ close: [] }>()

const SPOKEN =
  'Mit den Pfeiltasten läufst du. Mit der Leertaste springst du. ' +
  'Mit Enter gehst du durch die leuchtende Tür. Mit Escape gehst du wieder hinaus.'

const SPOKEN_TOUCH =
  'Zieh mit dem Finger, dann läufst du. Tipp auf den Pfeil, dann springst du. ' +
  'Tipp auf das Bild an der leuchtenden Tür, dann gehst du hinein. Mit der Tür oben links gehst du wieder hinaus.'

const close = () => emit('close')

// A key still held from before, or a bare Shift or Ctrl, is not a wish to close
const MODIFIERS = new Set(['Shift', 'Control', 'Alt', 'AltGraph', 'Meta', 'CapsLock', 'OS'])
function onKey(e: KeyboardEvent) {
  if (e.repeat || MODIFIERS.has(e.key)) return
  close()
}

onMounted(() => {
  void speak(props.touch ? SPOKEN_TOUCH : SPOKEN)
  window.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  stopSpeaking()
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div class="help" data-test="help" @pointerdown="close">
    <div class="card">
      <div class="row" data-test="help-row">
        <svg v-if="touch" class="keys" data-test="help-touch" viewBox="0 0 150 100" aria-hidden="true">
          <circle cx="75" cy="50" r="42" class="pad" /><circle cx="92" cy="40" r="18" class="thumb" />
          <path d="M75 50 L92 40" class="dash" />
        </svg>
        <svg v-else class="keys" data-test="help-keys" viewBox="0 0 150 100" aria-hidden="true">
          <g class="cap"><rect x="52" y="4" width="46" height="42" rx="9" /><rect x="4" y="52" width="46" height="42" rx="9" /><rect x="52" y="52" width="46" height="42" rx="9" /><rect x="100" y="52" width="46" height="42" rx="9" /></g>
          <g class="glyph"><path d="M75 34 V16 M67 24 L75 16 L83 24" /><path d="M75 64 V82 M67 74 L75 82 L83 74" /><path d="M36 73 H18 M26 65 L18 73 L26 81" /><path d="M114 73 H132 M124 65 L132 73 L124 81" /></g>
        </svg>
        <svg class="what" viewBox="0 0 100 100" aria-hidden="true">
          <ellipse cx="46" cy="50" rx="24" ry="28" class="blob" />
          <circle cx="54" cy="42" r="4" class="eye" /><circle cx="40" cy="42" r="4" class="eye" />
          <ellipse cx="36" cy="82" rx="10" ry="6" class="foot" /><ellipse cx="60" cy="78" rx="10" ry="6" class="foot" />
          <path d="M78 40 H94 M78 52 H90 M78 64 H94" class="dash" />
        </svg>
        <span class="word">Laufen</span>
      </div>

      <div class="row" data-test="help-row">
        <svg v-if="touch" class="keys" data-test="help-touch" viewBox="0 0 150 100" aria-hidden="true">
          <circle cx="75" cy="50" r="40" class="button" /><path d="M75 72 V32 M58 47 L75 30 L92 47" class="glyph-line" />
        </svg>
        <svg v-else class="keys" data-test="help-keys" viewBox="0 0 150 100" aria-hidden="true">
          <g class="cap"><rect x="6" y="30" width="138" height="42" rx="10" /></g>
          <g class="glyph"><path d="M50 46 V56 H100 V46" /></g>
        </svg>
        <svg class="what" viewBox="0 0 100 100" aria-hidden="true">
          <ellipse cx="50" cy="40" rx="22" ry="28" class="blob" />
          <circle cx="58" cy="32" r="4" class="eye" /><circle cx="44" cy="32" r="4" class="eye" />
          <path d="M50 96 V76 M40 84 L50 74 L60 84" class="dash" />
        </svg>
        <span class="word">Springen</span>
      </div>

      <div class="row" data-test="help-row">
        <svg v-if="touch" class="keys" data-test="help-touch" viewBox="0 0 150 100" aria-hidden="true">
          <rect x="20" y="18" width="110" height="64" rx="20" class="pad" />
          <circle cx="75" cy="46" r="17" class="ripple" /><circle cx="75" cy="46" r="6" class="eye" />
          <path d="M75 46 v30" class="dash" />
        </svg>
        <svg v-else class="keys" data-test="help-keys" viewBox="0 0 150 100" aria-hidden="true">
          <g class="cap"><rect x="30" y="18" width="90" height="64" rx="12" /></g>
          <g class="glyph"><path d="M98 34 v18 H56 M68 40 L54 52 L68 64" /></g>
        </svg>
        <svg class="what" viewBox="0 0 100 100" aria-hidden="true">
          <rect x="26" y="12" width="48" height="78" rx="6" class="door-frame" />
          <rect x="34" y="20" width="32" height="70" rx="3" class="door" />
          <circle cx="58" cy="58" r="3" class="knob" />
        </svg>
        <span class="word">Hineingehen</span>
      </div>

      <div class="row" data-test="help-row">
        <svg v-if="touch" class="keys" data-test="help-touch" viewBox="0 0 150 100" aria-hidden="true">
          <circle cx="75" cy="50" r="40" class="pad" />
          <path d="M72 28 H96 V72 H72" class="frame" /><path d="M82 50 H50 M62 38 L50 50 L62 62" class="dash" />
        </svg>
        <svg v-else class="keys" data-test="help-keys" viewBox="0 0 150 100" aria-hidden="true">
          <g class="cap"><rect x="42" y="24" width="66" height="52" rx="10" /></g>
          <text x="75" y="58" class="label">Esc</text>
        </svg>
        <svg class="what" viewBox="0 0 100 100" aria-hidden="true">
          <rect x="40" y="12" width="48" height="78" rx="6" class="door-frame" />
          <rect x="48" y="20" width="32" height="70" rx="3" class="door" />
          <path d="M40 56 H10 M22 44 L10 56 L22 68" class="dash" />
        </svg>
        <span class="word">Hinausgehen</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.help {
  position: fixed;
  inset: 0;
  z-index: 8;
  display: grid;
  place-items: center;
  background: rgb(60 50 110 / 45%);
  cursor: pointer;
}
.card {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2.5vh 3vw;
  padding: 4vh 4vw;
  border-radius: 40px;
  background: #fffdf5;
  box-shadow: 0 10px 0 rgb(0 0 0 / 15%);
}
.row { display: grid; grid-template-columns: auto auto; grid-template-rows: auto auto; align-items: center; justify-items: center; gap: 4px 18px; }
.keys { width: min(17vw, 190px); }
.what { width: min(11vw, 120px); }
.word { grid-column: 1 / -1; font-size: clamp(16px, 2.2vw, 26px); font-weight: 700; color: #6b4a00; }
.cap rect { fill: #fff; stroke: #6b4a00; stroke-width: 4; filter: drop-shadow(0 5px 0 #c9a800); }
.glyph path, .dash { fill: none; stroke: #6b4a00; stroke-width: 6; stroke-linecap: round; stroke-linejoin: round; }
.label { font: 800 24px system-ui, sans-serif; fill: #6b4a00; text-anchor: middle; }
.pad { fill: #eef6ff; stroke: #b9d6ee; stroke-width: 4; }
.thumb { fill: #fff; stroke: #6b4a00; stroke-width: 4; }
.button { fill: #ffd93d; stroke: #e0a800; stroke-width: 4; }
.glyph-line, .frame { fill: none; stroke: #6b4a00; stroke-width: 8; stroke-linecap: round; stroke-linejoin: round; }
.frame { stroke: #b9a27a; }
.ripple { fill: #ffe89a; stroke: #ffd93d; stroke-width: 4; }
.blob { fill: #ff9a3c; }
.foot { fill: #f07f1b; }
.eye { fill: #222; }
.door-frame { fill: #ffd93d; }
.door { fill: #6b4a2b; }
.knob { fill: #ffd93d; }
</style>
