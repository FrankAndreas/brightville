import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { onLeaveRequest } from '@/buildings/leave'
import LeaveButton from './LeaveButton.vue'

describe('LeaveButton', () => {
  const leave = vi.fn()
  let off = () => {}
  beforeEach(() => {
    vi.useFakeTimers()
    leave.mockClear()
    off = onLeaveRequest(leave)
  })
  afterEach(() => {
    off()
    vi.useRealTimers()
  })
  const button = () => mount(LeaveButton).find('[data-test="leave"]')

  it('asks the open building to end on a tap', async () => {
    const b = button()
    await b.trigger('pointerdown', { pointerId: 1 })
    expect(leave).not.toHaveBeenCalled()
    vi.advanceTimersByTime(150)
    await b.trigger('pointerup', { pointerId: 1 })
    expect(leave).toHaveBeenCalledTimes(1)
  })

  it('ignores a hand that rests on it while writing', async () => {
    const b = button()
    await b.trigger('pointerdown', { pointerId: 1 })
    vi.advanceTimersByTime(900)
    await b.trigger('pointerup', { pointerId: 1 })
    expect(leave).not.toHaveBeenCalled()
  })

  it('ignores a finger that slid in from elsewhere, another finger, and a cancelled press', async () => {
    const b = button()
    await b.trigger('pointerup', { pointerId: 1 })
    await b.trigger('pointerdown', { pointerId: 1 })
    await b.trigger('pointerup', { pointerId: 2 })
    await b.trigger('pointerdown', { pointerId: 3 })
    await b.trigger('pointercancel', { pointerId: 3 })
    await b.trigger('pointerup', { pointerId: 3 })
    expect(leave).not.toHaveBeenCalled()
  })
})
