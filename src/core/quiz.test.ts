import { describe, expect, it } from 'vitest'
import { createQuiz } from './quiz'

describe('createQuiz', () => {
  it('goes through the questions; a wrong answer fades and the question stays', () => {
    const quiz = createQuiz([{ answer: 1, choices: 3 }, { answer: 0, choices: 3 }])
    expect(quiz.state).toMatchObject({ index: 0, wrong: [], solved: 0, done: false })
    expect(quiz.answer(2)).toBe('wrong')
    expect(quiz.state.wrong).toEqual([2])
    expect(quiz.answer(2)).toBe('ignored')
    expect(quiz.answer(1)).toBe('right')
    expect(quiz.state).toMatchObject({ index: 0, solved: 1 })
    // Nothing more until the next question
    expect(quiz.answer(0)).toBe('ignored')
    quiz.next()
    expect(quiz.state).toMatchObject({ index: 1, wrong: [], solved: 1 })
    expect(quiz.answer(0)).toBe('right')
    expect(quiz.state.done).toBe(true)
    quiz.next()
    expect(quiz.state.index).toBe(1)
  })

  it('ignores answers that are not choices', () => {
    const quiz = createQuiz([{ answer: 0, choices: 2 }])
    expect(quiz.answer(-1)).toBe('ignored')
    expect(quiz.answer(2)).toBe('ignored')
    expect(quiz.answer(0.5)).toBe('ignored')
  })
})
