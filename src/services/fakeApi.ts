// A stand-in for the server in tests: the same rules in memory (backend/app/game.py), for one person.
import buildings from '../../shared/buildings.json'
import { ApiError, type Api, type Film, type Me, type Person, type PlayerRow, type ServerState } from './api'

export interface FakeApi extends Api {
  state_: ServerState
  me_: Me
  /** Every request made, as "name arg arg" */
  calls: string[]
  /** While true no request gets through */
  offline: boolean
  /** While true every request is carried out, but its answer is lost on the way back */
  loseAnswers: boolean
  rows: PlayerRow[]
  films_: Film[]
  /** The server's calendar turns a page */
  newDay(day: string): void
}

const KID: Person = { id: 1, name: 'Mia', role: 'CHILD', color: '#ff66aa' }

export function fakeApi(start: Partial<ServerState> = {}, me: Partial<Me> = {}): FakeApi {
  const state: ServerState = { stars: 0, day: '2026-11-12', visits: 0, daily_goal: 2, play_seconds: 0, play_minutes: null, ...start }
  const seen = new Set<string>()
  const find = (id: string) => buildings.find(b => b.id === id) as { id: string; kind: string; maxStars?: number; cost?: number } | undefined
  const api: FakeApi = {
    state_: state,
    me_: { mode: 'hub', person: KID, people: [], login_url: 'https://hub.test/?next=', logout_url: 'https://hub.test/logout?next=', ...me },
    calls: [],
    offline: false,
    loseAnswers: false,
    rows: [],
    films_: [],
    newDay(day) {
      Object.assign(state, { day, visits: 0, play_seconds: 0 })
    },
    me: () => run('me', () => ({ ...api.me_ })),
    state: () => run('state', () => ({ ...state })),
    visit: (building, stars, key) => run(`visit ${building} ${stars}`, () => {
      const b = find(building)
      // Buildings the tests make up give what they say
      const earned = Math.min(stars, b?.maxStars ?? stars)
      if (earned <= 0 || seen.has(key)) return { state: { ...state }, goal_reached_now: false }
      seen.add(key)
      const before = state.visits >= state.daily_goal
      state.stars += earned
      state.visits += 1
      return { state: { ...state }, goal_reached_now: !before && state.visits >= state.daily_goal }
    }),
    play: (building, key) => run(`play ${building}`, () => {
      // A round key counts on the day it was bought only, as on the server
      if (seen.has(`${state.day} ${key}`)) return { state: { ...state } }
      const cost = find(building)?.cost ?? 3
      if (state.visits < state.daily_goal) throw new ApiError(409, 'locked')
      if (state.play_minutes !== null && state.play_seconds >= state.play_minutes * 60) throw new ApiError(409, 'time_up')
      if (state.stars < cost) throw new ApiError(409, 'poor')
      seen.add(`${state.day} ${key}`)
      state.stars -= cost
      return { state: { ...state } }
    }),
    playTime: seconds => run(`playTime ${seconds}`, () => {
      state.play_seconds += seconds
      return { ...state }
    }),
    players: () => run('players', () => api.rows.map(r => ({ ...r }))),
    setRules: (id, rules) => run(`setRules ${id} ${JSON.stringify(rules)}`, () => {
      const row = api.rows.find(r => r.id === id)
      if (!row) throw new ApiError(404, 'unknown_person')
      Object.assign(row, rules)
      return { ...row }
    }),
    films: () => run('films', () => api.films_.map(f => ({ ...f }))),
    addFilm: (url, title) => run(`addFilm ${url}`, () => {
      // Enough of the server's rule for tests: the 11 characters after youtu.be/ or v=
      const id = /(?:youtu\.be\/|v=)([A-Za-z0-9_-]{11})/.exec(url)?.[1]
      if (!id) throw new ApiError(422, 'not_youtube')
      if (api.films_.some(f => f.youtube_id === id)) throw new ApiError(409, 'already_there')
      const film = { id: Math.max(0, ...api.films_.map(f => f.id)) + 1, youtube_id: id, title: title.trim() }
      api.films_.push(film)
      return { ...film }
    }),
    removeFilm: id => run(`removeFilm ${id}`, () => {
      if (!api.films_.some(f => f.id === id)) throw new ApiError(404, 'unknown_film')
      api.films_ = api.films_.filter(f => f.id !== id)
      return { ok: true }
    }),
    choose: id => run(`choose ${id}`, () => {
      const person = api.me_.people.find(p => p.id === id)
      if (!person) throw new ApiError(404, 'unknown_person')
      api.me_.person = person
      return { ok: true }
    }),
  }
  async function run<T>(name: string, fn: () => T): Promise<T> {
    api.calls.push(name)
    if (api.offline) throw new ApiError(0, 'offline')
    const answer = fn()
    if (api.loseAnswers) throw new ApiError(0, 'offline')
    return answer
  }
  return api
}
