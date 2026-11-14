import { describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { fakeApi, type FakeApi } from '@/services/fakeApi'
import WritingSettings from './WritingSettings.vue'

async function open(api: FakeApi): Promise<VueWrapper> {
  const w = mount(WritingSettings, { props: { api, personId: 2 } })
  const details = w.find('[data-test="writing"]')
  ;(details.element as HTMLDetailsElement).open = true
  await details.trigger('toggle')
  await flushPromises()
  return w
}
const items = (w: VueWrapper) => w.findAll('[data-test="text-item"]').map(i => i.find('[data-test="text"]').text())
async function add(w: VueWrapper, text: string) {
  await w.find('[data-test="new-text"]').setValue(text)
  await w.find('[data-test="add-text"]').trigger('click')
  await flushPromises()
}

describe('WritingSettings', () => {
  it('loads her texts only when opened', async () => {
    const api = fakeApi()
    api.writing_.texts = ['MIA', 'LENA']
    const w = mount(WritingSettings, { props: { api, personId: 2 } })
    expect(api.calls.filter(c => c.startsWith('playerWriting'))).toEqual([])
    const details = w.find('[data-test="writing"]')
    ;(details.element as HTMLDetailsElement).open = true
    await details.trigger('toggle')
    await flushPromises()
    expect(api.calls).toContain('playerWriting 2')
    expect(items(w)).toEqual(['MIA', 'LENA'])
  })

  it('adds a text in capitals', async () => {
    const api = fakeApi()
    api.writing_.texts = ['MIA']
    const w = await open(api)
    await add(w, 'lena')
    expect(api.calls).toContain('setPlayerTexts 2 ["MIA","LENA"]')
    expect(items(w)).toEqual(['MIA', 'LENA'])
    expect((w.find('[data-test="new-text"]').element as HTMLInputElement).value).toBe('')
  })

  it.each([
    ['Grüße', 'Nur Buchstaben A–Z, Ä, Ö, Ü, Zahlen und Leerzeichen (kein ß, keine Satzzeichen).'],
    ['  ', 'Bitte etwas eingeben.'],
    ['A'.repeat(31), 'Höchstens 30 Zeichen.'],
    ['mia', 'Das steht schon in der Liste.'],
  ])('refuses %j with a reason, sending nothing', async (text, reason) => {
    const api = fakeApi()
    api.writing_.texts = ['MIA']
    const w = await open(api)
    await add(w, text)
    expect(w.find('[data-test="writing-message"]').text()).toBe(reason)
    expect(api.calls.filter(c => c.startsWith('setPlayerTexts'))).toEqual([])
  })

  it('refuses a 21st text', async () => {
    const api = fakeApi()
    api.writing_.texts = Array.from({ length: 20 }, (_, i) => `A${i}`)
    const w = await open(api)
    await add(w, 'BEN')
    expect(w.find('[data-test="writing-message"]').text()).toBe('Höchstens 20 Einträge.')
  })

  it('moves a text up and removes one', async () => {
    const api = fakeApi()
    api.writing_.texts = ['MIA', 'LENA', 'BEN']
    const w = await open(api)
    await w.findAll('[data-test="text-item"]')[2].find('[data-test="text-up"]').trigger('click')
    await flushPromises()
    expect(items(w)).toEqual(['MIA', 'BEN', 'LENA'])
    await w.findAll('[data-test="text-item"]')[0].find('[data-test="text-remove"]').trigger('click')
    await flushPromises()
    expect(items(w)).toEqual(['BEN', 'LENA'])
    expect(api.writing_.texts).toEqual(['BEN', 'LENA'])
  })

  it('moves a text down', async () => {
    const api = fakeApi()
    api.writing_.texts = ['MIA', 'LENA', 'BEN']
    const w = await open(api)
    await w.findAll('[data-test="text-item"]')[0].find('[data-test="text-down"]').trigger('click')
    await flushPromises()
    expect(items(w)).toEqual(['LENA', 'MIA', 'BEN'])
    expect(w.findAll('[data-test="text-item"]')[2].find('[data-test="text-down"]').attributes('disabled')).toBeDefined()
  })

  it('says so when saving fails, and keeps the list as it was', async () => {
    const api = fakeApi()
    api.writing_.texts = ['MIA']
    const w = await open(api)
    api.offline = true
    await add(w, 'BEN')
    expect(w.find('[data-test="writing-message"]').text()).toBe('Konnte nicht speichern. Nochmal versuchen?')
    expect(items(w)).toEqual(['MIA'])
  })

  it('shows every letter and digit with her level', async () => {
    const api = fakeApi()
    api.writing_.letters = { M: { level: 4, streak: 0, practised_at: null }, I: { level: 2, streak: 1, practised_at: null } }
    const w = await open(api)
    const tiles = w.findAll('[data-test="letter-tile"]')
    expect(tiles).toHaveLength(39)
    const level = (c: string) => tiles.find(t => t.text() === c)?.attributes('data-level')
    expect(level('M')).toBe('4')
    expect(level('I')).toBe('2')
    expect(level('A')).toBe('0')
    expect(level('7')).toBe('0')
  })
})
