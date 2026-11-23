import { reactive } from 'vue'
import { heardRight } from '@/core/speak/check'
import type { SpeakItem } from '@/core/speak/round'
import type { Lang } from '@/core/vocab/types'
import { recognise, stopRecognising } from '@/services/recogniser'
import { SET_BONUS, STARS_PER_TASK } from '../visit'

export const MAX_TRIES = 3
/** The most a visit gives (shared/buildings.json) */
const MAX_STARS = 15

export interface SpeakState {
  index: number
  /** Wrong tries on this item (nothing heard is no try) */
  tries: number
  /** What the recogniser heard last time (its best guess) */
  heard: string | null
  phase: 'ready' | 'listening' | 'right' | 'wrong' | 'shown' | 'nothing' | 'denied' | 'done'
  stars: number
  /** The items finished: said right, or shown after the last try */
  results: { key: string; right: boolean }[]
}

/**
 * One speaking round: he taps 🎤, says the item, the recogniser's alternatives are checked. Right: a Star. Wrong: he
 * tries again, up to three times, then the right form is shown. `hear` is the recogniser (a stand-in in tests).
 */
export function createSpeakFlow(items: SpeakItem[], lang: Lang, hear: (lang: Lang) => Promise<string[]> = recognise) {
  const state = reactive<SpeakState>({ index: 0, tries: 0, heard: null, phase: items.length ? 'ready' : 'done', stars: 0, results: [] })
  let stopped = false
  let asking = 0

  const current = () => items[state.index]

  async function listen(): Promise<void> {
    if (stopped || !['ready', 'wrong', 'nothing', 'denied'].includes(state.phase)) return
    const mine = ++asking
    const item = current()
    state.phase = 'listening'
    let alternatives: string[]
    try {
      alternatives = await hear(lang)
    } catch {
      if (stopped || mine !== asking) return
      state.phase = 'denied'
      return
    }
    if (stopped || mine !== asking) return
    if (!alternatives.length) {
      state.phase = 'nothing'
      return
    }
    if (heardRight(alternatives, item.text, lang, { word: item.kind === 'word' })) {
      state.results.push({ key: item.key, right: true })
      state.stars += STARS_PER_TASK
      state.phase = 'right'
      return
    }
    state.tries++
    state.heard = alternatives[0]
    if (state.tries >= MAX_TRIES) {
      state.results.push({ key: item.key, right: false })
      state.phase = 'shown'
    } else {
      state.phase = 'wrong'
    }
  }

  function next(): void {
    if (stopped || (state.phase !== 'right' && state.phase !== 'shown')) return
    state.index++
    state.tries = 0
    state.heard = null
    if (state.index < items.length) {
      state.phase = 'ready'
      return
    }
    state.phase = 'done'
    if (items.length && state.results.every(r => r.right)) state.stars = Math.min(MAX_STARS, state.stars + SET_BONUS)
  }

  /** Leaving: the recogniser stops, and nothing it still answers counts */
  function stop(): void {
    stopped = true
    stopRecognising()
  }

  return { state, items, current, listen, next, stop }
}
