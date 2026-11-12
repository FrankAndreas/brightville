import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { mount, type VueWrapper } from '@vue/test-utils'
import { speak } from '@/services/tts'
import { listPaintings, loadPainting, savePainting } from '@/services/paintings'
import { requestLeave } from '../leave'
import Malen from './Malen.vue'

vi.mock('@/services/tts', () => ({ speak: vi.fn(() => Promise.resolve()), stopSpeaking: vi.fn() }))

// jsdom has no canvas: every call is accepted and nothing is drawn
const fakeContext = new Proxy({}, { get: () => () => undefined, set: () => true }) as unknown as CanvasRenderingContext2D

const press = (code: string) => window.dispatchEvent(new KeyboardEvent('keydown', { code }))
const tiles = (w: VueWrapper) => w.findAll('[data-test="painting"]')
const onSheet = (w: VueWrapper) => w.find('[data-test="paper"]').exists()
const until = (check: () => void) => vi.waitFor(check)

async function open(owner = 1): Promise<VueWrapper> {
  const w = mount(Malen, { props: { owner }, attachTo: document.body })
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
    expect(await listPaintings(1)).toHaveLength(1)
    expect(w.emitted('finished')).toBeUndefined()
    w.unmount()
  })

  it('keeps nothing from a sheet left empty', async () => {
    const w = await open()
    await newSheet(w)
    press('Escape')
    await until(() => expect(onSheet(w)).toBe(false))
    expect(await listPaintings(1)).toHaveLength(0)
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
    const id = await savePainting(1, { image: 'data:image/png;base64,OLD', thumb: 'data:image/jpeg;base64,T' })
    const w = await open()
    expect(tiles(w)).toHaveLength(1)
    await tiles(w)[0].find('img').trigger('click')
    await until(() => expect(onSheet(w)).toBe(true))
    stroke(w)
    await w.find('[data-test="done"]').trigger('click')
    await until(() => expect(onSheet(w)).toBe(false))
    expect((await listPaintings(1)).map(p => p.id)).toEqual([id])
    expect((await loadPainting(1, id))?.image).toBe('data:image/png;base64,AAA')
    w.unmount()
  })

  it("shows only this child's paintings", async () => {
    await savePainting(2, { image: 'B', thumb: 'b' })
    const w = await open(1)
    expect(tiles(w)).toHaveLength(0)
    w.unmount()
  })

  it('deletes a painting after asking', async () => {
    await savePainting(1, { image: 'A', thumb: 'a' })
    const ask = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    const w = await open()
    await w.find('[data-test="delete"]').trigger('click')
    expect(tiles(w)).toHaveLength(1)
    await w.find('[data-test="delete"]').trigger('click')
    await until(() => expect(tiles(w)).toHaveLength(0))
    expect(ask).toHaveBeenCalledTimes(2)
    expect(await listPaintings(1)).toHaveLength(0)
    w.unmount()
  })

  it('goes back to the town from the gallery, once, with no Stars', async () => {
    const w = await open()
    requestLeave()
    expect(w.emitted('finished')).toEqual([[{ stars: 0 }]])
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
    await until(async () => expect(await listPaintings(1)).toHaveLength(1))
  })
})
