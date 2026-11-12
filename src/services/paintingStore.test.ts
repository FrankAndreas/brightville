import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { fakeApi, type FakeApi } from './fakeApi'
import { paintingStore } from './paintingStore'
import { listPaintings as waitingOnDevice, savePainting as waitOnDevice } from './paintings'

const PICTURE = { image: 'data:image/png;base64,AAA', thumb: 'data:image/jpeg;base64,BBB' }

describe('paintingStore', () => {
  let api: FakeApi
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory()
    api = fakeApi()
  })

  it('keeps a painting on the server and lists it with its server pictures', async () => {
    const store = paintingStore(api, 1)
    const id = await store.save(PICTURE)
    expect(api.paintings_.map(p => p.id)).toEqual([id])
    const list = await store.list()
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ id, waiting: false })
    expect(list[0].thumb).toMatch(new RegExp(`^/api/paintings/${id}/thumb\\?v=\\d+$`))
    expect(await store.image(id)).toMatch(new RegExp(`^/api/paintings/${id}/image\\?v=\\d+$`))
    expect(await waitingOnDevice(1)).toEqual([])
  })

  it('paints further under the same name', async () => {
    const store = paintingStore(api, 1)
    const id = await store.save(PICTURE)
    expect(await store.save({ ...PICTURE, id, image: 'data:image/png;base64,CCC' })).toBe(id)
    expect(api.paintings_).toHaveLength(1)
    expect(api.paintings_[0].image).toBe('data:image/png;base64,CCC')
  })

  it('keeps a painting on the device while the server is away, shows it, and sends it later', async () => {
    const store = paintingStore(api, 1)
    api.offline = true
    const id = await store.save(PICTURE)
    expect(api.paintings_).toEqual([])
    const offline = await store.list()
    expect(offline).toEqual([expect.objectContaining({ id, waiting: true, thumb: PICTURE.thumb })])
    expect(await store.image(id)).toBe(PICTURE.image)

    api.offline = false
    const online = await store.list()
    expect(online).toEqual([expect.objectContaining({ id, waiting: false })])
    expect(api.paintings_.map(p => p.id)).toEqual([id])
    expect(await waitingOnDevice(1)).toEqual([])
  })

  it('sends only this child\'s waiting paintings', async () => {
    await waitOnDevice(2, { id: 'p-other', ...PICTURE })
    await paintingStore(api, 1).list()
    expect(api.paintings_).toEqual([])
    expect((await waitingOnDevice(2)).map(p => p.id)).toEqual(['p-other'])
  })

  it('shows what is on the device when the server is away while listing', async () => {
    await waitOnDevice(1, { id: 'p-wait', ...PICTURE })
    api.offline = true
    const list = await paintingStore(api, 1).list()
    expect(list.map(p => p.id)).toEqual(['p-wait'])
  })

  it('removes a painting wherever it is', async () => {
    const store = paintingStore(api, 1)
    const onServer = await store.save(PICTURE)
    await waitOnDevice(1, { id: 'p-wait', ...PICTURE })
    api.offline = true
    await store.remove('p-wait')
    expect(await waitingOnDevice(1)).toEqual([])
    api.offline = false
    await store.remove(onServer)
    expect(api.paintings_).toEqual([])
  })

  it('keeps a painting the server refuses on the device rather than losing it', async () => {
    const store = paintingStore(api, 1)
    const keep = api.keepPainting
    api.keepPainting = () => Promise.reject(Object.assign(new Error('boom'), { status: 500, code: 'offline' }))
    const id = await store.save(PICTURE)
    expect((await waitingOnDevice(1)).map(p => p.id)).toEqual([id])
    api.keepPainting = keep
  })
})
