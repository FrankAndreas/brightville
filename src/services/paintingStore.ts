import { paintingUrl, type Api } from './api'
import { deletePainting, listPaintings, loadPainting, newPaintingId, savePainting } from './paintings'

// A child's paintings: kept on the server, so every device shows the same gallery. A painting the server
// can't take right now waits on this device and is sent the next time the gallery is listed.

export interface GalleryItem {
  id: string
  /** Address or data URL of the small picture */
  thumb: string
  /** Still only on this device */
  waiting: boolean
}

export interface PaintingStore {
  /** Sends what waits on this device, then lists everything, newest first. */
  list(): Promise<GalleryItem[]>
  /** The full picture: an address on the server, or a data URL while it waits here. */
  image(id: string): Promise<string | null>
  /** Keeps a painting (no id: a new one); resolves to its id. Never loses it: what the server refuses waits here. */
  save(painting: { id?: string; image: string; thumb: string }): Promise<string>
  remove(id: string): Promise<void>
}

export function paintingStore(api: Api, owner: number): PaintingStore {
  /** The server's list from the last listing, for the picture addresses */
  let known = new Map<string, number>()

  const waiting = () => listPaintings(owner).catch(() => [])

  async function send() {
    for (const info of await waiting()) {
      const painting = await loadPainting(owner, info.id).catch(() => undefined)
      if (!painting) continue
      try {
        await api.keepPainting(info.id, painting.image, painting.thumb)
      } catch {
        // Still away: everything else waits too
        return
      }
      await deletePainting(owner, info.id).catch(() => undefined)
    }
  }

  return {
    async list() {
      await send()
      const here = await waiting()
      let server: { id: string; updated: number }[] = []
      try {
        server = await api.paintings()
        known = new Map(server.map(p => [p.id, p.updated]))
      } catch {
        // Only what waits here, then
      }
      const local = new Set(here.map(p => p.id))
      return [
        ...here.map(p => ({ id: p.id, thumb: p.thumb, waiting: true })),
        ...server.filter(p => !local.has(p.id)).map(p => ({ id: p.id, thumb: paintingUrl(p, 'thumb'), waiting: false })),
      ]
    },

    async image(id) {
      const here = await loadPainting(owner, id).catch(() => undefined)
      if (here) return here.image
      const updated = known.get(id)
      return updated === undefined ? null : paintingUrl({ id, updated }, 'image')
    },

    async save(painting) {
      const id = painting.id ?? newPaintingId()
      try {
        const row = await api.keepPainting(id, painting.image, painting.thumb)
        known.set(id, row.updated)
        // An older copy that waited here is replaced by this one
        await deletePainting(owner, id).catch(() => undefined)
        return id
      } catch {
        return savePainting(owner, { id, image: painting.image, thumb: painting.thumb })
      }
    },

    async remove(id) {
      await deletePainting(owner, id).catch(() => undefined)
      try {
        await api.removePainting(id)
      } catch {
        // Not on the server (only waited here), or the server is away: it stays there until the next delete
      }
      known.delete(id)
    },
  }
}
