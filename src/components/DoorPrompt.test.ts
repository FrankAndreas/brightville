import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DoorPrompt from './DoorPrompt.vue'

const open = (props: Record<string, unknown>) => mount(DoorPrompt, { props: { icon: '🧘', state: 'open', ...props } })

describe('DoorPrompt', () => {
  const send = (w: ReturnType<typeof open>, type: string, pointerId = 1, clientX = 100, clientY = 100) =>
    w.element.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId, clientX, clientY }))

  it('asks to go in when an open door is tapped', () => {
    const w = open({})
    send(w, 'pointerdown')
    expect(w.emitted('enter')).toBeUndefined()
    send(w, 'pointerup', 1, 104, 97)
    expect(w.emitted('enter')).toHaveLength(1)
  })

  it('does not take a finger that only lands on it and drags on', () => {
    const w = open({})
    send(w, 'pointerdown')
    send(w, 'pointerup', 1, 160, 100)
    expect(w.emitted('enter')).toBeUndefined()
  })

  it('does not take a finger that came from elsewhere, or another finger lifting', () => {
    const w = open({})
    send(w, 'pointerup')
    send(w, 'pointerdown', 1)
    send(w, 'pointerup', 2)
    expect(w.emitted('enter')).toBeUndefined()
  })

  it('forgets a press that was cancelled', () => {
    const w = open({})
    send(w, 'pointerdown')
    send(w, 'pointercancel')
    send(w, 'pointerup')
    expect(w.emitted('enter')).toBeUndefined()
  })

  it.each(['locked', 'poor', 'unavailable'])('does not when the door is %s', state => {
    const w = open({ state, cost: 3, goal: 2, visits: 0 })
    send(w, 'pointerdown')
    send(w, 'pointerup')
    expect(w.emitted('enter')).toBeUndefined()
  })

  it('sits clear of the stick and the jump button on a touch screen', () => {
    expect(open({ touch: true }).attributes('data-place')).toBe('top')
    expect(open({}).attributes('data-place')).toBe('bottom')
  })

  it('shows the Enter key, or a tapping finger on a touch screen', () => {
    expect(open({}).find('[data-test="key"]').exists()).toBe(true)
    expect(open({}).find('[data-test="tap"]').exists()).toBe(false)
    const touch = open({ touch: true })
    expect(touch.find('[data-test="key"]').exists()).toBe(false)
    expect(touch.find('[data-test="tap"]').exists()).toBe(true)
  })
})
