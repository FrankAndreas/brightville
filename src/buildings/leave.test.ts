import { describe, expect, it, vi } from 'vitest'
import { onLeaveRequest, requestLeave } from './leave'

describe('leave', () => {
  it('does nothing when no building is open', () => {
    expect(() => requestLeave()).not.toThrow()
  })

  it('asks the open building to end', () => {
    const leave = vi.fn()
    const off = onLeaveRequest(leave)
    requestLeave()
    expect(leave).toHaveBeenCalledTimes(1)
    off()
  })

  it('stops asking once the building took its answer back', () => {
    const leave = vi.fn()
    onLeaveRequest(leave)()
    requestLeave()
    expect(leave).not.toHaveBeenCalled()
  })

  it('does not let an old building take away a newer one', () => {
    const first = vi.fn()
    const second = vi.fn()
    const offFirst = onLeaveRequest(first)
    const offSecond = onLeaveRequest(second)
    offFirst()
    requestLeave()
    expect(second).toHaveBeenCalledTimes(1)
    expect(first).not.toHaveBeenCalled()
    offSecond()
  })
})
