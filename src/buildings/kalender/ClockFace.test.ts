import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ClockFace from './ClockFace.vue'

describe('the clock face', () => {
  it('draws the numbers over the hands, so a hand on the 12 never hides it', () => {
    const w = mount(ClockFace, { props: { clock: { hour: 3, half: false } } })
    const parts = [...w.element.children].map(e => e.tagName)
    expect(parts.lastIndexOf('line')).toBeLessThan(parts.indexOf('text'))
  })
})
