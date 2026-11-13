import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import type { Direction } from '@/core/direction'
import { useSteering } from './steering'

let turns: Direction[] = []
let w: VueWrapper | null = null

function mountSteering() {
  turns = []
  w = mount(defineComponent({
    setup() {
      const steer = useSteering(d => turns.push(d))
      return () => h('div', { 'data-test': 'area', onPointerdown: steer.down, onPointerup: steer.up, onPointercancel: steer.cancel })
    },
  }), { attachTo: document.body })
  return w
}

const key = (k: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, cancelable: true }))
function swipe(from: [number, number], to: [number, number], id = 1) {
  const area = w!.find('[data-test="area"]').element
  area.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: id, clientX: from[0], clientY: from[1] }))
  area.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: id, clientX: to[0], clientY: to[1] }))
}

describe('useSteering', () => {
  afterEach(() => {
    w?.unmount()
    w = null
  })

  it('turns with the arrow keys and WASD', () => {
    mountSteering()
    key('ArrowLeft')
    key('w')
    key('Enter')
    expect(turns).toEqual(['left', 'up'])
  })

  it('turns with a swipe anywhere, not with a tap', () => {
    mountSteering()
    swipe([100, 100], [180, 110])
    swipe([100, 100], [104, 98])
    swipe([100, 100], [90, 30])
    expect(turns).toEqual(['right', 'up'])
  })

  it('follows one finger: a second finger lifting does not count as a swipe', () => {
    mountSteering()
    const area = w!.find('[data-test="area"]').element
    area.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1, clientX: 100, clientY: 100 }))
    area.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 2, clientX: 300, clientY: 100 }))
    expect(turns).toEqual([])
  })

  it('stops listening to keys when gone', () => {
    mountSteering()
    w!.unmount()
    w = null
    key('ArrowUp')
    expect(turns).toEqual([])
  })
})
