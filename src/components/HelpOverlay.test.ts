import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { speak } from '@/services/tts'
import HelpOverlay from './HelpOverlay.vue'

vi.mock('@/services/tts', () => ({ speak: vi.fn(() => Promise.resolve()), stopSpeaking: vi.fn() }))

describe('HelpOverlay', () => {
  beforeEach(() => vi.mocked(speak).mockClear())

  it('explains the keys by default', () => {
    const w = mount(HelpOverlay)
    expect(w.findAll('[data-test="help-row"]')).toHaveLength(4)
    expect(w.findAll('[data-test="help-keys"]')).toHaveLength(4)
    expect(w.findAll('[data-test="help-touch"]')).toHaveLength(0)
    expect(vi.mocked(speak).mock.calls[0][0]).toContain('Pfeiltasten')
    w.unmount()
  })

  it('explains the fingers on a touch screen, with no key in sight', () => {
    const w = mount(HelpOverlay, { props: { touch: true } })
    expect(w.findAll('[data-test="help-row"]')).toHaveLength(4)
    expect(w.findAll('[data-test="help-touch"]')).toHaveLength(4)
    expect(w.findAll('[data-test="help-keys"]')).toHaveLength(0)
    expect(speak).toHaveBeenCalledWith(
      'Zieh mit dem Finger, dann läufst du. Tipp auf den Pfeil, dann springst du. ' +
      'Tipp auf das Bild an der leuchtenden Tür, dann gehst du hinein. Mit der Tür oben links gehst du wieder hinaus.',
    )
    expect(w.text()).not.toContain('Esc')
    w.unmount()
  })
})
