<script setup lang="ts">
import { computed } from 'vue'
import { BUILTIN } from '@/core/vocab/builtin'
import type { Lang, VocabList } from '@/core/vocab/types'

// What he can practise in one language: his own lists (each to change with ✏️), all of them together, a new list, and
// the built-in topics (📘). Only this language: never the other one.
const props = defineProps<{ lang: Lang; lists: VocabList[] }>()
const emit = defineEmits<{ list: [id: number]; all: []; topic: [id: string]; edit: [id: number]; new: []; back: [] }>()

const mine = computed(() => props.lists.filter(l => l.lang === props.lang).sort((a, b) => a.id - b.id))
const topics = computed(() => BUILTIN[props.lang])
</script>

<template>
  <div class="shelf" data-test="shelf">
    <div class="head">
      <button type="button" class="back" data-test="back" @click="emit('back')">← Sprache</button>
      <h2>{{ lang === 'en' ? '🇬🇧 Englisch' : '🇫🇷 Französisch' }}</h2>
    </div>
    <h3>Meine Listen</h3>
    <div class="row">
      <span v-for="l in mine" :key="l.id" class="mine">
        <button type="button" class="list" :data-test="`list-${l.id}`" @click="emit('list', l.id)">{{ l.name }}</button>
        <button type="button" class="edit" :data-test="`edit-${l.id}`" aria-label="Liste ändern" @click="emit('edit', l.id)">✏️</button>
      </span>
      <button v-if="mine.length" type="button" class="list all" data-test="all" @click="emit('all')">Alle meine Wörter</button>
      <button type="button" class="list new" data-test="new-list" @click="emit('new')">＋ Neue Liste</button>
    </div>
    <h3>Grundwortschatz</h3>
    <div class="row">
      <button v-for="t in topics" :key="t.id" type="button" class="list" :data-test="`topic-${t.id}`" @click="emit('topic', t.id)">
        📘 {{ t.name }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.shelf { width: 100%; max-width: 860px; text-align: left; }
.head { display: flex; align-items: center; gap: 16px; }
h2 { margin: 0; font: 700 30px/1.2 system-ui, sans-serif; color: #23264a; }
h3 { margin: 18px 0 8px; font: 600 20px/1.2 system-ui, sans-serif; color: #5a5f86; }
.row { display: flex; flex-wrap: wrap; gap: 10px; }
.mine { display: inline-flex; }
button { font: 600 19px/1.2 system-ui, sans-serif; padding: 12px 16px; border-radius: 12px; border: 2px solid #c6cbec; background: #fff; color: #23264a; }
.mine .list { border-radius: 12px 0 0 12px; }
.edit { border-radius: 0 12px 12px 0; border-left: 0; padding: 12px 10px; }
.all { background: #eef0ff; }
.new { border-style: dashed; }
.back { padding: 8px 12px; font-size: 17px; }
</style>
