import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SunSky from './SunSky.vue'

describe('the little skies', () => {
  it('tell morning from evening by more than the colour: rays and a bird rising, a half-set sun and a first star', () => {
    const morning = mount(SunSky, { props: { time: 'morgen' } })
    const evening = mount(SunSky, { props: { time: 'abend' } })
    expect(morning.find('[data-test="rays"]').exists()).toBe(true)
    expect(morning.find('[data-test="bird"]').exists()).toBe(true)
    expect(evening.find('[data-test="rays"]').exists()).toBe(false)
    expect(evening.find('[data-test="star"]').exists()).toBe(true)
    // The evening sun sits half under the ground
    expect(Number(evening.find('[data-test="sun"]').attributes('cy'))).toBeGreaterThanOrEqual(76)
  })
})
