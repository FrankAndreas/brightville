import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { forgetInstruction, instruct } from '@/services/tts'
import SayAgain from './SayAgain.vue'

describe('the button to hear it again', () => {
  const said: string[] = []
  afterEach(() => {
    forgetInstruction()
    said.length = 0
    vi.unstubAllGlobals()
  })

  function listen() {
    vi.stubGlobal('speechSynthesis', { cancel: vi.fn(), speak: (u: { text: string }) => said.push(u.text) })
    vi.stubGlobal('SpeechSynthesisUtterance', class { lang = ''; onend = null; onerror = null; constructor(public text: string) {} })
  }

  it('is shown only while the building has an instruction', async () => {
    const w = mount(SayAgain)
    expect(w.find('[data-test="say-again"]').exists()).toBe(false)
    listen()
    void instruct('Wie viele Äpfel?')
    await w.vm.$nextTick()
    expect(w.find('[data-test="say-again"]').exists()).toBe(true)
    forgetInstruction()
    await w.vm.$nextTick()
    expect(w.find('[data-test="say-again"]').exists()).toBe(false)
    w.unmount()
  })

  it('says the latest instruction again', async () => {
    listen()
    const w = mount(SayAgain)
    void instruct('Wie viele Äpfel?')
    void instruct('Wie viele Punkte?')
    await w.vm.$nextTick()
    await w.find('[data-test="say-again"]').trigger('click')
    expect(said).toEqual(['Wie viele Äpfel?', 'Wie viele Punkte?', 'Wie viele Punkte?'])
    w.unmount()
  })
})
