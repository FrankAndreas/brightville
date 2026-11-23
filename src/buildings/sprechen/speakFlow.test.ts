import { describe, expect, it, vi } from 'vitest'
import type { SpeakItem } from '@/core/speak/round'
import { createSpeakFlow, MAX_TRIES } from './speakFlow'

const item = (i: number): SpeakItem => ({ key: `en:speak:t:w${i}`, mode: 'repeat', kind: 'word', text: `word${i}`, shown: `word${i}`, de: `Wort${i}` })
const TEN = Array.from({ length: 10 }, (_, i) => item(i))

/** A recogniser the test answers by hand */
function ears() {
  const waiting: { resolve: (h: string[]) => void; reject: (e: Error) => void }[] = []
  const hear = vi.fn(() => new Promise<string[]>((resolve, reject) => { waiting.push({ resolve, reject }) }))
  return { hear, say: (...h: string[]) => waiting.shift()!.resolve(h), refuse: () => waiting.shift()!.reject(new Error('not-allowed')) }
}

describe('a speaking round, step by step', () => {
  it('said right: a Star, then on', async () => {
    const e = ears()
    const f = createSpeakFlow(TEN, 'en', e.hear)
    const p = f.listen()
    expect(f.state.phase).toBe('listening')
    e.say('nope', 'word0')
    await p
    expect(f.state).toMatchObject({ phase: 'right', stars: 1, results: [{ key: 'en:speak:t:w0', right: true }] })
    f.next()
    expect(f.state).toMatchObject({ index: 1, tries: 0, heard: null, phase: 'ready' })
  })

  it('three wrong tries: the right form is shown and the item counts wrong', async () => {
    const e = ears()
    const f = createSpeakFlow(TEN, 'en', e.hear)
    for (let t = 1; t <= MAX_TRIES; t++) {
      const p = f.listen()
      e.say('bird')
      await p
      expect(f.state.heard).toBe('bird')
      expect(f.state.tries).toBe(t)
      expect(f.state.phase).toBe(t < MAX_TRIES ? 'wrong' : 'shown')
    }
    expect(MAX_TRIES).toBe(3)
    expect(f.state.results).toEqual([{ key: 'en:speak:t:w0', right: false }])
    expect(f.state.stars).toBe(0)
  })

  it('nothing heard is no try; a refused microphone neither', async () => {
    const e = ears()
    const f = createSpeakFlow(TEN, 'en', e.hear)
    let p = f.listen()
    e.say()
    await p
    expect(f.state).toMatchObject({ phase: 'nothing', tries: 0 })
    p = f.listen()
    e.refuse()
    await p
    expect(f.state).toMatchObject({ phase: 'denied', tries: 0 })
  })

  it('a second tap while listening starts nothing', async () => {
    const e = ears()
    const f = createSpeakFlow(TEN, 'en', e.hear)
    void f.listen()
    void f.listen()
    expect(e.hear).toHaveBeenCalledTimes(1)
  })

  it('stopped while listening: a late answer changes nothing', async () => {
    const e = ears()
    const f = createSpeakFlow(TEN, 'en', e.hear)
    const p = f.listen()
    f.stop()
    e.say('word0')
    await p
    expect(f.state.stars).toBe(0)
    expect(f.state.results).toEqual([])
  })

  it('ten of ten: 15 Stars; the round ends after the last', async () => {
    const e = ears()
    const f = createSpeakFlow(TEN, 'en', e.hear)
    for (let i = 0; i < 10; i++) {
      const p = f.listen()
      e.say(`word${i}`)
      await p
      f.next()
    }
    expect(f.state).toMatchObject({ phase: 'done', stars: 15 })
  })

  it('nine of ten: 9 Stars', async () => {
    const e = ears()
    const f = createSpeakFlow(TEN, 'en', e.hear)
    for (let i = 0; i < 10; i++) {
      for (let t = 0; t < (i === 0 ? 3 : 1); t++) {
        const p = f.listen()
        e.say(i === 0 ? 'x' : `word${i}`)
        await p
      }
      f.next()
    }
    expect(f.state).toMatchObject({ phase: 'done', stars: 9 })
  })
})
