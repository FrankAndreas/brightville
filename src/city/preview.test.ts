import { describe, expect, it, vi } from 'vitest'

// No WebGL in tests: a stand-in renderer that records what the preview does with it
const renderer = vi.hoisted(() => ({ setPixelRatio: vi.fn(), setSize: vi.fn(), render: vi.fn(), dispose: vi.fn(), forceContextLoss: vi.fn() }))
vi.mock('three', async importOriginal => ({ ...(await importOriginal<typeof import('three')>()), WebGLRenderer: vi.fn(function () { return renderer }) }))

import { createPreview } from './preview'

describe('the character preview', () => {
  it('gives its WebGL context back when it goes, so the town\'s is never the one the browser drops', () => {
    const preview = createPreview(document.createElement('canvas'))
    preview.dispose()
    expect(renderer.dispose).toHaveBeenCalled()
    expect(renderer.forceContextLoss).toHaveBeenCalled()
  })
})
