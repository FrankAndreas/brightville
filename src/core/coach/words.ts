import type { MoveId } from '@/core/moves/reps'
import type { PoseId } from '@/core/pose/poses'
import type { Lang } from '@/core/vocab/types'

// What the Oberstufe's movement coach says, in English and French (docs/superpowers/specs/2026-11-22-brightville-
// oberstufe-coach-design.md): poses described by the body (never an animal), a counted workout, and "Simon says" /
// "Jacques a dit". First drafts, plain A2. The camera setup lines stay the buildings' German ones.

/** The arm moves "Simon says" asks for: the dance moves the camera tells apart, without waving (it looks like one arm up) */
export type SimonMove = 'bothUp' | 'armsOut' | 'hips' | 'head' | 'clap' | 'leftUp' | 'rightUp'
export const SIMON_MOVES: SimonMove[] = ['bothUp', 'armsOut', 'hips', 'head', 'clap', 'leftUp', 'rightUp']

/** Shown in German under the first instruction of a visit */
export const COACH_HINT = 'Mach, was der Coach sagt'

export interface CoachWords {
  poseTitle(id: PoseId): string
  /** How to stand, in words */
  poseSay(id: PoseId): string
  /** "Do four squats!" */
  workout(move: MoveId, n: number): string
  /** 1..10 in words, for counting along */
  number(n: number): string
  /** A command, with "Simon says" / "Jacques a dit" when `said` */
  simon(move: SimonMove, said: boolean): string
  /** He did a command that wasn't said */
  trap: string
  great: string
  /** The end of a visit */
  done: string
}

interface Table {
  poses: Record<PoseId, { title: string; say: string }>
  moves: Record<MoveId, string>
  numbers: string[]
  doThem: (n: string, move: string) => string
  simon: Record<SimonMove, string>
  says: string
  trap: string
  great: string
  done: string
}

const EN: Table = {
  poses: {
    stern: { title: 'Star', say: 'Stand with your legs apart. Stretch your arms out to the sides.' },
    riese: { title: 'Reach up', say: 'Stand with your feet together. Stretch both arms high above your head.' },
    baum: { title: 'Tree', say: 'Stand on one leg. Put your hands together above your head.' },
    frosch: { title: 'Deep squat', say: 'Squat down low. Put your hands on the floor between your knees.' },
    flieger: { title: 'Side lean', say: 'Stretch your arms out wide and lean to one side.' },
  },
  moves: { hampelmann: 'jumping jacks', huepfen: 'jumps', kniebeuge: 'squats', strecken: 'reach-ups' },
  numbers: ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'],
  doThem: (n, move) => `Do ${n} ${move}!`,
  simon: {
    bothUp: 'raise both arms', armsOut: 'stretch your arms out to the sides', hips: 'put your hands on your hips',
    head: 'put your hands on your head', clap: 'clap your hands', leftUp: 'raise your left arm', rightUp: 'raise your right arm',
  },
  says: 'Simon says',
  trap: "Simon didn't say so!",
  great: 'Great!',
  done: "Well done! That's it for today.",
}

const FR: Table = {
  poses: {
    stern: { title: "L'étoile", say: 'Écarte les jambes. Tends les bras sur les côtés.' },
    riese: { title: 'Bien haut', say: 'Mets les pieds ensemble. Tends les deux bras bien haut au-dessus de la tête.' },
    baum: { title: "L'arbre", say: 'Tiens-toi sur une jambe. Joins les mains au-dessus de la tête.' },
    frosch: { title: 'Accroupi', say: 'Accroupis-toi. Pose les mains par terre entre les genoux.' },
    flieger: { title: 'Penché', say: 'Tends les bras bien écartés et penche-toi sur le côté.' },
  },
  moves: { hampelmann: 'sauts en étoile', huepfen: 'sauts sur place', kniebeuge: 'flexions', strecken: 'étirements' },
  numbers: ['un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'],
  doThem: (n, move) => `Fais ${n} ${move}!`,
  simon: {
    bothUp: 'lève les deux bras', armsOut: 'tends les bras sur les côtés', hips: 'mets les mains sur les hanches',
    head: 'mets les mains sur la tête', clap: 'tape dans tes mains', leftUp: 'lève le bras gauche', rightUp: 'lève le bras droit',
  },
  says: 'Jacques a dit',
  trap: "Jacques n'a pas dit!",
  great: 'Super!',
  done: "Bravo! C'est fini pour aujourd'hui.",
}

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function wordsOf(t: Table): CoachWords {
  return {
    poseTitle: id => t.poses[id].title,
    poseSay: id => t.poses[id].say,
    workout: (move, n) => t.doThem(t.numbers[n - 1], t.moves[move]),
    number: n => t.numbers[n - 1] ?? String(n),
    simon: (move, said) => (said ? `${t.says}: ${t.simon[move]}!` : `${capital(t.simon[move])}!`),
    trap: t.trap,
    great: t.great,
    done: t.done,
  }
}

const BY_LANG: Record<Lang, CoachWords> = { en: wordsOf(EN), fr: wordsOf(FR) }

/** The coach's words in a language */
export function coachWords(lang: Lang): CoachWords {
  return BY_LANG[lang]
}
