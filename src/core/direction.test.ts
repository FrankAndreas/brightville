import { describe, it, expect } from 'vitest'
import { DIRS, isOpposite, keyToDirection, swipeDirection } from './direction'

describe('DIRS', () => {
  it('points up with negative y', () => {
    expect(DIRS.up).toEqual({ x: 0, y: -1 })
    expect(DIRS.right).toEqual({ x: 1, y: 0 })
  })
})

describe('keyToDirection', () => {
  it('maps arrow keys and WASD', () => {
    expect(keyToDirection('ArrowLeft')).toBe('left')
    expect(keyToDirection('w')).toBe('up')
    expect(keyToDirection('D')).toBe('right')
    expect(keyToDirection('s')).toBe('down')
  })

  it('ignores other keys', () => {
    expect(keyToDirection('Enter')).toBeNull()
  })
})

describe('isOpposite', () => {
  it('detects opposites', () => {
    expect(isOpposite('up', 'down')).toBe(true)
    expect(isOpposite('left', 'right')).toBe(true)
    expect(isOpposite('up', 'left')).toBe(false)
    expect(isOpposite('up', 'up')).toBe(false)
  })
})

describe('swipeDirection', () => {
  it('picks the dominant swipe axis', () => {
    expect(swipeDirection(60, 10)).toBe('right')
    expect(swipeDirection(-5, -40)).toBe('up')
    expect(swipeDirection(-50, 20)).toBe('left')
    expect(swipeDirection(3, 30)).toBe('down')
  })

  it('ignores small finger movements', () => {
    expect(swipeDirection(10, -12)).toBeNull()
  })
})
