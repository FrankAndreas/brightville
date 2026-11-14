import { describe, expect, it, vi } from 'vitest'
import { ApiError, httpApi } from './api'

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

const STATE = { stars: 3, day: '2026-11-12', visits: 1, daily_goal: 2, play_seconds: 0, play_minutes: null }

describe('httpApi', () => {
  it('asks who is playing', async () => {
    const me = { mode: 'local', person: null, people: [], login_url: null, logout_url: null }
    const fetchFn = vi.fn(async () => json(200, me))
    expect(await httpApi(fetchFn).me()).toEqual(me)
    expect(fetchFn).toHaveBeenCalledWith('/api/me', expect.objectContaining({ method: 'GET', credentials: 'same-origin' }))
  })

  it('sends changes as JSON with the header the server asks for', async () => {
    const fetchFn = vi.fn(async () => json(200, { state: STATE, goal_reached_now: true }))
    const answer = await httpApi(fetchFn).visit('school', 7, 'k1')
    expect(answer).toEqual({ state: STATE, goal_reached_now: true })
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/visits')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ building: 'school', stars: 7, key: 'k1' })
    expect(new Headers(init.headers).get('X-Requested-With')).toBe('brightville')
  })

  it('gives up on a write for Schreiben that hangs, as offline', async () => {
    vi.useFakeTimers()
    try {
      const api = httpApi((_url, init) => new Promise((_, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      }))
      const writes = api.sendWrites([{ key: 'k', glyph: 'L', level: 1, clean: true }])
      const intro = api.introduced('L', 'k')
      const caught = Promise.all([writes.catch(e => e), intro.catch(e => e)])
      await vi.advanceTimersByTimeAsync(15_000)
      expect(await caught).toEqual([
        expect.objectContaining({ status: 0, code: 'offline' }),
        expect.objectContaining({ status: 0, code: 'offline' }),
      ])
    } finally {
      vi.useRealTimers()
    }
  })

  it('turns a refusal into an error with the server\'s code', async () => {
    const api = httpApi(async () => json(409, { detail: { code: 'poor' } }))
    await expect(api.play('arcade', 'k')).rejects.toMatchObject({ status: 409, code: 'poor' })
    await expect(api.play('arcade', 'k')).rejects.toBeInstanceOf(ApiError)
  })

  it('passes on where to log in', async () => {
    const api = httpApi(async () => json(401, { detail: { code: 'not_logged_in', login_url: 'https://hub/?next=' } }))
    await expect(api.me()).rejects.toMatchObject({ status: 401, code: 'not_logged_in', loginUrl: 'https://hub/?next=' })
  })

  it('passes on when a visit that came too soon may be sent again', async () => {
    const api = httpApi(async () => json(409, { detail: { code: 'too_soon', retry_after: 12 } }))
    await expect(api.visit('school', 5, 'k')).rejects.toMatchObject({ status: 409, code: 'too_soon', retryAfter: 12 })
  })

  it('calls a server that does not answer, or answers nonsense, offline', async () => {
    await expect(httpApi(async () => { throw new TypeError('failed') }).state()).rejects.toMatchObject({ status: 0, code: 'offline' })
    await expect(httpApi(async () => new Response('<html>', { status: 502 })).state()).rejects.toMatchObject({ status: 502, code: 'offline' })
    await expect(httpApi(async () => new Response('<html>', { status: 200 })).state()).rejects.toMatchObject({ code: 'offline' })
  })

  it('tells when the hub login wants renewing', async () => {
    const onRenew = vi.fn()
    await httpApi(async () => json(200, STATE, { 'X-Hub-Renew': '1' }), onRenew).state()
    expect(onRenew).toHaveBeenCalledTimes(1)
  })

  it('knows the other requests', async () => {
    const fetchFn = vi.fn(async () => json(200, STATE))
    const api = httpApi(fetchFn)
    await api.playTime(30)
    await api.players()
    await api.setRules(2, { daily_goal: 1, play_minutes: 20, stars: 5 })
    await api.choose(1)
    expect(fetchFn.mock.calls.map(c => [(c as unknown as [string, RequestInit])[0], (c as unknown as [string, RequestInit])[1].method])).toEqual([
      ['/api/playtime', 'POST'], ['/api/players', 'GET'], ['/api/players/2', 'PUT'], ['/api/local/choose', 'POST'],
    ])
  })

  it('knows the film list', async () => {
    const fetchFn = vi.fn(async () => json(200, []))
    const api = httpApi(fetchFn)
    await api.films()
    await api.addFilm('https://youtu.be/dQw4w9WgXcQ', 'Lieder')
    await api.removeFilm(4)
    const calls = fetchFn.mock.calls.map(c => c as unknown as [string, RequestInit])
    expect(calls.map(([url, init]) => [url, init.method])).toEqual([
      ['/api/films', 'GET'], ['/api/films', 'POST'], ['/api/films/4', 'DELETE'],
    ])
    expect(JSON.parse(calls[1][1].body as string)).toEqual({ url: 'https://youtu.be/dQw4w9WgXcQ', title: 'Lieder' })
  })

  it('knows the paintings', async () => {
    const fetchFn = vi.fn(async () => json(200, []))
    const api = httpApi(fetchFn)
    await api.paintings()
    await api.keepPainting('p-1', 'data:image/png;base64,AA', 'data:image/jpeg;base64,BB')
    await api.removePainting('p-1')
    const calls = fetchFn.mock.calls.map(c => c as unknown as [string, RequestInit])
    expect(calls.map(([url, init]) => [url, init.method])).toEqual([
      ['/api/paintings', 'GET'], ['/api/paintings/p-1', 'PUT'], ['/api/paintings/p-1', 'DELETE'],
    ])
    expect(JSON.parse(calls[1][1].body as string)).toEqual({ image: 'data:image/png;base64,AA', thumb: 'data:image/jpeg;base64,BB' })
  })

  it('knows free visits, stickers, the logbook and a child\'s diary', async () => {
    const fetchFn = vi.fn(async () => json(200, []))
    const api = httpApi(fetchFn)
    await api.freeVisit('malen', 'k1')
    await api.stickers()
    await api.stickersSeen(['buecherwurm'])
    await api.logbook()
    await api.logbook('2026-11-06', 3)
    await api.diary(2)
    const calls = fetchFn.mock.calls.map(c => c as unknown as [string, RequestInit])
    expect(calls.map(([url, init]) => [url, init.method])).toEqual([
      ['/api/free-visits', 'POST'], ['/api/stickers', 'GET'], ['/api/stickers/seen', 'POST'],
      ['/api/logbook?days=7', 'GET'], ['/api/logbook?days=3&before=2026-11-06', 'GET'], ['/api/players/2/diary', 'GET'],
    ])
    expect(JSON.parse(calls[0][1].body as string)).toEqual({ building: 'malen', key: 'k1' })
    expect(JSON.parse(calls[2][1].body as string)).toEqual({ ids: ['buecherwurm'] })
  })
})
