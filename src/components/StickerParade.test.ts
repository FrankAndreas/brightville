import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { speak } from '@/services/tts'
import StickerParade from './StickerParade.vue'

vi.mock('@/services/tts', () => ({ speak: vi.fn(() => Promise.resolve()), stopSpeaking: vi.fn() }))
vi.mock('@/services/sound', () => ({ playBeat: vi.fn() }))

describe('the sticker parade', () => {
  afterEach(() => vi.mocked(speak).mockClear())

  it('shows the gift that comes with a sticker, and says it', () => {
    const w = mount(StickerParade, { props: { ids: ['sternensammler'] } })
    expect(w.find('[data-test="parade-gift"]').text()).toBe('✨')
    expect(speak).toHaveBeenCalledWith('Ein neuer Sticker: Sternensammler! Und dazu: Glitzer-Stirnband!')
    w.unmount()
  })

  it('shows no gift for a sticker without one', () => {
    const w = mount(StickerParade, { props: { ids: ['rechenprofi'] } })
    expect(w.find('[data-test="parade-gift"]').exists()).toBe(false)
    expect(speak).toHaveBeenCalledWith('Ein neuer Sticker: Rechenprofi!')
    w.unmount()
  })
})
