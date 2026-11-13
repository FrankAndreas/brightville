import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { mount, type VueWrapper } from '@vue/test-utils'
import { fakeApi, type FakeApi } from '@/services/fakeApi'
import { speak } from '@/services/tts'
import { listPaintings as waitingOnDevice } from '@/services/paintings'
import { requestLeave } from '../leave'
import Malen from './Malen.vue'

vi.mock('@/services/tts', () => ({ speak: vi.fn(() => Promise.resolve()), stopSpeaking: vi.fn() }))

// jsdom has no canvas: every call is accepted and nothing is drawn
const fakeContext = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D

const press = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code }))
const tiles = (w: VueWrapper) => w.findAll('[data-test="painting"]')
const onSheet = (w: VueWrapper) => w.find('[data-test="paper"]').exists()
const until = (check: () => void) => vi.waitFor(check)

let api: FakeApi

async function open(owner = 1): Promise<VueWrapper> {
  const w = mount(Malen, { props: { owner, api }, attachTo: document.body })
  await until(() => expect(w.find('[data-test="gallery"]').attributes('data-loaded')).toBe('true'))
  return w
}

function stroke(w: VueWrapper, size = 10, id = 1) {
  const paper = w.find('[data-test="paper"]').element
  const send = (type: string, x: number, y: number) =>
    paper.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: id, clientX: x, clientY: y, width: size, height: size }))
  send('pointerdown', 10, 10)
  send('pointermove', 40, 30)
  send('pointerup', 60, 50)
}

async function newSheet(w: VueWrapper) {
  await w.find('[data-test="new"]').trigger('click')
  expect(onSheet(w)).toBe(true)
}

describe('Malen', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory()
    api = fakeApi()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(fakeContext as never)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAA')
    vi.mocked(speak).mockClear()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    document.body.innerHTML = ''
  })

  it('starts at the gallery with a new sheet to take and says what to do', async () => {
    const w = await open()
    expect(w.find('[data-test="new"]').exists()).toBe(true)
    expect(tiles(w)).toHaveLength(0)
    expect(speak).toHaveBeenCalledWith(expect.stringContaining('neues Bild'))
    w.unmount()
  })

  it('keeps a painting when the child leaves the sheet, and shows it in the gallery', async () => {
    const w = await open()
    await newSheet(w)
    stroke(w)
    requestLeave()
    await until(() => expect(tiles(w)).toHaveLength(1))
    expect(onSheet(w)).toBe(false)
    expect(api.paintings_).toHaveLength(1)
    expect(api.paintings_[0].image).toBe('data:image/png;base64,AAA')
    expect(w.emitted('finished')).toBeUndefined()
    w.unmount()
  })

  it('keeps nothing from a sheet left empty', async () => {
    const w = await open()
    await newSheet(w)
    press('Escape')
    await until(() => expect(onSheet(w)).toBe(false))
    expect(api.paintings_).toHaveLength(0)
    w.unmount()
  })

  it('ignores a resting hand', async () => {
    const w = await open()
    await newSheet(w)
    const lines = () => w.find('[data-test="paper"]').attributes('data-strokes')
    stroke(w, 10, 1)
    await w.vm.$nextTick()
    expect(lines()).toBe('1')
    // The pen is known now; a touch five times its size is a hand
    stroke(w, 50, 2)
    await w.vm.$nextTick()
    expect(lines()).toBe('1')
    w.unmount()
  })

  it('paints further on an old painting and keeps it under the same name', async () => {
    api.paintings_ = [{ id: 'p-old', updated: 5, image: 'data:image/png;base64,OLD', thumb: 'data:image/jpeg;base64,T' }]
    const w = await open()
    expect(tiles(w)).toHaveLength(1)
    expect(tiles(w)[0].find('img').attributes('src')).toBe('/api/paintings/p-old/thumb?v=5')
    await tiles(w)[0].find('img').trigger('click')
    await until(() => expect(onSheet(w)).toBe(true))
    stroke(w)
    await w.find('[data-test="done"]').trigger('click')
    await until(() => expect(onSheet(w)).toBe(false))
    expect(api.paintings_.map(p => p.id)).toEqual(['p-old'])
    expect(api.paintings_[0].image).toBe('data:image/png;base64,AAA')
    w.unmount()
  })

  it('keeps a painting on the device when the server is away, and sends it next time', async () => {
    api.offline = true
    const w = await open()
    await newSheet(w)
    stroke(w)
    requestLeave()
    await until(() => expect(tiles(w)).toHaveLength(1))
    expect(api.paintings_).toEqual([])
    expect(await waitingOnDevice(1)).toHaveLength(1)
    w.unmount()
    api.offline = false
    const again = await open()
    expect(tiles(again)).toHaveLength(1)
    expect(api.paintings_).toHaveLength(1)
    expect(await waitingOnDevice(1)).toEqual([])
    again.unmount()
  })

  it('deletes a painting after asking', async () => {
    api.paintings_ = [{ id: 'p-a', updated: 1, image: 'A', thumb: 'a' }]
    const ask = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    const w = await open()
    await w.find('[data-test="delete"]').trigger('click')
    expect(tiles(w)).toHaveLength(1)
    await w.find('[data-test="delete"]').trigger('click')
    await until(() => expect(tiles(w)).toHaveLength(0))
    expect(ask).toHaveBeenCalledTimes(2)
    expect(api.paintings_).toHaveLength(0)
    w.unmount()
  })

  it('goes back to the town from the gallery, once, with no Stars and nothing for the logbook', async () => {
    const w = await open()
    requestLeave()
    expect(w.emitted('finished')).toEqual([[{ stars: 0, made: false }]])
    requestLeave()
    press('Escape')
    expect(w.emitted('finished')).toHaveLength(1)
    w.unmount()
  })

  it('keeps a painting when the building is closed while drawing', async () => {
    const w = await open()
    await newSheet(w)
    stroke(w)
    w.unmount()
    await until(() => expect(api.paintings_).toHaveLength(1))
  })
})
