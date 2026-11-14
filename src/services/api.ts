import type { LogDay } from '@/core/diary'
import type { Look } from '@/core/look'
import type { Place } from '@/core/outfits'
import type { Spot } from '@/core/furniture'
import type { Letters } from '@/core/writing/levels'

export type { LogDay, LogEntry } from '@/core/diary'

// The game's server (backend/): who is playing, their Stars and today's numbers, the parents' settings, the films.

export interface Person {
  id: number
  name: string
  role: 'CHILD' | 'PARENT'
  color: string | null
}

export interface Me {
  /** With the family hub's login, or without one (people are picked on the page) */
  mode: 'hub' | 'local'
  person: Person | null
  /** Without a hub: who can be picked */
  people: Person[]
  /** With a hub: where the browser logs in and out; the page adds its own address */
  login_url: string | null
  logout_url: string | null
}

export interface ServerState {
  stars: number
  day: string
  visits: number
  daily_goal: number
  play_seconds: number
  /** Minutes of play per day; null for no limit */
  play_minutes: number | null
  /** Stars saved before the shop came: they count half there (core/outfits.ts shopMoney) */
  savings: number
}

/** Her look and her add-ons (backend/app/wardrobe.py) */
export interface WardrobeState {
  /** null until she chose one */
  look: Look | null
  worn: Partial<Record<Place, string>>
  owned: { id: string; how: 'bought' | 'gift'; got_at: string }[]
  bought_today: boolean
}

export interface Rules {
  daily_goal: number
  play_minutes: number | null
  /** Left out: the Stars stay as they are, with whatever was earned since the page was loaded */
  stars?: number
}

/** For the parents' page; `owned`: the add-ons a player has (stage 7), `furniture`: her furniture (stage 8) */
export type PlayerRow = Person & ServerState & { owned?: string[]; furniture?: string[] }

/** Schreiben (backend/app/writing.py): her words and sentences, the letters she has met, new letters left today */
export interface WritingState {
  texts: string[]
  letters: Letters
  new_left_today: number
}

/** One counted write: clean or bumpy, at the level the letter was shown at */
export interface WriteIn {
  key: string
  glyph: string
  level: number
  clean: boolean
}

/** Her room (backend/app/room.py): what stands on each spot, her furniture, and whether anything (in either shop) was
 * bought today */
export interface RoomState {
  placed: Partial<Record<Spot, string>>
  owned: { id: string; got_at: string }[]
  bought_today: boolean
}

/** A film the parents chose for the Cinema */
export interface Film {
  id: number
  youtube_id: string
  title: string
}

/** A painting from Malen on the server; its pictures are at paintingUrl() */
export interface PaintingRow {
  id: string
  /** Milliseconds; changes when painted further */
  updated: number
}

/** Where a painting's picture or thumbnail is; `updated` makes a changed painting a new address */
export function paintingUrl(row: PaintingRow, which: 'image' | 'thumb'): string {
  return `/api/paintings/${encodeURIComponent(row.id)}/${which}?v=${row.updated}`
}

/** A sticker a child has: `seen` once the child was shown it */
export interface StickerRow {
  id: string
  earned_at: string
  seen: boolean
}

/** Why a request failed: the server's code, or 'offline' when there was no usable answer. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public loginUrl: string | null = null,
    /** 'too_soon': seconds until the server takes the visit */
    public retryAfter: number | null = null,
  ) {
    super(`api ${status} ${code}`)
    this.name = 'ApiError'
  }
}

