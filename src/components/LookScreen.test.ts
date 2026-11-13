import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { speak } from '@/services/tts'
import { BODY_COLORS, DEFAULT_LOOK, GLASSES, HAIR_COLORS, HAIR_STYLES } from '@/core/look'
import LookScreen from './LookScreen.vue'

vi.mock('@/city/preview', () => ({ createPreview: () => ({ setDress: vi.fn(), dispose: vi.fn() }) }))
vi.mock('@/services/tts', async () => {
  const { ref } = await import('vue')
  const speak = vi.fn<(text?: string) => Promise<void>>(() => Promise.resolve())
  const instruction = ref<string | null>(null)
  const instruct = vi.fn((text: string) => { instruction.value = text; return speak(text) })
  return { speak, stopSpeaking: vi.fn(), instruct, instruction, forgetInstruction: vi.fn(() => { instruction.value = null }) }
})

const open = () => mount(LookScreen, { props: { start: DEFAULT_LOOK } })

describe('the look screen', () => {
  it('offers every choice as a big picture button, four rows', () => {
    const w = open()
    expect(w.findAll('[data-test="look-body"]')).toHaveLength(BODY_COLORS.length)
    expect(w.findAll('[data-test="look-hair"]')).toHaveLength(HAIR_STYLES.length)
    expect(w.findAll('[data-test="look-hair-color"]')).toHaveLength(HAIR_COLORS.length)
    expect(w.findAll('[data-test="look-glasses"]')).toHaveLength(GLASSES.length)
    expect(w.find('[data-test="character"]').exists()).toBe(true)
    w.unmount()
  })

  it('says what to do, for the 🔊 button too', () => {
    const w = open()
    expect(speak).toHaveBeenCalledWith('So siehst du aus! Tipp auf die Farben und Haare, dann auf den Haken.')
    w.unmount()
  })

  it('takes what she tapped, and gives it back with the ✔️', async () => {
    const w = open()
    await w.findAll('[data-test="look-body"]')[2].trigger('click')
    await w.findAll('[data-test="look-hair"]')[3].trigger('click')
    await w.findAll('[data-test="look-glasses"]')[1].trigger('click')
    expect(w.findAll('[data-test="look-body"]')[2].attributes('data-chosen')).toBe('true')
    await w.find('[data-test="look-done"]').trigger('click')
    expect(w.emitted('done')).toEqual([[{ ...DEFAULT_LOOK, body: BODY_COLORS[2], hair: HAIR_STYLES[3], glasses: GLASSES[1] }]])
    w.unmount()
  })

  it('picks a look for her with the 🎲', async () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99)
    const w = open()
    await w.find('[data-test="look-random"]').trigger('click')
    await w.find('[data-test="look-done"]').trigger('click')
    expect(w.emitted('done')![0][0]).toEqual({ body: BODY_COLORS.at(-1), hair: HAIR_STYLES.at(-1), hairColor: HAIR_COLORS.at(-1), glasses: GLASSES.at(-1) })
    random.mockRestore()
    w.unmount()
  })
})
