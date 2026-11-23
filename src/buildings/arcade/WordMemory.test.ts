import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { fakeApi, type FakeApi } from '@/services/fakeApi'
import { speak } from '@/services/tts'
import { usePlayerStore } from '@/stores/player'
import { useVocabStore } from '@/stores/vocab'
import { builtinWords } from '@/core/vocab/builtin'
import { requestLeave } from '../leave'
import WordMemory from './WordMemory.vue'

vi.mock('@/services/sound', () => ({ playBeat: vi.fn(), unlockAudio: vi.fn() }))
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

const run = (ms: number) => vi.advanceTimersByTimeAsync(ms)
const cards = (w: VueWrapper) => w.findAll('[data-test="card"]')
const cardOf = (w: VueWrapper, key: string) => cards(w).find(c => c.attributes('data-key') === key)!
const flip = async (w: VueWrapper, key: string) => { await cardOf(w, key).trigger('pointerdown'); await run(10) }
/** The word keys in this round */
const wordsIn = (w: VueWrapper) => [...new Set(cards(w).map(c => c.attributes('data-key')!.replace(/-[fd]$/, '')))]

describe('the word memory at Oberstufe', () => {
  let api: FakeApi
  beforeEach(async () => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    api = fakeApi({ level: 'oberstufe' })
    window.localStorage.clear()
    // Six French words he met, all due today
    for (const x of builtinWords('fr', 'travel').slice(0, 6)) api.vocab_.progress[x.key] = { box: 2, due: '2026-11-12' }
    const player = usePlayerStore()
    player.init(api, 1, window.localStorage)
    await player.refresh()
    const vocab = useVocabStore()
    vocab.init(api, 1, window.localStorage, () => '2026-11-12')
    await vocab.load()
    vi.mocked(speak).mockClear()
  })
  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  async function opened(): Promise<VueWrapper> {
    const w = mount(WordMemory, { attachTo: document.body })
    await w.find('[data-test="lang-fr"]').trigger('click')
    await run(10)
    return w
  }

  it('deals twelve written cards, the words he met, half French and half German', async () => {
    const w = await opened()
    expect(cards(w)).toHaveLength(12)
    const met = builtinWords('fr', 'travel').slice(0, 6).map(x => x.key).sort()
    expect(wordsIn(w).sort()).toEqual(met)
    await flip(w, `${met[0]}-f`)
    expect(cardOf(w, `${met[0]}-f`).text()).toBe(builtinWords('fr', 'travel').find(x => x.key === met[0])!.foreign.split(' / ')[0])
    expect(vi.mocked(speak).mock.calls.at(-1)![1]).toBe('fr-FR')
    w.unmount()
  })

  it('a pair found at once moves the word; one found after a miss does not', async () => {
    const w = await opened()
    const [a, b, c] = wordsIn(w)
    // a: found at once
    await flip(w, `${a}-f`)
    await flip(w, `${a}-d`)
    // b and c: a miss, then b found
    await flip(w, `${b}-f`)
    await flip(w, `${c}-d`)
    await run(1500)
    await flip(w, `${b}-f`)
    await flip(w, `${b}-d`)
    requestLeave()
    await flushPromises()
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
    expect(api.vocab_.progress[a].box).toBe(3)
    expect(api.vocab_.progress[b].box).toBe(2)
    w.unmount()
  })

  it('leaving on the language screen gives nothing', () => {
    const w = mount(WordMemory, { attachTo: document.body })
    requestLeave()
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
    w.unmount()
  })
})
