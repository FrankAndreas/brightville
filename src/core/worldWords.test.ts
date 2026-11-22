import { describe, expect, it } from 'vitest'
import type { RaumTask } from './raum'
import { OBJECTS, THINGS, type Clue } from './world'
import { EN_NOUNS, FR_NOUNS, worldTexts } from './worldWords'

const place = (thing: string, ...clues: Clue[]): RaumTask => ({ type: 'place', thing, clues })
const find = (thing: string, ...clues: Clue[]): RaumTask => ({ type: 'find', thing, clues })
const en = worldTexts('en')
const fr = worldTexts('fr')

describe('the Spielwelt in English and French', () => {
  it('names every object and thing in both languages', () => {
    for (const { id } of [...OBJECTS, ...THINGS]) {
      expect(EN_NOUNS[id], id).toBeTruthy()
      expect(FR_NOUNS[id]?.noun, id).toBeTruthy()
      expect(['m', 'f'], id).toContain(FR_NOUNS[id].gender)
    }
  })

  it('English sentences', () => {
    expect(en.task(place('ball', { word: 'unter', object: 'tisch' }))).toBe('Put the ball under the table.')
    expect(en.task(find('katze', { word: 'hinter', object: 'baum' }))).toBe('The cat is behind the tree. Can you find it?')
    expect(en.task(place('ente', { word: 'zwischen', object: 'bett', other: 'tisch' }))).toBe('Put the duck between the bed and the table.')
    expect(en.task(place('hut', { word: 'links neben', object: 'bank' }, { word: 'vor', object: 'zaun' })))
      .toBe('Put the hat to the left of the bench and in front of the fence.')
    expect(en.again(place('ball', { word: 'auf', object: 'bett' }), [{ word: 'auf', object: 'bett' }])).toBe('Put it on the bed.')
    expect(en.describe('ball', { x: 28, y: 0, lane: 'mid', on: 'bett' }, OBJECTS)).toBe('The ball is now on the bed.')
    expect(en.cheer).toBe('Great!')
  })

  it('French sentences with the right articles, contractions and pronouns', () => {
    expect(fr.task(place('ball', { word: 'neben', object: 'bett' }))).toBe('Mets le ballon à côté du lit.')
    expect(fr.task(place('ball', { word: 'links neben', object: 'baum' }))).toBe("Mets le ballon à gauche de l'arbre.")
    expect(fr.task(place('ball', { word: 'rechts neben', object: 'kiste' }))).toBe('Mets le ballon à droite de la caisse.')
    expect(fr.task(place('ball', { word: 'zwischen', object: 'bett', other: 'tisch' }))).toBe('Mets le ballon entre le lit et la table.')
    expect(fr.task(find('katze', { word: 'hinter', object: 'baum' }))).toBe("Le chat est derrière l'arbre. Tu le trouves?")
    expect(fr.task(find('apfel', { word: 'unter', object: 'tisch' }))).toBe('La pomme est sous la table. Tu la trouves?')
    expect(fr.again(place('apfel', { word: 'in', object: 'kiste' }), [{ word: 'in', object: 'kiste' }])).toBe('Mets-la dans la caisse.')
    expect(fr.task(place('hut', { word: 'auf', object: 'bank' }, { word: 'vor', object: 'zaun' })))
      .toBe('Mets le chapeau sur le banc et devant la clôture.')
    expect(fr.describe('ball', { x: 28, y: 0, lane: 'mid', on: 'bett' }, OBJECTS)).toBe('Le ballon est maintenant sur le lit.')
  })

  it('never writes "de le", "de les" or "à le" in French, nor a French letter in English', () => {
    const words = ['auf', 'unter', 'in', 'neben', 'vor', 'hinter', 'links neben', 'rechts neben'] as const
    for (const o of OBJECTS) {
      for (const word of words) {
        for (const thing of THINGS) {
          const f = fr.task(place(thing.id, { word, object: o.id })) + fr.task(find(thing.id, { word, object: o.id }))
          expect(f, `${o.id} ${word}`).not.toMatch(/\bde le\b|\bde les\b|\bà le\b|\bde l' /)
          const e = en.task(place(thing.id, { word, object: o.id })) + en.task(find(thing.id, { word, object: o.id }))
          expect(e, `${o.id} ${word}`).not.toMatch(/[àâçéèêëîïôûùüÿœæ]/i)
        }
      }
    }
  })
})
