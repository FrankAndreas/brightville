import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DoorPrompt from './DoorPrompt.vue'

const open = (props: Record<string, unknown>) => mount(DoorPrompt, { props: { icon: '🧘', state: 'open', ...props } })

describe('DoorPrompt', () => {
  it('asks to go in when an open door is tapped', async () => {
    const w = open({})
    await w.trigger('pointerdown')
    expect(w.emitted('enter')).toHaveLength(1)
  })

  it.each(['locked', 'poor', 'unavailable'])('does not when the door is %s', async state => {
    const w = open({ state, cost: 3, goal: 2, visits: 0 })
    await w.trigger('pointerdown')
    expect(w.emitted('enter')).toBeUndefined()
  })

  it('shows the Enter key, or a tapping finger on a touch screen', () => {
    expect(open({}).find('[data-test="key"]').exists()).toBe(true)
    expect(open({}).find('[data-test="tap"]').exists()).toBe(false)
    const touch = open({ touch: true })
    expect(touch.find('[data-test="key"]').exists()).toBe(false)
    expect(touch.find('[data-test="tap"]').exists()).toBe(true)
  })
})
