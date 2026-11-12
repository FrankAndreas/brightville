import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { MAX_PAINTINGS, deletePainting, listPaintings, loadPainting, savePainting } from './paintings'

describe('paintings', () => {
  beforeEach(() => { globalThis.indexedDB = new IDBFactory() })

  it('starts empty', async () => {
    expect(await listPaintings(1)).toEqual([])
  })

  it('saves a new painting and loads it again', async () => {
    const id = await savePainting(1, { image: 'data:image/png;base64,AAA', thumb: 'data:image/jpeg;base64,BBB' })
    expect(id).toBeTruthy()
    const p = await loadPainting(1, id)
    expect(p).toMatchObject({ id, image: 'data:image/png;base64,AAA', thumb: 'data:image/jpeg;base64,BBB' })
    expect(typeof p?.updated).toBe('number')
  })

  it('lists the newest first, without the full images', async () => {
    const a = await savePainting(1, { image: 'A', thumb: 'a' })
    const b = await savePainting(1, { image: 'B', thumb: 'b' })
    const list = await listPaintings(1)
    expect(list.map(p => p.id)).toEqual([b, a])
    expect(list[0]).not.toHaveProperty('image')
    expect(list[0].thumb).toBe('b')
  })

  it('saving an existing painting again moves it to the front', async () => {
    const a = await savePainting(1, { image: 'A', thumb: 'a' })
    const b = await savePainting(1, { image: 'B', thumb: 'b' })
    await savePainting(1, { id: a, image: 'A2', thumb: 'a2' })
    expect((await listPaintings(1)).map(p => p.id)).toEqual([a, b])
    expect((await loadPainting(1, a))?.image).toBe('A2')
  })

  it(`keeps only the newest ${MAX_PAINTINGS} of each child`, async () => {
    const other = await savePainting(2, { image: 'O', thumb: 'o' })
    const ids: string[] = []
    for (let i = 0; i < MAX_PAINTINGS + 3; i++) ids.push(await savePainting(1, { image: `I${i}`, thumb: `t${i}` }))
    const list = await listPaintings(1)
    expect(list).toHaveLength(MAX_PAINTINGS)
    expect(list.map(p => p.id)).toEqual(ids.slice(3).reverse())
    expect((await listPaintings(2)).map(p => p.id)).toEqual([other])
  })

  it('deletes a painting', async () => {
    const a = await savePainting(1, { image: 'A', thumb: 'a' })
    await deletePainting(1, a)
    expect(await listPaintings(1)).toEqual([])
    expect(await loadPainting(1, a)).toBeUndefined()
  })

  it("shows each child only their own paintings, and never lets another child's be changed", async () => {
    const mine = await savePainting(1, { image: 'M', thumb: 'm' })
    const theirs = await savePainting(2, { image: 'T', thumb: 't' })
    expect((await listPaintings(1)).map(p => p.id)).toEqual([mine])
    expect(await loadPainting(1, theirs)).toBeUndefined()
    await deletePainting(1, theirs)
    expect((await listPaintings(2)).map(p => p.id)).toEqual([theirs])
    // Saving under someone else's id makes a new painting instead
    const copy = await savePainting(1, { id: theirs, image: 'X', thumb: 'x' })
    expect(copy).not.toBe(theirs)
    expect((await loadPainting(2, theirs))?.image).toBe('T')
  })
})
