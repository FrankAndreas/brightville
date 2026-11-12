import { describe, expect, it } from 'vitest'
import { STORIES, pickStory } from './stories'

describe('the stories', () => {
  it('has four stories with a few scenes and three questions each', () => {
    expect(STORIES).toHaveLength(4)
    expect(new Set(STORIES.map(s => s.id)).size).toBe(4)
    for (const s of STORIES) {
      expect(s.scenes.length, s.id).toBeGreaterThanOrEqual(4)
      expect(s.questions, s.id).toHaveLength(3)
      for (const scene of s.scenes) expect(scene.picture && scene.text).toBeTruthy()
    }
  })

  it('asks questions with three different pictures and a right answer among them', () => {
    for (const s of STORIES) {
      for (const q of s.questions) {
        expect(q.choices, q.ask).toHaveLength(3)
        expect(new Set(q.choices.map(c => c.picture)).size, q.ask).toBe(3)
        expect(q.answer).toBeGreaterThanOrEqual(0)
        expect(q.answer).toBeLessThan(3)
      }
    }
  })

  it('does not always put the right answer in the same place', () => {
    const places = new Set(STORIES.flatMap(s => s.questions.map(q => q.answer)))
    expect(places).toEqual(new Set([0, 1, 2]))
  })

  it('never tells the same story twice in a row', () => {
    let last: string | null = null
    for (let i = 0; i < 40; i++) {
      const s = pickStory(last)
      expect(s.id).not.toBe(last)
      last = s.id
    }
  })
})
