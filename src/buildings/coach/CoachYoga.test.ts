import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { requestLeave } from '../leave'
import CoachYoga from './CoachYoga.vue'

vi.mock('@/services/camera', () => ({ openCamera: vi.fn(() => new Promise(() => {})), closeCamera: vi.fn(), onCameraLost: vi.fn() }))
vi.mock('@/services/poseTracker', () => ({ createPoseTracker: vi.fn() }))

describe('Yoga at Oberstufe', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => { document.body.innerHTML = '' })

  it('asks for the language first, then opens the studio in it', async () => {
    const w = mount(CoachYoga, { attachTo: document.body })
    expect(w.find('[data-test="lang-en"]').exists()).toBe(true)
    await w.find('[data-test="lang-fr"]').trigger('click')
    expect(w.find('.studio').exists()).toBe(true)
    w.unmount()
  })

  it('leaving on the language screen gives no Stars', () => {
    const w = mount(CoachYoga, { attachTo: document.body })
    requestLeave()
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
    w.unmount()
  })
})
