import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AccentKeys, { ACCENTS } from './AccentKeys.vue'

describe('AccentKeys', () => {
  it('has the French accented letters', () => {
    expect(ACCENTS).toEqual(['é', 'è', 'ê', 'à', 'â', 'ç', 'ô', 'î', 'û', 'ë', 'ï', 'ù', 'œ'])
  })

  it('types a letter at the caret, keeps the focus and tells the field', async () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.value = "l'cole"
    input.focus()
    input.setSelectionRange(2, 2)
    const typed: string[] = []
    input.addEventListener('input', () => typed.push(input.value))
    const w = mount(AccentKeys, { props: { target: input }, attachTo: document.body })
    const down = new PointerEvent('pointerdown', { bubbles: true, cancelable: true })
    w.find('[data-key="é"]').element.dispatchEvent(down)
    expect(down.defaultPrevented).toBe(true)
    expect(input.value).toBe("l'école")
    expect(input.selectionStart).toBe(3)
    expect(typed).toEqual(["l'école"])
    w.unmount()
    input.remove()
  })

  it('replaces a selection', () => {
    const input = document.createElement('input')
    input.value = 'fenxtre'
    input.setSelectionRange(3, 4)
    const w = mount(AccentKeys, { props: { target: input } })
    w.find('[data-key="ê"]').element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }))
    expect(input.value).toBe('fenêtre')
    w.unmount()
  })
})
