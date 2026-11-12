import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { nextTick } from 'vue'
import App from './App.vue'

const mountApp = () => mount(App, { global: { plugins: [createPinia()] } })

describe('App', () => {
  it('shows the start gate first and the game after a key press', async () => {
    const w = mountApp()
    expect(w.find('[data-test="start-gate"]').exists()).toBe(true)
    expect(w.find('[data-test="game"]').exists()).toBe(false)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    await nextTick()
    expect(w.find('[data-test="start-gate"]').exists()).toBe(false)
    expect(w.find('[data-test="game"]').exists()).toBe(true)
    w.unmount()
  })

  it('starts on a pointer press too', async () => {
    const w = mountApp()
    await w.find('[data-test="start-gate"]').trigger('pointerdown')
    expect(w.find('[data-test="game"]').exists()).toBe(true)
    w.unmount()
  })
})
