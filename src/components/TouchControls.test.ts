import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { touchIntents } from '@/input/touch'
import TouchControls from './TouchControls.vue'

const open = () => {
  const source = touchIntents()
  const w = mount(TouchControls, { props: { source } })
  return { source, w, area: w.find('[data-test="stick-area"]') }
}
const at = (pointerId: number, clientX: number, clientY: number) => ({ pointerId, clientX, clientY })
type Area = ReturnType<typeof open>['area']
/** A real pointer event: its position can't be set on an event after the fact */
async function send(area: Area, type: string, init: PointerEventInit) {
  area.element.dispatchEvent(new PointerEvent(type, { bubbles: true, ...init }))
  await nextTick()
}

describe('TouchControls', () => {
  it('walks where the finger is dragged from where it landed', async () => {
    const { source, area, w } = open()
    await send(area, 'pointerdown', at(1, 100, 400))
    expect(source.read()).toMatchObject({ moveX: 0, moveZ: 0 })
    expect(w.find('[data-test="stick"]').exists()).toBe(true)
    await send(area, 'pointermove', at(1, 400, 400))
    expect(source.read()).toMatchObject({ moveX: 1, moveZ: 0 })
    await send(area, 'pointermove', at(1, 100, 0))
    expect(source.read().moveZ).toBeCloseTo(-1)
  })

  it.each(['pointerup', 'pointercancel', 'lostpointercapture'])('stops on %s', async end => {
    const { source, area, w } = open()
    await send(area, 'pointerdown', at(1, 100, 400))
    await send(area, 'pointermove', at(1, 400, 400))
    await send(area, end, at(1, 400, 400))
    expect(source.read()).toMatchObject({ moveX: 0, moveZ: 0 })
    expect(w.find('[data-test="stick"]').exists()).toBe(false)
  })

  it('follows only the first finger', async () => {
    const { source, area } = open()
    await send(area, 'pointerdown', at(1, 100, 400))
    await send(area, 'pointermove', at(1, 400, 400))
    await send(area, 'pointerdown', at(2, 300, 100))
    await send(area, 'pointermove', at(2, 0, 100))
    expect(source.read()).toMatchObject({ moveX: 1, moveZ: 0 })
    await send(area, 'pointerup', at(2, 0, 100))
    expect(source.read().moveX).toBe(1)
    await send(area, 'pointerup', at(1, 400, 400))
    expect(source.read().moveX).toBe(0)
  })

  it('stops walking when it goes away with the finger still down', async () => {
    const { source, area, w } = open()
    await send(area, 'pointerdown', at(1, 100, 400))
    await send(area, 'pointermove', at(1, 400, 400))
    w.unmount()
    expect(source.read().moveX).toBe(0)
  })

  it('jumps on the button', async () => {
    const { source, w } = open()
    await w.find('[data-test="jump"]').trigger('pointerdown')
    expect(source.read().jump).toBe(true)
    expect(source.read().jump).toBe(false)
  })
})
