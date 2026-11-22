<script lang="ts">
/** The French accented letters, for keyboards without them */
export const ACCENTS = ['é', 'è', 'ê', 'à', 'â', 'ç', 'ô', 'î', 'û', 'ë', 'ï', 'ù', 'œ']
</script>

<script setup lang="ts">
// A row of buttons that type an accented letter into `target` at its caret. They act on pointerdown and prevent its
// default (and mousedown's, which moves the focus on a laptop), so the field keeps the focus and the iPad its keyboard.
const props = defineProps<{ target: HTMLInputElement | null }>()

function type(letter: string, e: Event) {
  e.preventDefault()
  const input = props.target
  if (!input) return
  const start = input.selectionStart ?? input.value.length
  const end = input.selectionEnd ?? start
  input.value = input.value.slice(0, start) + letter + input.value.slice(end)
  input.focus()
  input.setSelectionRange(start + letter.length, start + letter.length)
  // v-model listens to this
  input.dispatchEvent(new Event('input', { bubbles: true }))
}
</script>

<template>
  <div class="accents" data-test="accent-keys">
    <button v-for="a in ACCENTS" :key="a" type="button" :data-key="a" @pointerdown="type(a, $event)" @mousedown.prevent>{{ a }}</button>
  </div>
</template>

<style scoped>
.accents { display: flex; flex-wrap: wrap; gap: 6px; justify-content: center; }
.accents button {
  min-width: 44px; height: 44px; font: 600 22px/1 system-ui, sans-serif; border: 2px solid #c6cbec; border-radius: 10px;
  background: #fff; color: #23264a; touch-action: manipulation;
}
</style>
