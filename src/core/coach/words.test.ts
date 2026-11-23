import { describe, expect, it } from 'vitest'
import { MOVES } from '@/core/moves/reps'
import { POSES } from '@/core/pose/poses'
import { coachWords, SIMON_MOVES } from './words'

const FRENCH = /[àâçéèêëîïôûùüÿœæ]/i

describe("the coach's words", () => {
  it('has a title and a description for every pose, without animals', () => {
    for (const lang of ['en', 'fr'] as const) {
      const w = coachWords(lang)
      for (const p of POSES) {
        expect(w.poseTitle(p.id), `${lang} ${p.id}`).toBeTruthy()
        expect(w.poseSay(p.id), `${lang} ${p.id}`).toMatch(/\.$/)
        expect(`${w.poseTitle(p.id)} ${w.poseSay(p.id)}`).not.toMatch(/frog|frosch|grenouille|plane|avion|flieger|giant|géant|riese/i)
      }
    }
  })

  it('says how many of a move to do, and counts', () => {
    const en = coachWords('en')
    const fr = coachWords('fr')
    expect(en.workout('kniebeuge', 4)).toBe('Do four squats!')
    expect(fr.workout('hampelmann', 6)).toBe('Fais six sauts en étoile!')
    for (const m of MOVES) for (const lang of ['en', 'fr'] as const) expect(coachWords(lang).workout(m.id, 3)).toMatch(/!$/)
    expect(Array.from({ length: 10 }, (_, i) => en.number(i + 1))).toEqual(['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'])
    expect(Array.from({ length: 10 }, (_, i) => fr.number(i + 1))).toEqual(['un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'])
  })

  it('"Simon says" and "Jacques a dit", and the commands without it', () => {
    expect(coachWords('en').simon('leftUp', true)).toBe('Simon says: raise your left arm!')
    expect(coachWords('fr').simon('leftUp', true)).toBe('Jacques a dit: lève le bras gauche!')
    expect(coachWords('en').simon('clap', false)).toBe('Clap your hands!')
    expect(coachWords('fr').simon('rightUp', false)).toBe('Lève le bras droit!')
    expect(coachWords('en').trap).toBe("Simon didn't say so!")
    expect(coachWords('fr').trap).toBe("Jacques n'a pas dit!")
    expect(SIMON_MOVES).not.toContain('wave')
  })

  it('never puts a French letter into English', () => {
    const en = coachWords('en')
    const all = [
      ...POSES.flatMap(p => [en.poseTitle(p.id), en.poseSay(p.id)]),
      ...MOVES.map(m => en.workout(m.id, 5)),
      ...SIMON_MOVES.flatMap(m => [en.simon(m, true), en.simon(m, false)]),
      en.trap, en.great, en.done,
    ]
    for (const line of all) expect(line).not.toMatch(FRENCH)
  })

  it('the stretch move says what is counted, and the star asks for wide legs', () => {
    expect(coachWords('en').workout('strecken', 5)).toBe('Do five knee touches: arms up, then hands to your knees!')
    expect(coachWords('fr').workout('strecken', 5)).toBe('Fais cinq fois: bras en haut, puis mains aux genoux!')
    expect(coachWords('en').poseSay('stern')).toContain('wide apart')
    expect(coachWords('fr').poseSay('riese')).toContain('Joins les pieds')
  })
})
