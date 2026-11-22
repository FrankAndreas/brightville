import { describe, expect, it } from 'vitest'
import { BUILTIN } from '@/core/vocab/builtin'
import { LANGS } from '@/core/vocab/types'
import { allScenes, sceneKey, SCENES } from './scenes'

describe('the listening scenes', () => {
  for (const lang of LANGS) {
    describe(lang, () => {
      it('has the topics of the word lists, with the same German names', () => {
        expect(SCENES[lang].map(t => [t.id, t.name])).toEqual(BUILTIN[lang].map(t => [t.id, t.name]))
      })

      it('has six well-formed scenes per topic', () => {
        for (const topic of SCENES[lang]) {
          expect(topic.scenes, topic.id).toHaveLength(6)
          expect(new Set(topic.scenes.map(s => s.id)).size, topic.id).toBe(6)
          for (const s of topic.scenes) {
            const at = `${lang}:${topic.id}:${s.id}`
            expect(s.lines.length, at).toBeGreaterThanOrEqual(1)
            expect(s.lines.length, at).toBeLessThanOrEqual(3)
            for (const line of s.lines) {
              expect(line.length, at).toBeLessThanOrEqual(160)
              expect(line.trim(), at).toBe(line)
              expect(line.length, at).toBeGreaterThan(0)
            }
            expect(s.question.endsWith('?'), at).toBe(true)
            expect(s.answers, at).toHaveLength(4)
            expect(new Set(s.answers).size, at).toBe(4)
            expect([0, 1, 2, 3], at).toContain(s.right)
          }
        }
      })
    })
  }

  it('never puts a French letter in an English scene', () => {
    for (const { key, scene } of allScenes('en')) expect(scene.lines.join(' '), key).not.toMatch(/[àâçéèêëîïôûùüÿœæ]/i)
  })

  it('never has the same line in both languages', () => {
    const en = new Set(allScenes('en').flatMap(x => x.scene.lines))
    for (const { key, scene } of allScenes('fr')) for (const line of scene.lines) expect(en.has(line), key).toBe(false)
  })

  it('keys a scene by language, topic and id, and lists one topic or all', () => {
    expect(sceneKey('fr', 'travel', 'quai')).toBe('fr:travel:quai')
    expect(allScenes('en')).toHaveLength(72)
    const travel = allScenes('en', 'travel')
    expect(travel).toHaveLength(6)
    expect(travel[0].key).toBe(`en:travel:${travel[0].scene.id}`)
    expect(travel.every(x => x.topic === 'travel')).toBe(true)
  })
})
