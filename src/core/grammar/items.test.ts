import { describe, expect, it } from 'vitest'
import { filled, itemByKey, itemsOf } from './items'

const tidy = (s: string) => s.replace(/[’‘]/g, "'").trim().toLowerCase()

describe('grammar items', () => {
  it('makes French form items with the subject in the gap and agreement written out', () => {
    const items = itemsOf('fr', 'passe-compose-etre')
    const allee = items.find(i => i.key === 'fr:passe-compose-etre:cinema.aller.elle')!
    expect(allee.answers).toEqual(['elle est allée'])
    expect(allee.hint).toBe('(elle · aller)')
    expect(filled(allee)).toBe('Hier, elle est allée au cinéma.')
    const je = items.find(i => i.key === 'fr:passe-compose-etre:cinema.aller.je')!
    expect(je.answers).toEqual(['je suis allé', 'je suis allée'])
  })

  it('elides je before a vowel or h, and starts a sentence with a capital', () => {
    const ai = itemByKey('fr:etre-avoir-aller-faire:ans.avoir.je')!
    expect(ai.answers).toEqual(["j'ai"])
    expect(filled(ai)).toBe("J'ai treize ans.")
    expect(itemByKey('fr:present-er-ir-re:berne.habiter.je')!.answers).toEqual(["j'habite"])
    expect(itemByKey('fr:present-er-ir-re:berne.habiter.tu')!.answers).toEqual(['tu habites'])
  })

  it('makes English past simple items with the subject in the sentence', () => {
    const went = itemByKey('en:past-simple:weekend.go.she')!
    expect(went.text).toBe('Last weekend she ___ to Lucerne.')
    expect(went.answers).toEqual(['went'])
    expect(went.hint).toBe('(go)')
    expect(filled(itemByKey('en:past-simple:lunch.eat.he')!)).toBe('He ate a pizza for lunch yesterday.')
    // A frame saying "my" only takes "I"
    expect(itemByKey('en:past-simple:letter.write.she')).toBeUndefined()
    expect(itemByKey('en:past-simple:letter.write.I')).toBeDefined()
  })

  it('never offers a wrong choice that is also right, nor the same text twice', () => {
    for (const lang of ['en', 'fr'] as const) {
      for (const topic of ['past-simple', 'passe-compose-etre', 'etre-avoir-aller-faire', 'futur-proche', 'modals', 'articles']) {
        for (const item of itemsOf(lang, topic)) {
          const right = new Set(item.answers.map(tidy))
          const wrong = item.wrong.map(tidy)
          expect(item.wrong.length, item.key).toBeGreaterThanOrEqual(3)
          expect(new Set(wrong).size, item.key).toBe(wrong.length)
          for (const w of wrong) expect(right.has(w), `${item.key}: ${w}`).toBe(false)
        }
      }
    }
  })
})
