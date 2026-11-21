import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Component } from 'vue'
import Kalender from './kalender/Kalender.vue'
import Musterwerkstatt from './muster/Musterwerkstatt.vue'
import Reimhaus from './reimhaus/Reimhaus.vue'
import School from './school/School.vue'
import Trommelhaus from './trommelhaus/Trommelhaus.vue'

vi.mock('@/services/sound', () => ({ playBeat: vi.fn(), unlockAudio: vi.fn() }))
vi.mock('@/services/tts', async () => {
  const { ref } = await import('vue')
  return {
    speak: vi.fn(() => Promise.resolve()), stopSpeaking: vi.fn(), instruct: vi.fn(() => Promise.resolve()),
    instruction: ref(null), forgetInstruction: vi.fn(),
  }
})

// At the end of a learning visit the card is empty: the stars she earned show large in the middle instead
const BUILDINGS: [string, Component, Record<string, unknown>][] = [
  ['Reimhaus', Reimhaus, { example: null }],
  ['Musterwerkstatt', Musterwerkstatt, { example: null }],
  ['Kalender', Kalender, { example: null }],
  ['Trommelhaus', Trommelhaus, { example: false, micAvailable: false }],
  ['School', School, {}],
]

describe('the end of a learning visit', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it.each(BUILDINGS)('%s shows its stars large once the visit is over', async (_, building, props) => {
    const over = mount(building, { props: { tasks: [], ...props }, attachTo: document.body })
    await vi.advanceTimersByTimeAsync(10)
    expect(over.find('.progress').attributes('data-big')).toBe('true')
    over.unmount()
  })
})
