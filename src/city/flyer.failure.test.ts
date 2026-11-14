import { expect, it, vi } from 'vitest'

// No WebGL in tests: a stand-in renderer
const renderer = vi.hoisted(() => ({ setPixelRatio: vi.fn(), setSize: vi.fn(), render: vi.fn(), dispose: vi.fn(), forceContextLoss: vi.fn() }))
vi.mock('three', async importOriginal => ({ ...(await importOriginal<typeof import('three')>()), WebGLRenderer: vi.fn(function () { return renderer }) }))
// Building the wobbly fails after the renderer got its context
vi.mock('./blob', () => ({ createBlob: () => { throw new Error('broken') } }))

import { createFlyer } from './flyer'

it('gives the WebGL context back when building the flying wobbly fails', () => {
  expect(() => createFlyer(document.createElement('canvas'))).toThrow('broken')
  expect(renderer.forceContextLoss).toHaveBeenCalled()
})
