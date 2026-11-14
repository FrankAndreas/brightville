import { ref } from 'vue'
import { defineStore } from 'pinia'
import { applyWrite, type Letters } from '@/core/writing/levels'
import { ApiError, type Api, type WriteIn, type WritingState } from '@/services/api'

/** What happened while the server was away (or before it answered), sent with the next load */
interface Waiting {
  writes: WriteIn[]
  /** `day`: the device's day she met it, so a letter met offline counts for its own day */
  intros: { glyph: string; key: string; day?: string }[]
}

const newKey = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

/** How long Schreiben waits for her letters before it goes on without them */
const PATIENCE_MS = 5000
const NEW_A_DAY = 2

/** The device's calendar day, 'YYYY-MM-DD' */
function deviceDay(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Schreiben: her words and sentences, how well she knows each letter and how many new letters are left today. The
 * server keeps them (backend/app/writing.py); each counted write and each finished introduction shows here at once,
 * waits on the device until the server has it, and is sent again with the next load if it was lost.
 */
export const useWritingStore = defineStore('writing', () => {
  const texts = ref<string[]>([])
  const letters = ref<Letters>({})
  const newLeft = ref(NEW_A_DAY)
  const loaded = ref(false)

  let api: Api | null = null
  let storage: Storage | undefined
  let key = ''
  /** Answers are numbered: an older one arriving late doesn't undo a newer one */
  let asked = 0
  let taken = 0
  /**
   * Writes and introductions sent and not answered yet. While any is out, an answer isn't laid over what is shown:
   * the server may already have one that still waits here, and laying it over again would count it twice. The
   * answer to the last one out brings everything.
   */
  let out = 0
  /** The keys of those, so a load doesn't send them a second time */
  const flying = new Set<string>()
  /** Counts `init`s: a send from before one doesn't count as out after it, even for the same child */
  let generation = 0

  function init(server: Api, personId: number, store?: Storage) {
    api = server
    storage = store
    key = `brightville.writing.${personId}`
    texts.value = []
    letters.value = {}
    newLeft.value = NEW_A_DAY
    loaded.value = false
    asked = 0
    taken = 0
    out = 0
    flying.clear()
    generation++
  }

  function readWaiting(at: string): Waiting {
    try {
      const raw: unknown = JSON.parse((storage ?? window.localStorage).getItem(at) ?? '{}')
      const w = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<Waiting>
      return { writes: Array.isArray(w.writes) ? w.writes : [], intros: Array.isArray(w.intros) ? w.intros : [] }
    } catch {
      return { writes: [], intros: [] }
    }
  }

  function writeWaiting(at: string, next: Waiting) {
    try {
      const store = storage ?? window.localStorage
      if (next.writes.length || next.intros.length) store.setItem(at, JSON.stringify(next))
      else store.removeItem(at)
    } catch {
      // Not kept: it still counts while the page stays open
    }
  }

  /** Takes what was sent (by key) out of what waits */
  function sent(at: string, keys: string[]) {
    const w = readWaiting(at)
    writeWaiting(at, { writes: w.writes.filter(x => !keys.includes(x.key)), intros: w.intros.filter(x => !keys.includes(x.key)) })
  }

  /** The server's state, with what still waits on this device laid over it */
  function take(state: WritingState, n: number) {
    if (out > 0) {
      loaded.value = true
      return
    }
    if (n < taken) return
    taken = n
    const w = readWaiting(key)
    const next: Letters = JSON.parse(JSON.stringify(state.letters))
    let left = state.new_left_today
    for (const i of w.intros) {
      if (next[i.glyph]) continue
      next[i.glyph] = { level: 1, streak: 0, practised_at: null }
      left = Math.max(0, left - 1)
    }
    for (const x of w.writes) {
      const now = next[x.glyph]
      if (now && now.level === x.level) next[x.glyph] = applyWrite(now, x.clean, new Date().toISOString())
    }
    texts.value = state.texts
    letters.value = next
    newLeft.value = left
    loaded.value = true
  }

  const refused = (e: unknown) => e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 403

  async function load(): Promise<void> {
    if (!api) return
    const owner = key
    const server = api
    const patience = setTimeout(() => { if (owner === key) loaded.value = true }, PATIENCE_MS)
    try {
      const all = readWaiting(owner)
      // What is on its way already gets its own answer
      const w = { writes: all.writes.filter(x => !flying.has(x.key)), intros: all.intros.filter(x => !flying.has(x.key)) }
      for (const i of w.intros) {
        try {
          await server.introduced(i.glyph, i.key, i.day)
        } catch (e) {
          if (!refused(e)) throw e
        }
        sent(owner, [i.key])
      }
      if (w.writes.length) {
        try {
          await server.sendWrites(w.writes)
        } catch (e) {
          if (!refused(e)) throw e
        }
        sent(owner, w.writes.map(x => x.key))
      }
      if (owner !== key) return
      const n = ++asked
      const state = await server.writing()
      if (owner === key) take(state, n)
    } catch {
      // The visit goes on with what is known here
      if (owner === key) loaded.value = true
    } finally {
      clearTimeout(patience)
    }
  }

  async function send(owner: string, entryKey: string, call: (server: Api) => Promise<WritingState>) {
    if (!api) return
    const server = api
    const n = ++asked
    const gen = generation
    out++
    flying.add(entryKey)
    const mine = () => {
      if (gen !== generation) return
      out--
      flying.delete(entryKey)
    }
    try {
      const state = await call(server)
      sent(owner, [entryKey])
      mine()
      if (owner === key) take(state, n)
    } catch (e) {
      mine()
      // Refused for good: let it go, and show the server's state again
      if (refused(e)) {
        sent(owner, [entryKey])
        if (owner === key) void load()
      }
    }
  }

  /** A write of `glyph` shown at `level`: three clean in a row move it up, three bumpy down */
  function recordWrite(glyph: string, level: number, clean: boolean) {
    const now = letters.value[glyph]
    if (!now || now.level !== level) return
    letters.value = { ...letters.value, [glyph]: applyWrite(now, clean, new Date().toISOString()) }
    const owner = key
    const write: WriteIn = { key: newKey(), glyph, level, clean }
    const w = readWaiting(owner)
    writeWaiting(owner, { ...w, writes: [...w.writes, write] })
    void send(owner, write.key, server => server.sendWrites([write]))
  }

  /** She wrote a new letter three times: it is at the first level now */
  function introduce(glyph: string) {
    if (letters.value[glyph]) return
    letters.value = { ...letters.value, [glyph]: { level: 1, streak: 0, practised_at: null } }
    newLeft.value = Math.max(0, newLeft.value - 1)
    const owner = key
    const intro = { glyph, key: newKey(), day: deviceDay() }
    const w = readWaiting(owner)
    writeWaiting(owner, { ...w, intros: [...w.intros, intro] })
    void send(owner, intro.key, server => server.introduced(glyph, intro.key, intro.day))
  }

  return { texts, letters, newLeft, loaded, init, load, recordWrite, introduce }
})
