import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { fakeApi } from '@/services/fakeApi'
import ParentArea from './ParentArea.vue'

const ROWS = [
  { id: 2, name: 'Mia', role: 'CHILD' as const, color: '#ff66aa', stars: 4, day: '2026-11-12', visits: 1, daily_goal: 2, play_seconds: 125, play_minutes: 30, savings: 0 },
  { id: 1, name: 'Papa', role: 'PARENT' as const, color: null, stars: 0, day: '2026-11-12', visits: 0, daily_goal: 2, play_seconds: 0, play_minutes: null, savings: 0 },
]

async function open(props: Record<string, unknown> = {}) {
  const api = fakeApi()
  api.rows = ROWS.map(r => ({ ...r }))
  const w = mount(ParentArea, { props: { api, ...props } })
  await flushPromises()
  return { api, w }
}
const card = (w: Awaited<ReturnType<typeof open>>['w'], id: number) => w.find(`[data-test="parent-card"][data-id="${id}"]`)

describe('ParentArea', () => {
  it('shows each person with today\'s numbers and the settings', async () => {
    const { w } = await open()
    expect(w.findAll('[data-test="parent-card"]')).toHaveLength(2)
    expect(card(w, 2).text()).toContain('Mia')
    expect(card(w, 2).text()).toContain('Heute: 1 von 2 Lernbesuchen, 2 Minuten gespielt')
    expect((card(w, 2).find('[data-test="stars-input"]').element as HTMLInputElement).value).toBe('4')
    expect((card(w, 2).find('[data-test="minutes"]').element as HTMLSelectElement).value).toBe('30')
    // A parent keeps only their Stars here: no daily goal, no play time
    expect(card(w, 1).find('[data-test="goal"]').exists()).toBe(false)
    expect(card(w, 1).find('[data-test="minutes"]').exists()).toBe(false)
    expect(card(w, 1).find('[data-test="stars-input"]').exists()).toBe(true)
  })

  it('shows a child\'s savings and her add-ons, to read only', async () => {
    const api = fakeApi()
    api.rows = ROWS.map(r => (r.id === 2 ? { ...r, stars: 160, savings: 140, owned: ['schleife', 'gibtsnicht'] } : { ...r }))
    const w = mount(ParentArea, { props: { api } })
    await flushPromises()
    expect(card(w, 2).text()).toContain('davon gespart: 140')
    expect(card(w, 2).find('[data-test="owned"]').text()).toBe('🎀')
    expect(card(w, 1).find('[data-test="owned"]').exists()).toBe(false)
  })

  it('saves the settings of one person', async () => {
    const { api, w } = await open()
    await card(w, 2).find('[data-test="goal"]').setValue(3)
    await card(w, 2).find('[data-test="minutes"]').setValue('20')
    await card(w, 2).find('[data-test="stars-input"]').setValue(12)
    await card(w, 2).find('[data-test="save"]').trigger('click')
    await flushPromises()
    expect(api.calls).toContain('setRules 2 {"daily_goal":3,"play_minutes":20,"stars":12}')
    expect(card(w, 2).find('[data-test="message"]').text()).toBe('Gespeichert.')
    expect(w.emitted('saved')).toEqual([[2]])
  })

  it('can take the limit off again', async () => {
    const { api, w } = await open()
    // the first choice, "Ohne Grenze"
    const select = card(w, 2).find('[data-test="minutes"]')
    ;(select.element as HTMLSelectElement).selectedIndex = 0
    await select.trigger('change')
    await card(w, 2).find('[data-test="save"]').trigger('click')
    await flushPromises()
    // The Stars weren't touched: they aren't sent, so Stars earned meanwhile stay
    expect(api.calls.at(-1)).toBe('setRules 2 {"daily_goal":2,"play_minutes":null}')
  })

  it('does not send a Star count out of range', async () => {
    const { api, w } = await open()
    await card(w, 2).find('[data-test="stars-input"]').setValue(-5)
    await card(w, 2).find('[data-test="save"]').trigger('click')
    await flushPromises()
    expect(api.calls.some(c => c.startsWith('setRules'))).toBe(false)
    expect(card(w, 2).find('[data-test="message"]').text()).toContain('0 bis 9999')
  })

  it('says so when saving fails', async () => {
    const { api, w } = await open()
    api.offline = true
    await card(w, 2).find('[data-test="save"]').trigger('click')
    await flushPromises()
    expect(card(w, 2).find('[data-test="message"]').text()).toContain('nicht geklappt')
  })

  it('offers loading again when the list fails', async () => {
    const api = fakeApi()
    api.offline = true
    const w = mount(ParentArea, { props: { api } })
    await flushPromises()
    expect(w.find('[data-test="parent-reload"]').exists()).toBe(true)
    api.offline = false
    api.rows = ROWS.map(r => ({ ...r }))
    await w.find('[data-test="parent-reload"]').trigger('click')
    await flushPromises()
    expect(w.findAll('[data-test="parent-card"]')).toHaveLength(2)
  })

  it('offers switching only without a hub and logging out only with one', async () => {
    let { w } = await open({ canSwitch: true })
    expect(w.find('[data-test="switch"]').exists()).toBe(true)
    expect(w.find('[data-test="logout"]').exists()).toBe(false)
    ;({ w } = await open({ logoutUrl: 'https://hub/logout?next=' }))
    expect(w.find('[data-test="switch"]').exists()).toBe(false)
    expect(w.find('[data-test="logout"]').exists()).toBe(true)
  })

  it('closes', async () => {
    const { w } = await open()
    await w.find('[data-test="parent-close"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('has the Cinema\'s film list, and passes on when it changed', async () => {
    const { w } = await open()
    const list = w.findComponent({ name: 'FilmList' })
    expect(list.exists()).toBe(true)
    list.vm.$emit('changed')
    expect(w.emitted('filmsChanged')).toHaveLength(1)
  })

  it('shows a child\'s last days and stickers as text when the logbook is opened', async () => {
    const { api, w } = await open()
    api.logbook_ = [{
      day: '2026-11-12', goal_reached: true, stickers: ['buecherwurm'], paintings: [],
      entries: [{ building: 'school', kind: 'visit', stars: 7, at: '15:00' }, { building: 'arcade', kind: 'play', stars: -3, at: '16:00' }],
    }]
    api.stickers_ = [{ id: 'buecherwurm', earned_at: '2026-11-12T10:00:00+01:00', seen: false }]
    expect(api.calls.filter(c => c.startsWith('diary'))).toEqual([])
    const diary = card(w, 2).find('[data-test="diary"]')
    ;(diary.element as HTMLDetailsElement).open = true
    await diary.trigger('toggle')
    await flushPromises()
    expect(api.calls).toContain('diary 2')
    expect(diary.findAll('[data-test="diary-day"]').map(d => d.text())).toEqual([
      'Do 12.11.: Schule +7, Spielhalle −3. Tagesziel erreicht. Neuer Sticker: Bücherwurm.',
    ])
    expect(diary.find('[data-test="diary-stickers"]').text()).toBe('Sticker: Bücherwurm (12.11.)')
  })

  it('says so when a child has no logbook yet', async () => {
    const { w } = await open()
    const diary = card(w, 2).find('[data-test="diary"]')
    ;(diary.element as HTMLDetailsElement).open = true
    await diary.trigger('toggle')
    await flushPromises()
    expect(diary.text()).toContain('Noch nichts eingetragen.')
  })
})

