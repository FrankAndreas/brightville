// A stand-in for the server in tests: the same rules in memory (backend/app/game.py), for one person.
import buildings from '../../shared/buildings.json'
import { DEFAULT_LOOK } from '@/core/look'
import { furnitureDef, furnitureShelfOpen, type Spot } from '@/core/furniture'
import { outfitDef, pay, shelfOpen, type Place } from '@/core/outfits'
import { GLYPHS } from '@/core/writing/letters'
import { applyWrite, checkText, normalizeText, type Letters } from '@/core/writing/levels'
import {
  ApiError, type Api, type Film, type LogDay, type Me, type Person, type PlayerRow, type ServerState, type StickerRow,
  type RoomState, type WardrobeState, type WritingState,
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
  /** Her room; its `bought_today` is the wardrobe's: one purchase a day across both shops */
  room_: RoomState
  /** Schreiben, as the server keeps it: `introducedOn` is the day each letter was met */
  writing_: { texts: string[]; letters: Letters; introducedOn: Record<string, string> }
  /** The server's calendar turns a page */
  newDay(day: string): void
}

const KID: Person = { id: 1, name: 'Mia', role: 'CHILD', color: '#ff66aa' }

export function fakeApi(start: Partial<ServerState> = {}, me: Partial<Me> = {}): FakeApi {
  const state: ServerState = { stars: 0, day: '2026-11-12', visits: 0, daily_goal: 2, play_seconds: 0, play_minutes: null, savings: 0, ...start }
  const seen = new Set<string>()
  /** Purchase keys of the day and what each bought: the same key for another item is key_used, as on the server */
  const purchases = new Map<string, string>()
  const replay = (key: string, item: string) => {
    const was = purchases.get(`${state.day} ${key}`)
    if (was !== undefined && was !== item) throw new ApiError(409, 'key_used')
    return was !== undefined
  }
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
    // Someone who chose her look already; a first visit sets `look: null`
    wardrobe_: { look: { ...DEFAULT_LOOK }, worn: {}, owned: [], bought_today: false },
    room_: { placed: {}, owned: [], bought_today: false },
    writing_: { texts: [], letters: {}, introducedOn: {} },
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
      if (replay(key, item)) return { state: { ...state }, wardrobe: copy(api.wardrobe_) }
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
      purchases.set(`${state.day} ${key}`, item)
      Object.assign(state, paid)
      api.wardrobe_.owned.push({ id: item, how: 'bought', got_at: `${state.day}T10:00:00+01:00` })
      api.wardrobe_.worn[def.place] = item
      api.wardrobe_.bought_today = true
      return { state: { ...state }, wardrobe: copy(api.wardrobe_) }
    }),
    room: () => run('room', () => roomCopy()),
    setPlaced: placed => run(`setPlaced ${JSON.stringify(placed)}`, () => {
      const owned = api.room_.owned.map(o => o.id)
      for (const [spot, id] of Object.entries(placed) as [Spot, string | null][]) {
        if (id === null) delete api.room_.placed[spot]
        else if (owned.includes(id) && furnitureDef(id)?.spot === spot) api.room_.placed[spot] = id
      }
      return roomCopy()
    }),
    // The server's rules (backend/app/room.py buy through shop.purchase), in the same order
    buyFurniture: (item, key) => run(`buyFurniture ${item}`, () => {
      if (replay(key, item)) return { state: { ...state }, room: roomCopy() }
      const def = furnitureDef(item)
      if (!def) throw new ApiError(404, 'unknown')
      const owned = api.room_.owned.map(o => o.id)
      if (owned.includes(item)) throw new ApiError(409, 'owned')
      if (state.visits < state.daily_goal) throw new ApiError(409, 'locked')
      if (api.wardrobe_.bought_today) throw new ApiError(409, 'bought_today')
      if (!furnitureShelfOpen(def.shelf, owned)) throw new ApiError(409, 'shelf_locked')
      const paid = pay(def.price, state.stars, state.savings)
      if (!paid) throw new ApiError(409, 'poor')
      purchases.set(`${state.day} ${key}`, item)
      Object.assign(state, paid)
      api.room_.owned.push({ id: item, got_at: `${state.day}T10:00:00+01:00` })
      api.room_.placed[def.spot] = item
      api.wardrobe_.bought_today = true
      return { state: { ...state }, room: roomCopy() }
    }),
    writing: () => run('writing', () => writingCopy()),
    // The server's rules (backend/app/writing.py record)
    sendWrites: writes => run(`sendWrites ${writes.length}`, () => {
      for (const w of writes) {
        const now = api.writing_.letters[w.glyph]
        if (!now || now.level !== w.level || writingKeys.has(w.key)) continue
        writingKeys.add(w.key)
        api.writing_.letters[w.glyph] = applyWrite(now, w.clean, `${state.day}T10:00:00+01:00`)
      }
      return writingCopy()
    }),
    introduced: (glyph, _key, day) => run(`introduced ${glyph}`, () => {
      if (!GLYPHS[glyph]) throw new ApiError(404, 'unknown')
      if (!api.writing_.letters[glyph]) {
        // The device's day, never later than the server's
        const on = day && /^\d{4}-\d{2}-\d{2}$/.test(day) && day < state.day ? day : state.day
        if (newLeft(on) <= 0) throw new ApiError(409, 'no_new_today')
        api.writing_.letters[glyph] = { level: 1, streak: 0, practised_at: null }
        api.writing_.introducedOn[glyph] = on
      }
      return writingCopy()
    }),
    playerWriting: id => run(`playerWriting ${id}`, () => writingCopy()),
    setPlayerTexts: (id, texts) => run(`setPlayerTexts ${id} ${JSON.stringify(texts)}`, () => {
      const kept: string[] = []
      for (const t of texts) {
        const problem = checkText(t, kept)
        if (problem) throw new ApiError(422, problem)
        kept.push(normalizeText(t))
      }
      api.writing_.texts = kept
      return writingCopy()
    }),
    choose: id => run(`choose ${id}`, () => {
      const person = api.me_.people.find(p => p.id === id)
      if (!person) throw new ApiError(404, 'unknown_person')
      api.me_.person = person
      return { ok: true }
    }),
  }
  const copy = (w: WardrobeState): WardrobeState => JSON.parse(JSON.stringify(w))
  // As the server answers: only owned, known pieces on their own spot; bought today in either shop
  const roomCopy = (): RoomState => {
    const owned = api.room_.owned.map(o => o.id)
    const placed = Object.fromEntries(Object.entries(api.room_.placed)
      .filter(([spot, id]) => id && owned.includes(id) && furnitureDef(id)?.spot === spot))
    return { placed, owned: api.room_.owned.map(o => ({ ...o })), bought_today: api.wardrobe_.bought_today }
  }
  const writingKeys = new Set<string>()
  // As backend/app/writing.py new_left_today
  const newLeft = (day = state.day) => {
    // The day's pace comes from the letters met before it
    const weak = Object.entries(api.writing_.letters)
      .filter(([g, l]) => l.level === 1 && (api.writing_.introducedOn[g] ?? '') < day).length
    const base = weak >= 5 ? 0 : weak >= 3 ? 1 : 2
    return Math.max(0, base - Object.values(api.writing_.introducedOn).filter(d => d === day).length)
  }
  const writingCopy = (): WritingState => ({
    texts: [...api.writing_.texts],
    letters: JSON.parse(JSON.stringify(api.writing_.letters)),
    new_left_today: newLeft(),
  })
  async function run<T>(name: string, fn: () => T): Promise<T> {
    api.calls.push(name)
    if (api.offline) throw new ApiError(0, 'offline')
    const answer = fn()
    if (api.loseAnswers) throw new ApiError(0, 'offline')
    return answer
  }
  return api
}
