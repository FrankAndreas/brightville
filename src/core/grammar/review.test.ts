import { describe, expect, it } from 'vitest'
import { createRoundFlow } from '@/buildings/vokabeln/roundFlow'
import { GRAMMAR } from './content'
import { filled, itemByKey, itemsOf } from './items'
import { isWeak, rightOfLast10, toRoundItem } from './round'

/** Whether typing `text` for the item counts as right */
function accepts(key: string, text: string): boolean {
  const flow = createRoundFlow([toRoundItem(itemByKey(key)!, true, Math.random)], key.slice(0, 2) as 'en' | 'fr')
  flow.answer(text)
  return flow.state.phase === 'right'
}
const wrongOf = (key: string) => itemByKey(key)!.wrong

describe('the grammar content after the review', () => {
  it('French inversion keeps its linking t', () => {
    expect(filled(itemByKey('fr:questions:12')!)).toBe('Habite-t-il à Genève?')
  })

  it('"Why ___ you call me" takes only "didn\'t"', () => {
    expect(itemByKey('en:do-questions:9')!.answers).toEqual(["didn't"])
    expect(itemByKey('en:do-questions:9')!.hint).toBe('(not)')
  })

  it('no wrong choice is a correct alternative', () => {
    expect(wrongOf('en:passive:10')).not.toContain('closes')
    expect(wrongOf('en:passive:16')).not.toContain('are clean')
    expect(wrongOf('en:passive:17')).not.toContain('opened')
    expect(wrongOf('en:adverbs:16')).not.toContain('later')
    expect(wrongOf('en:some-any:6')).not.toContain('a')
    for (const k of ['1', '7', '14']) expect(wrongOf(`en:adverbs:${k}`).filter(w => w === 'slow' || w === 'loud')).toEqual([])
  })

  it('every past simple frame says when (so the present is never right)', () => {
    const topic = GRAMMAR.en.find(t => t.id === 'past-simple')!
    if (topic.kind !== 'form') throw new Error('form topic')
    for (const f of topic.frames) expect(f.text, f.id).toMatch(/yesterday|last |ago|when I was|in 20\d\d/i)
  })

  it('a passé composé with avoir never has a correct present among its choices', () => {
    expect(itemByKey('fr:passe-compose-avoir:devoirs.faire.il')!.text).toMatch(/^Hier/)
  })

  it('"on" is never offered the feminine singular as a wrong choice', () => {
    for (const item of itemsOf('fr', 'passe-compose-etre').filter(i => i.key.endsWith('.on'))) {
      expect(item.wrong.some(w => /^on est \S+ée$/.test(w)), item.key).toBe(false)
    }
  })

  it('takes the other right answers when he types', () => {
    expect(accepts('en:modals:4', 'must')).toBe(true)
    expect(accepts('en:modals:8', 'have to')).toBe(true)
    expect(accepts('en:modals:12', 'have to')).toBe(true)
    expect(accepts('en:modals:14', 'must')).toBe(true)
    expect(accepts('en:modals:2', "can't")).toBe(true)
    expect(accepts('en:will-going-to:10', 'will')).toBe(true)
    expect(accepts('en:if-will:14', 'starts')).toBe(true)
  })

  it('some/any/much/many sentences where two would fit say which', () => {
    for (const k of ['1', '3', '7', '8', '9', '12', '14']) expect(itemByKey(`en:some-any:${k}`)!.hint, k).toMatch(/^\(.+\)$/)
  })

  it('a gap that starts the sentence shows its choices with a capital', () => {
    const item = toRoundItem(itemByKey('fr:etre-avoir-aller-faire:ans.avoir.je')!, false, Math.random)
    expect(item.choices).toContain("J'ai")
    expect(item.choices!.every(c => c[0] === c[0].toUpperCase())).toBe(true)
  })

  it('a malformed record read back from the device does not break the counts', () => {
    const odd = {} as { recent: boolean[]; missed: string[] }
    expect(rightOfLast10(odd)).toBe(0)
    expect(isWeak(odd)).toBe(false)
  })
})