export interface Api {
  me(): Promise<Me>
  state(): Promise<ServerState>
  /** An earning visit. `key` is made up once per visit, so sending it again counts once. */
  visit(building: string, stars: number, key: string): Promise<{ state: ServerState; goal_reached_now: boolean; stickers?: string[] }>
  /** A visit to Malen or Ausmalen: no Stars, only remembered; answers with stickers it earned */
  freeVisit(building: string, key: string): Promise<{ stickers: string[] }>
  /** The person's stickers; the server gives any earned by now first */
  stickers(): Promise<StickerRow[]>
  stickersSeen(ids: string[]): Promise<unknown>
  /** The days something happened, newest first; `before` a day, for older pages */
  logbook(before?: string, days?: number): Promise<LogDay[]>
  /** For parents: a child's last days and stickers */
  diary(personId: number): Promise<{ days: LogDay[]; stickers: StickerRow[] }>
  /** Buys a round. Rejects with code 'locked', 'poor' or 'time_up'. */
  play(building: string, key: string): Promise<{ state: ServerState }>
  playTime(seconds: number): Promise<ServerState>
  players(): Promise<PlayerRow[]>
  setRules(personId: number, rules: Rules): Promise<ServerState>
  choose(personId: number): Promise<unknown>
  films(): Promise<Film[]>
  /** Parents only. Rejects with 'not_youtube', 'already_there' or 'too_many'. */
  addFilm(url: string, title: string): Promise<Film>
  removeFilm(id: number): Promise<unknown>
  /** The person's paintings, newest first */
  paintings(): Promise<PaintingRow[]>
  /** Keeps a painting under its id (new, or painted further). Rejects with 'too_large' or 'not_a_picture'. */
  keepPainting(id: string, image: string, thumb: string): Promise<PaintingRow>
  removePainting(id: string): Promise<unknown>
  wardrobe(): Promise<WardrobeState>
  saveLook(look: Look): Promise<WardrobeState>
  /** Puts on or (null) takes off, place by place */
  setWorn(worn: Partial<Record<Place, string | null>>): Promise<WardrobeState>
  /** Rejects with 'locked', 'bought_today', 'shelf_locked', 'owned', 'poor', 'not_for_sale' or 'unknown' */
  buy(item: string, key: string): Promise<{ state: ServerState; wardrobe: WardrobeState }>
  room(): Promise<RoomState>
  /** Puts a piece on its spot or (null) takes it away, spot by spot */
  setPlaced(placed: Partial<Record<Spot, string | null>>): Promise<RoomState>
  /** The Möbelhaus; rejects with the same codes as `buy` */
  buyFurniture(item: string, key: string): Promise<{ state: ServerState; room: RoomState }>
  writing(): Promise<WritingState>
  sendWrites(writes: WriteIn[]): Promise<WritingState>
  /** She wrote a new letter three times. Rejects with 'no_new_today' or 'unknown'. */
  introduced(glyph: string, key: string, day?: string): Promise<WritingState>
  /** Parents only */
  playerWriting(personId: number): Promise<WritingState>
  /** Parents only; the whole list. Rejects with 'empty', 'letters', 'too-long', 'exists' or 'too-many'. */
  setPlayerTexts(personId: number, texts: string[]): Promise<WritingState>
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>

const WRITING_TIMEOUT_MS = 15_000

/** `onRenew`: the hub login is in its last week and wants one trip through the hub. */
export function httpApi(fetchFn: Fetch = (url, init) => fetch(url, init), onRenew: () => void = () => {}): Api {
  /** `timeoutMs`: give up then, as offline (what waits on the device is sent again later) */
  async function call<T>(method: string, url: string, body?: unknown, timeoutMs?: number): Promise<T> {
    let response: Response
    const abort = timeoutMs ? new AbortController() : null
    const timer = abort ? setTimeout(() => abort.abort(), timeoutMs) : null
    try {
      response = await fetchFn(url, {
        method,
        signal: abort?.signal,
        credentials: 'same-origin',
        // The server takes changes only with this header, which another site can't send
        headers: { 'X-Requested-With': 'brightville', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      if (timer) clearTimeout(timer)
      throw new ApiError(0, 'offline')
    }
    let data: unknown
    try {
      data = await response.json()
    } catch {
      if (timer) clearTimeout(timer)
      // A proxy's error page, the dev server without a backend, or an answer cut off by the timeout
      throw new ApiError(response.status, 'offline')
    }
    if (timer) clearTimeout(timer)
    if (!response.ok) {
      const detail = (data as { detail?: { code?: unknown; login_url?: unknown; retry_after?: unknown } } | null)?.detail
      const code = typeof detail?.code === 'string' ? detail.code : 'offline'
      throw new ApiError(
        response.status,
        code,
        typeof detail?.login_url === 'string' ? detail.login_url : null,
        typeof detail?.retry_after === 'number' ? detail.retry_after : null,
      )
    }
    if (response.headers.get('X-Hub-Renew') === '1') onRenew()
    return data as T
  }

  return {
    me: () => call('GET', '/api/me'),
    state: () => call('GET', '/api/state'),
    visit: (building, stars, key) => call('POST', '/api/visits', { building, stars, key }),
    play: (building, key) => call('POST', '/api/plays', { building, key }),
    playTime: seconds => call('POST', '/api/playtime', { seconds }),
    players: () => call('GET', '/api/players'),
    setRules: (personId, rules) => call('PUT', `/api/players/${personId}`, rules),
    choose: personId => call('POST', '/api/local/choose', { id: personId }),
    films: () => call('GET', '/api/films'),
    addFilm: (url, title) => call('POST', '/api/films', { url, title }),
    removeFilm: id => call('DELETE', `/api/films/${id}`),
    paintings: () => call('GET', '/api/paintings'),
    keepPainting: (id, image, thumb) => call('PUT', `/api/paintings/${encodeURIComponent(id)}`, { image, thumb }),
    removePainting: id => call('DELETE', `/api/paintings/${encodeURIComponent(id)}`),
    freeVisit: (building, key) => call('POST', '/api/free-visits', { building, key }),
    stickers: () => call('GET', '/api/stickers'),
    stickersSeen: ids => call('POST', '/api/stickers/seen', { ids }),
    logbook: (before, days = 7) => call('GET', `/api/logbook?days=${days}${before ? `&before=${before}` : ''}`),
    diary: personId => call('GET', `/api/players/${personId}/diary`),
    wardrobe: () => call('GET', '/api/wardrobe'),
    saveLook: look => call('PUT', '/api/look', { look }),
    setWorn: worn => call('PUT', '/api/worn', { worn }),
    buy: (item, key) => call('POST', '/api/shop/buy', { item, key }),
    room: () => call('GET', '/api/room'),
    setPlaced: placed => call('PUT', '/api/room/placed', { placed }),
    buyFurniture: (item, key) => call('POST', '/api/moebel/buy', { item, key }),
    writing: () => call('GET', '/api/writing'),
    // A write that hangs would hold the letters shown back (stores/writing.ts): it waits on the device instead
    sendWrites: writes => call('POST', '/api/writing/writes', { writes }, WRITING_TIMEOUT_MS),
    introduced: (glyph, key, day) => call('POST', '/api/writing/introduced', { glyph, key, day }, WRITING_TIMEOUT_MS),
    playerWriting: personId => call('GET', `/api/players/${personId}/writing`),
    setPlayerTexts: (personId, texts) => call('PUT', `/api/players/${personId}/writing/texts`, { texts }),
  }
}
