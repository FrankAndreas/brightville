import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import ParentGate from './ParentGate.vue'

const gear = (w: VueWrapper) => w.find('[data-test="parents-button"]')
const question = (w: VueWrapper) => w.find('[data-test="parents-question"]')

async function answer(w: VueWrapper, value: string) {
  await w.find('[data-test="parents-answer"]').setValue(value)
  await w.find('form').trigger('submit')
}

function product(w: VueWrapper): number {
  return Number(question(w).attributes('data-a')) * Number(question(w).attributes('data-b'))
}

describe('the parents\' gate', () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }))
  afterEach(() => vi.useRealTimers())

  it('asks its question only after the gear was held for three seconds', async () => {
    const w = mount(ParentGate)
    await gear(w).trigger('pointerdown')
    await vi.advanceTimersByTimeAsync(2900)
    expect(question(w).exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(100)
    expect(question(w).exists()).toBe(true)
    w.unmount()
  })

  it('asks nothing when the gear is let go too soon, and says so in small print', async () => {
    const w = mount(ParentGate)
    await gear(w).trigger('pointerdown')
    await vi.advanceTimersByTimeAsync(1000)
    await gear(w).trigger('pointerup')
    expect(w.find('[data-test="parents-hint"]').exists()).toBe(true)
    await vi.advanceTimersByTimeAsync(5000)
    expect(question(w).exists()).toBe(false)
    expect(w.find('[data-test="parents-hint"]').exists()).toBe(false)
    w.unmount()
  })

  it('opens with the right answer only', async () => {
    const w = mount(ParentGate)
    await gear(w).trigger('keydown', { key: 'Enter' })
    await answer(w, String(product(w) + 1))
    expect(question(w).exists()).toBe(false)
    expect(w.emitted('open')).toBeUndefined()

    await gear(w).trigger('keydown', { key: 'Enter' })
    await answer(w, ` ${product(w)} `)
    expect(w.emitted('open')).toHaveLength(1)
    w.unmount()
  })

  it('asks for the product of two numbers from six to nine', async () => {
    const w = mount(ParentGate)
    for (let i = 0; i < 20; i++) {
      await gear(w).trigger('keydown', { key: 'Enter' })
      for (const side of ['data-a', 'data-b']) {
        const n = Number(question(w).attributes(side))
        expect(n).toBeGreaterThanOrEqual(6)
        expect(n).toBeLessThanOrEqual(9)
      }
      await w.find('[data-test="parents-cancel"]').trigger('click')
    }
    w.unmount()
  })
})
