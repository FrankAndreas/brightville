// A stand-in for the server in tests: the same rules in memory (backend/app/game.py), for one person.
import buildings from '../../shared/buildings.json'
import { outfitDef, pay, shelfOpen, type Place } from '@/core/outfits'
import {
  ApiError, type Api, type Film, type LogDay, type Me, type Person, type PlayerRow, type ServerState, type StickerRow,
  type WardrobeState,
} from './api'

export interface FakePainting { id: string; updated: number; image: string; thumb: string }

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
  paintings_: FakePainting[]
  stickers_: StickerRow[]
  /** Sticker ids the next visit or free visit earns */
  earns_: string[]
  logbook_: LogDay[]
  /** Her look and add-ons, as the server keeps them */
  wardrobe_: WardrobeState
  /** The server's calendar turns a page */
  newDay(day: string): void
}

const KID: Person = { id: 1, name: 'Mia', role: 'CHILD', color: '#ff66aa' }

export function fakeApi(start: Partial<ServerState> = {}, me: Partial<Me> = {}): FakeApi {
  const state: ServerState = { stars: 0, day: '2026-11-12', visits: 0, daily_goal: 2, play_seconds: 0, play_minutes: null, savings: 0, ...start }
  const seen = new Set<string>()
  const find = (id: string) => buildings.find(b => b.id === id) as { id: string; kind: string; maxStars?: number; cost?: number } | undefined
  /** Hands out what `earns_` holds, as the server's award does */
  function award(): string[] {
    const ids = api.earns_.filter(id => !api.stickers_.some(s => s.id === id))
    api.earns_ = []
    for (const id of ids) api.stickers_.push({ id, earned_at: `${state.day}T10:00:00+01:00`, seen: false })
    return ids
  }
  const api: FakeApi = {
    state_: state,
    me_: { mode: 'hub', person: KID, people: [], login_url: 'https://hub.test/?next=', logout_url: 'https://hub.test/logout?next=', ...me },
    calls: [],
    offline: false,
    loseAnswers: false,
    rows: [],
    films_: [],
    paintings_: [],
    stickers_: [],
    earns_: [],
    logbook_: [],
    wardrobe_: { look: null, worn: {}, owned: [], bought_today: false },
    newDay(day) {
      Object.assign(state, { day, visits: 0, play_seconds: 0 })
      api.wardrobe_.bought_today = false
    },
    me: () => run('me', () => ({ ...api.me_ })),
    state: () => run('state', () => ({ ...state })),
    visit: (building, stars, key) => run(`visit ${building} ${stars}`, () => {
      const b = find(building)
      // Buildings the tests make up give what they say
      const earned = Math.min(stars, b?.maxStars ?? stars)
      if (earned <= 0 || seen.has(key)) return { state: { ...state }, goal_reached_now: false, stickers: [] }
      seen.add(key)
      const before = state.visits >= state.daily_goal
      state.stars += earned
      state.visits += 1
      return { state: { ...state }, goal_reached_now: !before && state.visits >= state.daily_goal, stickers: award() }
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
    paintings: () => run('paintings', () =>
      [...api.paintings_].sort((a, b) => b.updated - a.updated).map(({ id, updated }) => ({ id, updated }))),
    keepPainting: (id, image, thumb) => run(`keepPainting ${id}`, () => {
      const updated = Math.max(Date.now(), ...api.paintings_.map(p => p.updated + 1))
      api.paintings_ = [...api.paintings_.filter(p => p.id !== id), { id, updated, image, thumb }]
      return { id, updated }
    }),
    freeVisit: (building, key) => run(`freeVisit ${building}`, () => {
      if (find(building)?.kind !== 'free') throw new ApiError(422, 'wrong_kind')
      if (seen.has(key)) return { stickers: [] }
      seen.add(key)
      return { stickers: award() }
    }),
    stickers: () => run('stickers', () => api.stickers_.map(s => ({ ...s }))),
    stickersSeen: ids => run(`stickersSeen ${ids.join(',')}`, () => {
      for (const s of api.stickers_) if (ids.includes(s.id)) s.seen = true
      return { ok: true }
    }),
    logbook: (before, days = 7) => run(`logbook ${before ?? ''} ${days}`.trim(), () =>
      api.logbook_.filter(d => !before || d.day < before).slice(0, days)),
    diary: personId => run(`diary ${personId}`, () => ({ days: api.logbook_.slice(0, 7), stickers: api.stickers_.map(s => ({ ...s })) })),
    removePainting: id => run(`removePainting ${id}`, () => {
      if (!api.paintings_.some(p => p.id === id)) throw new ApiError(404, 'unknown_painting')
      api.paintings_ = api.paintings_.filter(p => p.id !== id)
      return { ok: true }
    }),
    wardrobe: () => run('wardrobe', () => copy(api.wardrobe_)),
    saveLook: look => run('saveLook', () => {
      api.wardrobe_.look = { ...look }
      return copy(api.wardrobe_)
    }),
    setWorn: worn => run(`setWorn ${JSON.stringify(worn)}`, () => {
      const owned = api.wardrobe_.owned.map(o => o.id)
      for (const [place, id] of Object.entries(worn) as [Place, string | null][]) {
        if (id === null) delete api.wardrobe_.worn[place]
        else if (owned.includes(id) && outfitDef(id)?.place === place) api.wardrobe_.worn[place] = id
      }
      return copy(api.wardrobe_)
    }),
    // The server's rules (backend/app/wardrobe.py buy), in the same order
    buy: (item, key) => run(`buy ${item}`, () => {
      if (seen.has(`${state.day} ${key}`)) return { state: { ...state }, wardrobe: copy(api.wardrobe_) }
      const def = outfitDef(item)
      if (!def) throw new ApiError(404, 'unknown')
      if (def.price === undefined || def.shelf === undefined) throw new ApiError(409, 'not_for_sale')
      const owned = api.wardrobe_.owned.map(o => o.id)
      if (owned.includes(item)) throw new ApiError(409, 'owned')
      if (state.visits < state.daily_goal) throw new ApiError(409, 'locked')
      if (api.wardrobe_.bought_today) throw new ApiError(409, 'bought_today')
      if (!shelfOpen(def.shelf, owned)) throw new ApiError(409, 'shelf_locked')
      const paid = pay(def.price, state.stars, state.savings)
      if (!paid) throw new ApiError(409, 'poor')
      seen.add(`${state.day} ${key}`)
      Object.assign(state, paid)
      api.wardrobe_.owned.push({ id: item, how: 'bought', got_at: `${state.day}T10:00:00+01:00` })
      api.wardrobe_.worn[def.place] = item
      api.wardrobe_.bought_today = true
      return { state: { ...state }, wardrobe: copy(api.wardrobe_) }
    }),
    choose: id => run(`choose ${id}`, () => {
      const person = api.me_.people.find(p => p.id === id)
      if (!person) throw new ApiError(404, 'unknown_person')
      api.me_.person = person
      return { ok: true }
    }),
  }
  const copy = (w: WardrobeState): WardrobeState => JSON.parse(JSON.stringify(w))
  async function run<T>(name: string, fn: () => T): Promise<T> {
    api.calls.push(name)
    if (api.offline) throw new ApiError(0, 'offline')
    const answer = fn()
    if (api.loseAnswers) throw new ApiError(0, 'offline')
    return answer
  }
  return api
}
