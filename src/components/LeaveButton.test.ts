import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { onLeaveRequest } from '@/buildings/leave'
import LeaveButton from './LeaveButton.vue'

describe('LeaveButton', () => {
  it('asks the open building to end when pressed', async () => {
    const leave = vi.fn()
    const off = onLeaveRequest(leave)
    const w = mount(LeaveButton)
    await w.find('[data-test="leave"]').trigger('pointerdown')
    expect(leave).toHaveBeenCalledTimes(1)
    off()
  })
})
