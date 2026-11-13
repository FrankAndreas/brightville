import { describe, expect, it } from 'vitest'
import { MIN_MARKS, MIN_VISIT_MS, createEffort } from './effort'

describe('effort', () => {
  it('counts a visit only with enough marks and enough time', () => {
    let t = 1000
    const effort = createEffort(() => t)
    for (let i = 0; i < MIN_MARKS - 1; i++) effort.mark()
    t += MIN_VISIT_MS
    expect(effort.counts()).toBe(false)
    effort.mark()
    expect(effort.counts()).toBe(true)
  })

  it('does not count many quick marks', () => {
    let t = 0
    const effort = createEffort(() => t)
    for (let i = 0; i < 50; i++) effort.mark()
    t = MIN_VISIT_MS - 1
    expect(effort.counts()).toBe(false)
  })
})
