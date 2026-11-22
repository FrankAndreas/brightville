import { describe, expect, it } from 'vitest'
import { GRAMMAR, type Topic } from './content'
import type { Lang } from '@/core/vocab/types'

const NAMES: Record<Lang, [string, string][]> = {
  en: [
    ['present-simple-continuous', 'Present simple / continuous'],
    ['past-simple', 'Past simple'],
    ['present-perfect', 'Present perfect / past simple'],
    ['will-going-to', 'will / going to'],
    ['do-questions', 'Fragen und Verneinung (do/does/did)'],
    ['comparison', 'Steigerung'],
    ['modals', 'can / must / have to / should'],
    ['some-any', 'some / any, much / many'],
    ['adverbs', 'Adverbien (-ly)'],
    ['relatives', 'who / which / that'],
    ['if-will', 'If-Sätze (Typ 1)'],
    ['passive', 'Passiv'],
  ],
  fr: [
    ['articles', 'Artikel und Geschlecht'],
    ['etre-avoir-aller-faire', 'être, avoir, aller, faire'],
    ['present-er-ir-re', 'Verben auf -er, -ir, -re'],
    ['passe-compose-avoir', 'Passé composé mit avoir'],
    ['passe-compose-etre', 'Passé composé mit être'],
    ['futur-proche', 'Futur proche'],
    ['negation', 'Verneinung'],
    ['adjectives', 'Adjektive'],
    ['partitive', 'Teilungsartikel (du, de la, des)'],
    ['possessives', 'Possessivbegleiter (mon, ma, mes)'],
    ['object-pronouns', 'Objektpronomen (le, la, lui, leur)'],
    ['questions', 'Fragen (est-ce que, Inversion)'],
  ],
}
const FORM_TOPICS: Record<Lang, string[]> = {
  en: ['past-simple'],
  fr: ['etre-avoir-aller-faire', 'present-er-ir-re', 'passe-compose-avoir', 'passe-compose-etre', 'futur-proche'],
}

/** As the School compares: case, spaces, curly apostrophes and a final full stop don't matter */
const tidy = (s: string) => s.replace(/[’‘`´]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase().replace(/\s*[.!?]$/, '')
const FRENCH = /[àâçéèêëîïôûùüÿœæ]/i

export function checkLanguage(lang: Lang) {
  const topics: Topic[] = GRAMMAR[lang]

  it('has the twelve topics with their German names and a short rule', () => {
    expect(topics.map(t => [t.id, t.name])).toEqual(NAMES[lang])
    for (const t of topics) {
      expect(t.rule.length, t.id).toBeGreaterThan(5)
      expect(t.rule.length, t.id).toBeLessThanOrEqual(80)
      expect(t.rule, t.id).not.toContain('\n')
    }
    expect(topics.filter(t => t.kind === 'form').map(t => t.id)).toEqual(FORM_TOPICS[lang])
  })

  it('every choice topic has at least 18 well-formed sentences', () => {
    for (const t of topics) {
      if (t.kind !== 'choice') continue
      expect(t.items.length, t.id).toBeGreaterThanOrEqual(18)
      expect(new Set(t.items.map(i => i.id)).size, t.id).toBe(t.items.length)
      for (const i of t.items) {
        const at = `${t.id}:${i.id}`
        expect(i.text.split('___').length - 1, at).toBe(1)
        expect(i.answers.length, at).toBeGreaterThanOrEqual(1)
        expect(i.wrong, at).toHaveLength(3)
        const right = new Set(i.answers.map(tidy))
        expect(new Set(i.wrong.map(tidy)).size, at).toBe(3)
        for (const w of i.wrong) expect(right.has(tidy(w)), `${at} ${w}`).toBe(false)
        if (lang === 'en') expect(i.text + i.answers.join(), at).not.toMatch(FRENCH)
      }
    }
  })

  it('every form topic has frames whose verbs all have their forms', () => {
    for (const t of topics) {
      if (t.kind !== 'form') continue
      expect(t.frames.length, t.id).toBeGreaterThanOrEqual(6)
      expect(new Set(t.frames.map(f => f.id)).size, t.id).toBe(t.frames.length)
      for (const f of t.frames) {
        const at = `${t.id}:${f.id}`
        expect(f.text.split('___').length - 1, at).toBe(1)
        expect(f.verbs.length, at).toBeGreaterThan(0)
        for (const p of f.persons ?? []) expect(t.persons, at).toContain(p)
        for (const v of f.verbs) {
          const verb = t.verbs[v]
          expect(verb, `${at} ${v}`).toBeDefined()
          if (typeof verb.forms === 'string') expect(verb.forms.length, `${at} ${v}`).toBeGreaterThan(0)
          else for (const p of t.persons) expect(verb.forms[p]?.length, `${at} ${v} ${p}`).toBeGreaterThan(0)
        }
      }
      if (lang === 'en') {
        for (const [v, verb] of Object.entries(t.verbs)) {
          expect(verb.wrong?.length ?? 0, v).toBeGreaterThanOrEqual(2)
          for (const w of verb.wrong ?? []) expect(tidy(w), v).not.toBe(tidy(verb.forms as string))
        }
      }
    }
  })
}

describe('English grammar', () => checkLanguage('en'))
