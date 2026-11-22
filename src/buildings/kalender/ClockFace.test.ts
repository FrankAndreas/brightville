import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ClockFace from './ClockFace.vue'

describe('the clock face', () => {
  it('draws the numbers over the hands, so a hand on the 12 never hides it', () => {
    const w = mount(ClockFace, { props: { clock: { hour: 3, half: false } } })
    const parts = [...w.element.children].map(e => e.tagName)
    expect(parts.lastIndexOf('line')).toBeLessThan(parts.indexOf('text'))
  })

  const hands = (w: ReturnType<typeof mount>) => w.findAll('line').map(l => l.attributes('transform'))

  it('shows minutes in five-minute steps when given (the Oberstufe)', () => {
    const w = mount(ClockFace, { props: { clock: { hour: 8, half: false }, minute: 40 } })
    expect(hands(w)).toEqual(['rotate(240 50 50)', 'rotate(260 50 50)'])
    expect(w.find('[data-test="clock-face"]').attributes('data-time')).toBe('8:40')
  })

  it('without minutes stays the Kindergarten clock: full and half hours', () => {
    const w = mount(ClockFace, { props: { clock: { hour: 8, half: true } } })
    expect(hands(w)).toEqual(['rotate(180 50 50)', 'rotate(255 50 50)'])
    expect(w.find('[data-test="clock-face"]').attributes('data-time')).toBe('8:30')
  })
})
