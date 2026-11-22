import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { Body } from '@/core/pose/body'
import { standing } from '@/core/pose/fixtures'
import { ARMS_UP, CLAP } from '@/core/moves/fixtures'
import { HOLD_MS, REACT_MS } from '@/core/coach/simon'
import { closeCamera, onCameraLost, openCamera } from '@/services/camera'
import { createPoseTracker } from '@/services/poseTracker'
import { playBeat } from '@/services/sound'
import { speak } from '@/services/tts'
import { requestLeave } from '../leave'
import CoachSimon from './CoachSimon.vue'
import SimonSays from './SimonSays.vue'

vi.mock('@/services/camera', async importOriginal => ({
  CameraError: (await importOriginal<typeof import('@/services/camera')>()).CameraError,
  openCamera: vi.fn(), closeCamera: vi.fn(), onCameraLost: vi.fn(),
}))
vi.mock('@/services/poseTracker', () => ({ createPoseTracker: vi.fn() }))
vi.mock('@/services/sound', () => ({ playBeat: vi.fn(), playNote: vi.fn(), unlockAudio: vi.fn() }))
vi.mock('@/services/tts', async () => {
  const { ref } = await import('vue')
  const speak = vi.fn<(text?: string, lang?: string) => Promise<void>>(() => Promise.resolve())
  const instruction = ref<string | null>(null)
  const instruct = vi.fn((text: string) => { instruction.value = text; return speak(text) })
  return {
    speak, stopSpeaking: vi.fn(), instruct, instruction, forgetInstruction: vi.fn(() => { instruction.value = null }),
    hasVoice: vi.fn(() => true), voiceCount: ref(1),
  }
})

const stream = { id: 'fake-stream' } as unknown as MediaStream
let seen: Body | null
const tracker = { detect: vi.fn(() => seen), close: vi.fn() }
const run = (ms: number) => vi.advanceTimersByTimeAsync(ms)
const COMMANDS = [{ move: 'bothUp' as const, said: true }, { move: 'clap' as const, said: false }, { move: 'clap' as const, said: true }]

async function open(lang: 'en' | 'fr' = 'fr'): Promise<VueWrapper> {
  const w = mount(SimonSays, { props: { lang, commands: COMMANDS }, attachTo: document.body })
  await run(50)
  seen = standing()
  await run(1300)
  return w
}

describe('Simon says at Oberstufe', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    seen = null
    vi.mocked(speak).mockClear()
    vi.mocked(playBeat).mockClear()
    vi.mocked(closeCamera).mockClear()
    vi.mocked(openCamera).mockReset().mockResolvedValue(stream)
    vi.mocked(createPoseTracker).mockReset().mockResolvedValue(tracker)
    vi.mocked(onCameraLost).mockReset()
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('writes and speaks the command in French, with no dancer', async () => {
    const w = await open('fr')
    expect(w.find('[data-test="coach-say"]').text()).toContain('Jacques a dit: lève les deux bras!')
    expect(vi.mocked(speak).mock.calls.at(-1)).toEqual(['Jacques a dit: lève les deux bras!', 'fr-FR'])
    expect(w.findAll('[data-test="point"]')).toHaveLength(3)
    expect(w.find('[data-test="dancer"]').exists()).toBe(false)
    w.unmount()
  })

  it('a said command done is a point; a trap followed gets the trap line', async () => {
    const w = await open('en')
    seen = ARMS_UP
    await run(HOLD_MS + 300)
    expect(w.findAll('[data-test="point"][data-state="hit"]')).toHaveLength(1)
    seen = standing()
    await run(1000)
    expect(w.find('[data-test="coach-say"]').text()).toContain('Clap your hands!')
    seen = CLAP
    await run(1200)
    expect((vi.mocked(speak).mock.calls as unknown as [string, string][]).map(c => c[0])).toContain("Simon didn't say so!")
    expect(w.findAll('[data-test="point"][data-state="miss"]')).toHaveLength(1)
    w.unmount()
  })

  it('leaving keeps the points so far', async () => {
    const w = await open('en')
    seen = ARMS_UP
    await run(HOLD_MS + 300)
    requestLeave()
    await run(10)
    expect(w.emitted('finished')).toEqual([[{ stars: 4 }]])
    w.unmount()
  })

  it('the Oberstufe Tanzsaal asks for the language first', async () => {
    const w = mount(CoachSimon, { attachTo: document.body })
    expect(w.find('[data-test="lang-en"]').exists()).toBe(true)
    await w.find('[data-test="lang-en"]').trigger('click')
    expect(w.find('[data-test="simon"]').exists()).toBe(true)
    w.unmount()
  })

  it('without a command done in time: a miss, then the next', async () => {
    const w = await open('en')
    await run(REACT_MS + 1200)
    expect(w.findAll('[data-test="point"][data-state="miss"]')).toHaveLength(1)
    w.unmount()
  })
})
