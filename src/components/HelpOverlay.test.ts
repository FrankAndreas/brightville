import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { speak } from '@/services/tts'
import HelpOverlay from './HelpOverlay.vue'

vi.mock('@/services/tts', async () => {
  const { ref } = await import('vue')
  const speak = vi.fn<(text?: string) => Promise<void>>(() => Promise.resolve())
  // An instruction is spoken like anything else, and kept for the 🔊 button
  const instruction = ref<string | null>(null)
  const instruct = vi.fn((text: string) => { instruction.value = text; return speak(text) })
  return { speak, stopSpeaking: vi.fn(), instruct, instruction, forgetInstruction: vi.fn(() => { instruction.value = null }) }
})

describe('HelpOverlay', () => {
  beforeEach(() => vi.mocked(speak).mockClear())

  it('explains the keys by default', () => {
    const w = mount(HelpOverlay)
    expect(w.findAll('[data-test="help-row"]')).toHaveLength(5)
    expect(w.findAll('[data-test="help-keys"]')).toHaveLength(5)
    expect(w.findAll('[data-test="help-touch"]')).toHaveLength(0)
    expect(speak).toHaveBeenCalledWith('Mit den Pfeiltasten läufst du.')
    expect(w.text()).toContain('J')
    w.unmount()
  })

  it('says one line at a time, lighting up its picture, and stops when closed', async () => {
    vi.useFakeTimers()
    try {
      const w = mount(HelpOverlay, { props: { touch: true } })
      const lit = () => w.findAll('[data-test="help-row"]').map(r => r.attributes('data-active'))
      await flushPromises()
      expect(speak).toHaveBeenCalledTimes(1)
      expect(lit()).toEqual(['true', 'false', 'false', 'false', 'false'])
      await vi.advanceTimersByTimeAsync(500)
      expect(vi.mocked(speak).mock.calls.map(c => c[0])).toEqual([
        'Zieh mit dem Finger, dann läufst du.', 'Tipp auf den Pfeil, dann springst du.',
      ])
      expect(lit()).toEqual(['false', 'true', 'false', 'false', 'false'])
      expect(w.findAll('[data-test="help-row"]')[0].attributes('data-dim')).toBe('true')
      w.unmount()
      await vi.advanceTimersByTimeAsync(5000)
      expect(speak).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('explains the fingers on a touch screen, with no key in sight', () => {
    const w = mount(HelpOverlay, { props: { touch: true } })
    expect(w.findAll('[data-test="help-row"]')).toHaveLength(5)
    expect(w.findAll('[data-test="help-touch"]')).toHaveLength(5)
    expect(w.findAll('[data-test="help-keys"]')).toHaveLength(0)
    expect(speak).toHaveBeenCalledWith('Zieh mit dem Finger, dann läufst du.')
    expect(w.text()).not.toContain('Esc')
    w.unmount()
  })
})
