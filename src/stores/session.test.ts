import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ApiError } from '@/services/api'
import { fakeApi } from '@/services/fakeApi'
import { useSessionStore } from './session'

const PEOPLE = [
  { id: 1, name: 'Kind', role: 'CHILD' as const, color: '#ff9a3c' },
  { id: 2, name: 'Eltern', role: 'PARENT' as const, color: '#4f8fe8' },
]

describe('session store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('is ready when the server knows who plays', async () => {
    const session = useSessionStore()
    expect(session.status).toBe('loading')
    await session.start(fakeApi())
    expect(session.status).toBe('ready')
    expect(session.person?.name).toBe('Mia')
    expect(session.isParent).toBe(false)
    expect(session.canSwitch).toBe(false)
  })

  it('asks who plays when nobody is chosen yet', async () => {
    const session = useSessionStore()
    const api = fakeApi({}, { mode: 'local', person: null, people: PEOPLE, logout_url: null })
    await session.start(api)
    expect(session.status).toBe('choose')
    expect(session.people).toEqual(PEOPLE)
    await session.choose(2)
    expect(session.status).toBe('ready')
    expect(session.isParent).toBe(true)
    expect(session.canSwitch).toBe(true)
    session.switchPerson()
    expect(session.status).toBe('choose')
  })

  it('stays on the choice when choosing fails', async () => {
    const session = useSessionStore()
    const api = fakeApi({}, { mode: 'local', person: null, people: PEOPLE, logout_url: null })
    await session.start(api)
    await session.choose(9)
    expect(session.status).toBe('choose')
  })

  it('goes to the hub to log in and comes back to this page', async () => {
    const session = useSessionStore()
    const api = fakeApi()
    api.me = async () => { throw new ApiError(401, 'not_logged_in', 'https://hub.test/?next=') }
    const go = vi.fn()
    await session.start(api, go)
    expect(session.status).toBe('leaving')
    expect(go).toHaveBeenCalledWith(`https://hub.test/?next=${encodeURIComponent(window.location.href)}`)
  })

  it.each([['no_access', 'no_access'], ['home_only', 'no_access']])('shows a closed door for %s', async code => {
    const session = useSessionStore()
    const api = fakeApi()
    api.me = async () => { throw new ApiError(403, code) }
    await session.start(api)
    expect(session.status).toBe('no_access')
  })

  it('is offline when the server does not answer, and ready once it does', async () => {
    const session = useSessionStore()
    const api = fakeApi()
    api.offline = true
    await session.start(api)
    expect(session.status).toBe('offline')
    api.offline = false
    await session.retry()
    expect(session.status).toBe('ready')
  })

  it('is offline, not in a redirect loop, for a 401 without a place to log in', async () => {
    const session = useSessionStore()
    const api = fakeApi()
    api.me = async () => { throw new ApiError(401, 'not_logged_in', null) }
    const go = vi.fn()
    await session.start(api, go)
    expect(go).not.toHaveBeenCalled()
    expect(session.status).toBe('offline')
  })
})
