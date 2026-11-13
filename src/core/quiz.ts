// A row of questions answered by picking one of a few choices, as in the School: a wrong pick fades
// and the question stays until it is right. Shared by the Bibliothek and the Farblabor.

export interface QuizQuestion {
  /** Which choice is right */
  answer: number
  /** How many choices there are */
  choices: number
}

export interface QuizState {
  index: number
  /** Choices of this question already tried and wrong */
  wrong: number[]
  /** Questions answered right so far */
  solved: number
  /** This question is answered; waiting for next() */
  answered: boolean
  done: boolean
}

export interface Quiz {
  readonly state: QuizState
  answer(choice: number): 'right' | 'wrong' | 'ignored'
  /** On to the next question, once this one is answered */
  next(): void
}

export function createQuiz(questions: QuizQuestion[]): Quiz {
  const state: QuizState = { index: 0, wrong: [], solved: 0, answered: false, done: questions.length === 0 }
  return {
    state,
    answer(choice) {
      const q = questions[state.index]
      if (!q || state.answered || state.done) return 'ignored'
      if (!Number.isInteger(choice) || choice < 0 || choice >= q.choices || state.wrong.includes(choice)) return 'ignored'
      if (choice !== q.answer) {
        state.wrong = [...state.wrong, choice]
        return 'wrong'
      }
      state.answered = true
      state.solved += 1
      if (state.index === questions.length - 1) state.done = true
      return 'right'
    },
    next() {
      if (!state.answered || state.done) return
      state.index += 1
      state.wrong = []
      state.answered = false
    },
  }
}
