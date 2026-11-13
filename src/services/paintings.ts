// Paintings (Malen) waiting on this device, in IndexedDB, until the server can be reached:
// the full image and a small thumbnail as data URLs, per child. paintingStore.ts sends them on.
export const MAX_PAINTINGS = 20

const DB = 'brightville'
const STORE = 'paintings'

export interface PaintingInfo {
  id: string
  owner: number
  thumb: string
  updated: number
}
export interface Painting extends PaintingInfo {
  image: string
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

// Runs fn(store) in a transaction and resolves with its result when it commits
async function inStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T> | T): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    let result: T
    void Promise.resolve(fn(tx.objectStore(STORE))).then(r => { result = r })
    tx.oncomplete = () => { db.close(); resolve(result) }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

const request = <T>(req: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result)
  req.onerror = () => reject(req.error)
})

const newest = (a: PaintingInfo, b: PaintingInfo) => b.updated - a.updated

async function ownedBy(store: IDBObjectStore, owner: number): Promise<Painting[]> {
  const all = (await request(store.getAll())) as Painting[]
  return all.filter(p => p.owner === owner)
}

/** This child's paintings, newest first, without their full images. */
export async function listPaintings(owner: number): Promise<PaintingInfo[]> {
  const mine = await inStore('readonly', store => ownedBy(store, owner))
  return mine.sort(newest).map(({ id, owner: o, thumb, updated }) => ({ id, owner: o, thumb, updated }))
}

export async function loadPainting(owner: number, id: string): Promise<Painting | undefined> {
  const p = (await inStore('readonly', store => request(store.get(id)))) as Painting | undefined
  return p?.owner === owner ? p : undefined
}

/**
 * Saves a new painting (no id) or updates one of this child's; returns its id.
 * Their oldest beyond MAX_PAINTINGS go.
 */
export function savePainting(owner: number, painting: { id?: string; image: string; thumb: string }): Promise<string> {
  return inStore('readwrite', async store => {
    const all = (await request(store.getAll())) as Painting[]
    // Strictly newer than everything else, even when saved in the same millisecond
    const updated = Math.max(Date.now(), ...all.map(p => p.updated + 1))
    // A name another child uses here gets a new one
    const taken = all.some(p => p.id === painting.id && p.owner !== owner)
    const id = painting.id !== undefined && !taken ? painting.id : newPaintingId(updated)
    store.put({ id, owner, image: painting.image, thumb: painting.thumb, updated })
    const others = all.filter(p => p.owner === owner && p.id !== id).sort(newest)
    for (const old of others.slice(MAX_PAINTINGS - 1)) store.delete(old.id)
    return id
  })
}

/** A name for a new painting, unique enough to be made up on any device */
export function newPaintingId(now = Date.now()): string {
  return `p-${now.toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export function deletePainting(owner: number, id: string): Promise<void> {
  return inStore('readwrite', async store => {
    const p = (await request(store.get(id))) as Painting | undefined
    if (p?.owner === owner) await request(store.delete(id))
  })
}
