import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { mapPicture } from '@/city/mapPicture'
import TownMap from './TownMap.vue'

const picture = mapPicture([
  { id: 'school', icon: '🔢', name: 'Schule', door: { x: 3.5, z: -13, side: 'right' }, state: 'open' },
  { id: 'arcade', icon: '🃏', name: 'Spielhalle', door: { x: -3.5, z: -13, side: 'left' }, state: 'locked' },
])
const mountMap = () => mount(TownMap, { props: { picture, her: { x: 0, z: 5 }, color: '#e91e63' }, attachTo: document.body })

describe('TownMap', () => {
  it('emits choose with the marker tapped', async () => {
    const w = mountMap()
    await w.find('[data-test="map-marker-school"]').trigger('pointerdown')
    await w.find('[data-test="map-marker-wald"]').trigger('pointerdown')
    const chosen = w.emitted('choose')!.map(([m]) => (m as { id: string }).id)
    expect(chosen).toEqual(['school', 'wald'])
    expect(w.emitted('close')).toBeUndefined()
    w.unmount()
  })

  it('shows a closed building with the lock', () => {
    const w = mountMap()
    const arcade = w.find('[data-test="map-marker-arcade"]')
    expect(arcade.attributes('data-state')).toBe('locked')
    expect(arcade.text()).toContain('🔒')
    expect(w.find('[data-test="map-marker-school"]').text()).not.toContain('🔒')
    w.unmount()
  })

  it('shows a building she lacks the stars for with a star, not the lock: she has done her learning', () => {
    const poor = mapPicture([{ id: 'arcade', icon: '🃏', name: 'Spielhalle', door: { x: -3.5, z: -13, side: 'left' }, state: 'poor', cost: 3 }])
    const w = mount(TownMap, { props: { picture: poor, her: { x: 0, z: 5 }, color: '#e91e63' }, attachTo: document.body })
    const arcade = w.find('[data-test="map-marker-arcade"]')
    expect(arcade.attributes('data-state')).toBe('poor')
    // The price as one star for each Star it costs (no digits: she can't read them yet), and taps on the stars go to
    // the picture under them, never to this marker
    const price = arcade.find('.price')
    expect(price.text()).toBe('⭐⭐⭐')
    expect(arcade.find('.closed-sign').exists()).toBe(false)
    expect(arcade.text()).not.toContain('🔒')
    w.unmount()
  })

  it('shows her in her colour', () => {
    const w = mountMap()
    expect(w.find('[data-test="map-her"]').attributes('style')).toContain('background: rgb(233, 30, 99)')
    w.unmount()
  })

  it('closes on a tap outside the picture, on ✕ and on Escape, but not on the picture itself', async () => {
    const w = mountMap()
    await w.find('[data-test="map-picture"]').trigger('pointerdown')
    expect(w.emitted('close')).toBeUndefined()
    await w.find('[data-test="map"]').trigger('pointerdown')
    await w.find('[data-test="map-close"]').trigger('pointerdown')
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', key: 'Escape' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX', key: 'x' }))
    expect(w.emitted('close')).toHaveLength(3)
    w.unmount()
  })

  it('has no text but pictures, and a name for every button', () => {
    const w = mountMap()
    expect(w.text()).not.toMatch(/[\p{L}\p{N}]/u)
    for (const b of w.findAll('button')) expect(b.attributes('aria-label')).toBeTruthy()
    w.unmount()
  })

  it('shows a building that opens later with "Bald"', () => {
    const soon = mapPicture([{ id: 'reimhaus', icon: '👂', name: 'Reimhaus', door: { x: 35.5, z: -16, side: 'right' }, state: 'soon' }])
    const w = mount(TownMap, { props: { picture: soon, her: { x: 0, z: 5 }, color: '#e91e63' }, attachTo: document.body })
    const marker = w.find('[data-test="map-marker-reimhaus"]')
    expect(marker.attributes('data-state')).toBe('soon')
    expect(marker.find('.soon-sign').text()).toBe('Bald')
    w.unmount()
  })
})
