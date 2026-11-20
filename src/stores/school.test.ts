import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
import { ApiError } from '@/services/api'
import { fakeApi, type FakeApi } from '@/services/fakeApi'
import { useSchoolStore } from './school'

function memory(): Storage {
  const data = new Map<string, string>()
  return {
    getItem: k => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: k => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() { return data.size },
  }
}

const zaehlen = (firstTry: boolean) => ({ ladder: 'zaehlen' as const, firstTry })
const rechnen = (firstTry: boolean) => ({ ladder: 'rechnen' as const, firstTry })
const AT_START = { zaehlen: 1, rechnen: 1 }

describe('school store', () => {
  let api: FakeApi
  let storage: Storage
  const open = async (personId = 2) => {
    const school = useSchoolStore()
    school.init(api, personId, storage)
    await school.load()
    return school
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    api = fakeApi()
    storage = memory()
  })

  it('starts at step 1 before the server answers, then takes the server\'s steps', async () => {
    api.school_ = { zaehlen: { step: 3, window: [] }, rechnen: { step: 2, window: [true] }, reimen: { step: 1, window: [] }, muster: { step: 1, window: [] }, zeit: { step: 1, window: [] } }
    const school = useSchoolStore()
    school.init(api, 2, storage)
    expect(school.ladders.zaehlen.step).toBe(1)
    await school.load()
    expect(school.ladders).toEqual(api.school_)
  })

  it('moves a step at once and sends one result with a key', async () => {
    const school = await open()
    school.record([zaehlen(true), zaehlen(true), zaehlen(true), rechnen(true)], AT_START)
    school.record([zaehlen(true), zaehlen(true), zaehlen(true), rechnen(true)], AT_START)
    expect(school.ladders.zaehlen).toEqual({ step: 2, window: [] })
    expect(school.ladders.rechnen).toEqual({ step: 1, window: [true, true] })
    await flushPromises()
    expect(api.calls.filter(c => c.startsWith('schoolResults'))).toHaveLength(2)
    expect(api.school_.zaehlen.step).toBe(2)
    expect(storage.getItem('brightville.school.2')).toBeNull()
  })

  it('keeps a result the server didn\'t get and sends it again with the same key on the next load', async () => {
    const school = await open()
    api.offline = true
    school.record([rechnen(true), rechnen(true)], AT_START)
    await flushPromises()
    expect(storage.getItem('brightville.school.2')).not.toBeNull()
    api.offline = false
    await school.load()
    expect(api.school_.rechnen.window).toEqual([true, true])
    expect(storage.getItem('brightville.school.2')).toBeNull()
    // A lost answer: the server has it, the device sends it again, it counts once
    api.loseAnswers = true
    school.record([rechnen(true)], AT_START)
    await flushPromises()
    api.loseAnswers = false
    await school.load()
    expect(api.school_.rechnen.window).toEqual([true, true, true])
    expect(school.ladders.rechnen.window).toEqual([true, true, true])
  })

  it('lays what still waits over the server\'s steps', async () => {
    const school = await open()
    api.offline = true
    school.record([rechnen(true), rechnen(true)], AT_START)
    await flushPromises()
    await school.load()
    expect(school.ladders.rechnen.window).toEqual([true, true])
  })

  it('sends the result for the child who played', async () => {
    const school = await open(2)
    api.offline = true
    school.record([rechnen(true), rechnen(true)], AT_START)
    school.init(api, 3, storage)
    await flushPromises()
    expect(storage.getItem('brightville.school.2')).not.toBeNull()
    expect(storage.getItem('brightville.school.3')).toBeNull()
    expect(school.ladders.rechnen.window).toEqual([])
  })

  it('records nothing for a visit with no answers', async () => {
    const school = await open()
    school.record([], AT_START)
    await flushPromises()
    expect(api.calls.filter(c => c.startsWith('schoolResults'))).toEqual([])
  })

  it('lets go of a result the server has even when the answer to it was lost', async () => {
    const school = await open()
    api.loseAnswers = true
    school.record([rechnen(true)], AT_START)
    await flushPromises()
    api.loseAnswers = false
    school.record([rechnen(true)], AT_START)
    await flushPromises()
    // Two on the server, two here: the first isn't laid over the server's answer a second time
    expect(api.school_.rechnen.window).toEqual([true, true])
    expect(school.ladders.rechnen.window).toEqual([true, true])
    expect(storage.getItem('brightville.school.2')).toBeNull()
  })

  it('doesn\'t take an older answer over a newer one', async () => {
    const school = useSchoolStore()
    school.init(api, 2, storage)
    let answerGet: (v: unknown) => void = () => {}
    const realSchool = api.school
    const old = { ...JSON.parse(JSON.stringify(api.school_)), seen: [] }
    api.school = () => new Promise(resolve => { answerGet = resolve as (v: unknown) => void })
    const loading = school.load()
    await flushPromises()
    school.record([rechnen(true), rechnen(true)], AT_START)
    await flushPromises()
    expect(school.ladders.rechnen.window).toEqual([true, true])
    answerGet(old)
    await loading
    expect(school.ladders.rechnen.window).toEqual([true, true])
    api.school = realSchool
  })

  it('goes on loading when the server refuses a result that waited', async () => {
    storage.setItem('brightville.school.2', JSON.stringify([
      { key: 'bad', zaehlen: { step: 1, results: [true] }, rechnen: { step: 1, results: [] } },
    ]))
    api.school_.zaehlen = { step: 4, window: [] }
    api.schoolResults = () => Promise.reject(new ApiError(422, 'invalid'))
    const school = await open()
    expect(school.ladders.zaehlen.step).toBe(4)
    expect(storage.getItem('brightville.school.2')).toBeNull()
  })

  it('keeps a visit\'s answers for the child who started it', async () => {
    const school = await open(3)
    school.record([rechnen(true), rechnen(true)], AT_START, 2)
    await flushPromises()
    expect(api.calls.filter(c => c.startsWith('schoolResults'))).toEqual([])
    expect(school.ladders.rechnen.window).toEqual([])
    expect(JSON.parse(storage.getItem('brightville.school.2') ?? '[]')).toHaveLength(1)
  })

  it('sends a Reimhaus visit with only Reimen', async () => {
    const school = await open()
    school.record(Array(5).fill({ ladder: 'reimen', firstTry: true }), { reimen: 1 })
    await flushPromises()
    expect(api.school_.reimen.window).toHaveLength(5)
    expect(school.ladders.reimen.window).toHaveLength(5)
    expect(api.school_.zaehlen).toEqual({ step: 1, window: [] })
  })

  it('takes cached steps and waiting results from before Reimen', async () => {
    storage.setItem('brightville.school.2.ladders', JSON.stringify({ zaehlen: { step: 3, window: [] }, rechnen: { step: 2, window: [] } }))
    storage.setItem('brightville.school.2', JSON.stringify([
      { key: 'old', zaehlen: { step: 1, results: [] }, rechnen: { step: 1, results: [true] } },
    ]))
    api.offline = true
    const school = await open()
    expect(school.ladders.zaehlen.step).toBe(3)
    expect(school.ladders.reimen).toEqual({ step: 1, window: [] })
    api.offline = false
    await school.load()
    expect(api.school_.rechnen.window).toEqual([true])
  })

  it('leaves out a waiting result with a broken ladder', async () => {
    storage.setItem('brightville.school.2', JSON.stringify([
      { key: 'broken', reimen: { step: 1, results: ['yes'] } },
      { key: 'empty' },
    ]))
    await open()
    expect(api.calls.filter(c => c.startsWith('schoolResults'))).toEqual([])
  })

  it('keeps Reimen at step 1 when a server from before Reimen answers', async () => {
    const school = await open()
    const old = { zaehlen: { step: 2, window: [] }, rechnen: { step: 1, window: [] }, seen: [] }
    api.school = () => Promise.resolve(old as never)
    await school.load()
    expect(school.ladders.zaehlen.step).toBe(2)
    expect(school.ladders.reimen).toEqual({ step: 1, window: [] })
  })

  it('sends a Musterwerkstatt visit with only Muster', async () => {
    const school = await open()
    school.record(Array(5).fill({ ladder: 'muster', firstTry: true }), { muster: 1 })
    await flushPromises()
    expect(api.school_.muster.window).toHaveLength(5)
    expect(api.school_.reimen).toEqual({ step: 1, window: [] })
  })

  it('takes cached steps from before Muster', async () => {
    storage.setItem('brightville.school.2.ladders', JSON.stringify({
      zaehlen: { step: 3, window: [] }, rechnen: { step: 2, window: [] }, reimen: { step: 4, window: [true] },
    }))
    api.offline = true
    const school = await open()
    expect(school.ladders.reimen).toEqual({ step: 4, window: [true] })
    expect(school.ladders.muster).toEqual({ step: 1, window: [] })
  })

  it('keeps Muster at step 1 when a server from before Muster answers', async () => {
    const school = await open()
    const old = { zaehlen: { step: 2, window: [] }, rechnen: { step: 1, window: [] }, reimen: { step: 3, window: [] }, seen: [] }
    api.school = () => Promise.resolve(old as never)
    await school.load()
    expect(school.ladders.reimen.step).toBe(3)
    expect(school.ladders.muster).toEqual({ step: 1, window: [] })
  })

  it('sends a Kalender visit with only Zeit, and starts Zeit at 1 from cached steps before it', async () => {
    storage.setItem('brightville.school.2.ladders', JSON.stringify({ zaehlen: { step: 3, window: [] }, rechnen: { step: 2, window: [] } }))
    api.offline = true
    const school = await open()
    expect(school.ladders.zeit).toEqual({ step: 1, window: [] })
    api.offline = false
    school.record(Array(5).fill({ ladder: 'zeit', firstTry: true }), { zeit: 1 })
    await flushPromises()
    expect(api.school_.zeit.window).toHaveLength(5)
  })

  it('starts from the steps last known on this device', async () => {
    api.school_.zaehlen = { step: 3, window: [] }
    await open()
    setActivePinia(createPinia())
    api.offline = true
    const school = await open()
    expect(school.ladders.zaehlen.step).toBe(3)
  })
})

