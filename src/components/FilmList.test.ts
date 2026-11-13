import { describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { fakeApi } from '@/services/fakeApi'
import FilmList from './FilmList.vue'

async function open() {
  const api = fakeApi()
  api.films_ = [{ id: 1, youtube_id: 'dQw4w9WgXcQ', title: 'Lieder' }]
  const w = mount(FilmList, { props: { api } })
  await flushPromises()
  return { api, w }
}
const rows = (w: Awaited<ReturnType<typeof open>>['w']) => w.findAll('[data-test="film-row"]')

describe('FilmList', () => {
  it('shows the Cinema\'s films with their picture and name', async () => {
    const { w } = await open()
    expect(rows(w)).toHaveLength(1)
    expect(rows(w)[0].text()).toContain('Lieder')
    expect(rows(w)[0].find('img').attributes('src')).toContain('dQw4w9WgXcQ')
  })

  it('adds a film from a YouTube link, and says so', async () => {
    const { api, w } = await open()
    await w.find('[data-test="film-url"]').setValue('https://www.youtube.com/watch?v=aaaaaaaaaaa')
    await w.find('[data-test="film-title"]').setValue('Tiere')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(api.films_.map(f => f.title)).toEqual(['Lieder', 'Tiere'])
    expect(rows(w)).toHaveLength(2)
    expect((w.find('[data-test="film-url"]').element as HTMLInputElement).value).toBe('')
    expect(w.find('[data-test="film-message"]').text()).toBe('Hinzugefügt.')
    expect(w.emitted('changed')).toHaveLength(1)
  })

  it('says why a link was not taken', async () => {
    const { w } = await open()
    await w.find('[data-test="film-url"]').setValue('https://vimeo.com/1')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.find('[data-test="film-message"]').text()).toBe('Das ist kein YouTube-Link.')
    await w.find('[data-test="film-url"]').setValue('https://youtu.be/dQw4w9WgXcQ')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.find('[data-test="film-message"]').text()).toBe('Dieser Film ist schon in der Liste.')
    expect(w.emitted('changed')).toBeUndefined()
  })

  it('removes a film', async () => {
    const { api, w } = await open()
    await rows(w)[0].find('[data-test="film-remove"]').trigger('click')
    await flushPromises()
    expect(api.films_).toEqual([])
    expect(rows(w)).toHaveLength(0)
    expect(w.emitted('changed')).toHaveLength(1)
  })

  it('says when the server cannot be reached', async () => {
    const { api, w } = await open()
    api.offline = true
    await w.find('[data-test="film-url"]').setValue('https://youtu.be/bbbbbbbbbbb')
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(w.find('[data-test="film-message"]').text()).toBe('Das hat nicht geklappt. Bitte nochmal versuchen.')
  })
})
