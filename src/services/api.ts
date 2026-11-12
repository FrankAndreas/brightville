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
}

export interface Rules {
  daily_goal: number
  play_minutes: number | null
  /** Left out: the Stars stay as they are, with whatever was earned since the page was loaded */
  stars?: number
}

export type PlayerRow = Person & ServerState

/** A film the parents chose for the Cinema */
export interface Film {
  id: number
  youtube_id: string
  title: string
}

/** Why a request failed: the server's code, or 'offline' when there was no usable answer. */
export class ApiError extends Error {
  constructor(public status: number, public code: string, public loginUrl: string | null = null) {
    super(`api ${status} ${code}`)
    this.name = 'ApiError'
  }
}

export interface Api {
  me(): Promise<Me>
  state(): Promise<ServerState>
  /** An earning visit. `key` is made up once per visit, so sending it again counts once. */
  visit(building: string, stars: number, key: string): Promise<{ state: ServerState; goal_reached_now: boolean }>
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
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>

/** `onRenew`: the hub login is in its last week and wants one trip through the hub. */
export function httpApi(fetchFn: Fetch = (url, init) => fetch(url, init), onRenew: () => void = () => {}): Api {
  async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
    let response: Response
    try {
      response = await fetchFn(url, {
        method,
        credentials: 'same-origin',
        // The server takes changes only with this header, which another site can't send
        headers: { 'X-Requested-With': 'brightville', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      throw new ApiError(0, 'offline')
    }
    let data: unknown
    try {
      data = await response.json()
    } catch {
      // A proxy's error page, or the dev server without a backend
      throw new ApiError(response.status, 'offline')
    }
    if (!response.ok) {
      const detail = (data as { detail?: { code?: unknown; login_url?: unknown } } | null)?.detail
      const code = typeof detail?.code === 'string' ? detail.code : 'offline'
      throw new ApiError(response.status, code, typeof detail?.login_url === 'string' ? detail.login_url : null)
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
  }
}
