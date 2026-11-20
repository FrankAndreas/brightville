import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { flushPromises } from '@vue/test-utils'
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
    api.school_ = { zaehlen: { step: 3, window: [] }, rechnen: { step: 2, window: [true] } }
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
})
