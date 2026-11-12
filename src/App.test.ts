import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { nextTick } from 'vue'
import App from './App.vue'
import { unlockAudio } from './services/sound'

vi.mock('./services/sound', () => ({ unlockAudio: vi.fn(), playBeat: vi.fn() }))

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

  it('shows the star count in the game', async () => {
    const w = mountApp()
    await w.find('[data-test="start-gate"]').trigger('pointerdown')
    expect(w.find('[data-test="stars"]').text()).toBe('0')
    w.unmount()
  })

  it('unlocks sound when the game starts', async () => {
    vi.mocked(unlockAudio).mockClear()
    const w = mountApp()
    expect(unlockAudio).not.toHaveBeenCalled()
    await w.find('[data-test="start-gate"]').trigger('pointerdown')
    expect(unlockAudio).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('starts on a pointer press too', async () => {
    const w = mountApp()
    await w.find('[data-test="start-gate"]').trigger('pointerdown')
    expect(w.find('[data-test="game"]').exists()).toBe(true)
    w.unmount()
  })
})
