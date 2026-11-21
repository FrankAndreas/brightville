import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ProgressStars from './ProgressStars.vue'

describe('the progress stars of a learning building', () => {
  it('shows a star per task, the solved ones filled', () => {
    const w = mount(ProgressStars, { props: { total: 5, solved: 2 } })
    const stars = w.findAll('[data-test="progress-star"]')
    expect(stars).toHaveLength(5)
    expect(stars.map(s => s.attributes('data-done'))).toEqual(['true', 'true', 'false', 'false', 'false'])
  })

  it('is a small row at the top while the visit goes on, and large in the middle when asked (the visit is over)', () => {
    expect(mount(ProgressStars, { props: { total: 5, solved: 2 } }).find('.progress').attributes('data-big')).toBe('false')
    const big = mount(ProgressStars, { props: { total: 5, solved: 5, big: true } })
    expect(big.find('.progress').attributes('data-big')).toBe('true')
    expect(big.find('svg').attributes('style')).toContain('width: 96px')
  })
})
