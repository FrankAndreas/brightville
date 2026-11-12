import { ref } from 'vue'
import { defineStore } from 'pinia'
import { SAVE_VERSION } from '@/core/save'
import type { SaveStore } from '@/services/storage'

export const usePlayerStore = defineStore('player', () => {
  const stars = ref(0)
  let saveStore: SaveStore | null = null

  function init(store: SaveStore) {
    saveStore = store
    stars.value = store.load().stars
  }

  /** Adds earned Stars. Only positive whole numbers count. */
  function award(count: number) {
    if (!Number.isInteger(count) || count <= 0) return
    stars.value += count
    saveStore?.save({ version: SAVE_VERSION, stars: stars.value })
  }

  return { stars, init, award }
})
