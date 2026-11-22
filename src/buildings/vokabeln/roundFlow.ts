import { answersOf, checkAnswer, type Checked } from '@/core/vocab/answer'
import { ROUND_SIZE, type RoundItem } from '@/core/vocab/round'
import type { Lang } from '@/core/vocab/types'
import { SET_BONUS, STARS_PER_TASK } from '../visit'

/**
 * A round of the vocabulary trainer, without the screen:
 *  asking  the word is shown; he picks or types
 *  right   it was right (a Star, if it was the first try); next() goes on
 *  wrong   it was wrong (or only its accent): the right answer is shown and he types it (retype) to go on; the word
 *          comes back once at the end of the round
 *  done    every word answered
 * Only a word's first answer counts: for its box, and for a Star.
 */
export interface RoundState {
  item: RoundItem | null
  index: number
  phase: 'asking' | 'right' | 'wrong' | 'done'
  /** The words asked, as many as the round started with (a word that comes back is not counted again) */
  total: number
  /** The last answer compared, while it is shown */
  checked: Checked | null
  firstTry: { key: string; right: boolean }[]
  stars: number
}

/** What a word's answer is compared with, and in which language: German for a typed foreign word, else (also a dictated word) the foreign word */
export function expectedOf(item: RoundItem, lang: Lang): { text: string; lang: Lang | 'de' } {
  return item.mode === 'type-foreign' ? { text: item.word.de, lang: 'de' } : { text: item.word.foreign, lang }
}

/** `wrap`: makes the state reactive for the screen (Vue's `reactive`); the rules mutate what it returns */
export function createRoundFlow(items: RoundItem[], lang: Lang, wrap: (s: RoundState) => RoundState = s => s) {
  const queue = [...items]
  const again = new Set<string>()
  const state: RoundState = wrap({
    item: queue[0] ?? null,
    index: 0,
    phase: queue.length ? 'asking' : 'done',
    total: items.length,
    checked: null,
    firstTry: [],
    stars: 0,
  })

  function judge(right: boolean, checked: Checked) {
    const item = state.item
    if (!item) return
    const first = !state.firstTry.some(f => f.key === item.word.key)
    if (first) state.firstTry.push({ key: item.word.key, right })
    state.checked = checked
    if (right) {
      if (first) state.stars += STARS_PER_TASK
      state.phase = 'right'
      return
    }
    state.phase = 'wrong'
    if (!again.has(item.word.key)) {
      again.add(item.word.key)
      queue.push(item)
    }
  }

  return {
    state,
    /** A typed answer; an empty one is no answer */
    answer(text: string) {
      if (state.phase !== 'asking' || !state.item || !text.trim()) return
      const want = expectedOf(state.item, lang)
      const checked = checkAnswer(text, want.text, { lang: want.lang })
      judge(checked.verdict === 'right', checked)
    },
    /** One of the choices tapped */
    choose(choice: string) {
      if (state.phase !== 'asking' || !state.item) return
      const answers = answersOf(state.item.word.foreign)
      const right = answers.some(a => a.toLowerCase() === choice.toLowerCase())
      judge(right, { verdict: right ? 'right' : 'wrong', shown: answers[0] ?? '', marks: [] })
    },
    /** After a wrong answer: he types the right one; only that goes on */
    retype(text: string) {
      if (state.phase !== 'wrong' || !state.item) return
      const want = expectedOf(state.item, lang)
      if (checkAnswer(text, want.text, { lang: want.lang }).verdict === 'right') state.phase = 'right'
    },
    next() {
      if (state.phase !== 'right') return
      state.index++
      state.checked = null
      state.item = queue[state.index] ?? null
      if (state.item) {
        state.phase = 'asking'
        return
      }
      state.phase = 'done'
      const perfect = state.total === ROUND_SIZE && state.firstTry.every(f => f.right)
      if (perfect) state.stars += SET_BONUS
    },
  }
}
