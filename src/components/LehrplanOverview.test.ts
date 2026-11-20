import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { fakeApi, type FakeApi } from '@/services/fakeApi'
import LehrplanOverview from './LehrplanOverview.vue'

const known = { level: 4 as const, streak: 0, practised_at: null }

async function open(api: FakeApi): Promise<VueWrapper> {
  const w = mount(LehrplanOverview, { props: { api, personId: 2 } })
  const details = w.find('[data-test="lehrplan"]')
  ;(details.element as HTMLDetailsElement).open = true
  await details.trigger('toggle')
  await flushPromises()
  return w
}

describe('LehrplanOverview', () => {
  let api: FakeApi
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 20, 10, 0))
    api = fakeApi()
    api.school_ = { zaehlen: { step: 3, window: [] }, rechnen: { step: 2, window: [] }, reimen: { step: 1, window: [] }, muster: { step: 1, window: [] }, zeit: { step: 1, window: [] }, raum: { step: 1, window: [] } }
    api.writing_.letters = { M: known, I: known, A: known }
    api.logbook_ = [
      { day: '2026-11-19', goal_reached: true, stickers: [], paintings: [], entries: [
        { building: 'yoga', kind: 'visit', stars: 3, at: '09:00' },
        { building: 'yoga', kind: 'visit', stars: 3, at: '10:00' },
        { building: 'malen', kind: 'free', stars: 0, at: '11:00' },
        { building: 'school', kind: 'visit', stars: 6, at: '12:00' },
      ] },
    ]
  })
  afterEach(() => vi.useRealTimers())

  it('loads nothing until opened, then each part once', async () => {
    const w = mount(LehrplanOverview, { props: { api, personId: 2 } })
    expect(api.calls).toEqual([])
    w.unmount()
    await open(api)
    expect(api.calls.sort()).toEqual(['diary 2', 'playerSchool 2', 'playerWriting 2'])
  })

  it('shows the overall number with the end of Kindergarten, the steps and the letters', async () => {
    const w = await open(api)
    // (0.4 + 0.2 + 0 + 0 + 0 + 0 + 3/29) / 7
    expect(w.find('[data-test="lehrplan-percent"]').text()).toBe('10 %')
    expect(w.find('[data-test="lehrplan-bar"]').attributes('style')).toContain('width: 10%')
    expect(w.find('[data-test="lehrplan-kg"]').attributes('style')).toContain('left: 54%')
    expect(w.find('[data-test="ladder-zaehlen"]').text()).toContain('Stufe 3 von 5')
    expect(w.find('[data-test="ladder-zaehlen"]').text()).toContain('vor- und rückwärts bis 20')
    expect(w.find('[data-test="ladder-rechnen"]').text()).toContain('plus bis 10')
    expect(w.find('[data-test="letters"]').text()).toContain('3 von 29 gelernt')
  })

  it('shows the other subjects and this week by Zugang', async () => {
    const w = await open(api)
    const subjects = w.findAll('[data-test="subject"]').map(s => s.text())
    expect(subjects).toContain('Mathematik: Schule ×1')
    expect(subjects).toContain('Musik: –')
    expect(subjects).toContain('Bildnerisches Gestalten: Malen ×1')
    expect(subjects).toContain('Bewegung und Sport: Yoga ×2')
    const zugaenge = w.findAll('[data-test="zugang"]').map(z => z.text())
    expect(zugaenge).toContain('✓ Körper, Gesundheit und Motorik (Yoga ×2)')
    expect(zugaenge).toContain('– Lernen und Reflexion (noch kein Haus)')
    expect(zugaenge).toContain('– Zeitliche Orientierung')
    expect(zugaenge).toContain('– Wahrnehmung')
  })

  it('sets a step and shows what the server kept', async () => {
    const w = await open(api)
    await w.find('[data-test="step-zaehlen"]').setValue('4')
    await flushPromises()
    expect(api.calls).toContain('setPlayerStep 2 zaehlen 4')
    expect(w.find('[data-test="ladder-zaehlen"]').text()).toContain('Stufe 4 von 5')
  })

  it('says so when a step could not be saved, and keeps the old one', async () => {
    const w = await open(api)
    api.offline = true
    await w.find('[data-test="step-rechnen"]').setValue('6')
    await flushPromises()
    expect(w.find('[data-test="lehrplan-message"]').text()).toBe('Konnte nicht speichern. Nochmal versuchen?')
    expect(w.find('[data-test="ladder-rechnen"]').text()).toContain('Stufe 2 von 5')
    expect((w.find('[data-test="step-rechnen"]').element as HTMLSelectElement).value).toBe('2')
  })

  it('shows Reimen under Deutsch and sets its step', async () => {
    api.school_.reimen = { step: 2, window: [] }
    const w = await open(api)
    const deutsch = w.find('[data-test="deutsch"]')
    expect(deutsch.find('[data-test="ladder-reimen"]').text()).toContain('Stufe 2 von 5')
    expect(deutsch.find('[data-test="ladder-reimen"]').text()).toContain('reimt sich? aus drei Bildern')
    await w.find('[data-test="step-reimen"]').setValue('5')
    await flushPromises()
    expect(api.calls).toContain('setPlayerStep 2 reimen 5')
    expect(w.find('[data-test="ladder-reimen"]').text()).toContain('Stufe 5 von 5')
  })

  it('shows Muster under Mathematik and sets its step', async () => {
    api.school_.muster = { step: 3, window: [] }
    const w = await open(api)
    const mathe = w.find('[data-test="mathe"]')
    expect(mathe.find('[data-test="ladder-muster"]').text()).toContain('Stufe 3 von 5')
    expect(mathe.find('[data-test="ladder-muster"]').text()).toContain('Reihen mit Formen und Grössen')
    await w.find('[data-test="step-muster"]').setValue('5')
    await flushPromises()
    expect(api.calls).toContain('setPlayerStep 2 muster 5')
  })

  it('shows Zeit under Mathematik and sets its step', async () => {
    api.school_.zeit = { step: 4, window: [] }
    const w = await open(api)
    const row = w.find('[data-test="mathe"] [data-test="ladder-zeit"]')
    expect(row.text()).toContain('Stufe 4 von 5')
    expect(row.text()).toContain('gestern, morgen, Jahreszeiten')
    await w.find('[data-test="step-zeit"]').setValue('2')
    await flushPromises()
    expect(api.calls).toContain('setPlayerStep 2 zeit 2')
  })

  it('shows Raum under Mathematik and sets its step', async () => {
    api.school_.raum = { step: 2, window: [] }
    const w = await open(api)
    const row = w.find('[data-test="mathe"] [data-test="ladder-raum"]')
    expect(row.text()).toContain('Stufe 2 von 5')
    expect(row.text()).toContain('neben, vor, hinter')
    await w.find('[data-test="step-raum"]').setValue('4')
    await flushPromises()
    expect(api.calls).toContain('setPlayerStep 2 raum 4')
  })

  it('shows "fertig" at the last step', async () => {
    api.school_.zaehlen = { step: 6, window: [] }
    const w = await open(api)
    expect(w.find('[data-test="ladder-zaehlen"]').text()).toContain('fertig')
  })
})
