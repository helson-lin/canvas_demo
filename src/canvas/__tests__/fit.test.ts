import { describe, expect, it } from 'vitest'
import { fitBounds } from '@/canvas/fit'
import { MIN_ZOOM, worldToScreen } from '@/canvas/coords'
import type { CanvasNode } from '@/domain'

const node = (x: number, y: number, w = 100, h = 100): CanvasNode => ({
  id: `n${x}_${y}`, type: 'prompt', position: { x, y }, size: { w, h }, createdAt: 0, data: { text: '' },
})
const container = { w: 1000, h: 800 }

describe('fitBounds', () => {
  it('returns identity for no nodes', () => {
    expect(fitBounds([], container)).toEqual({ x: 0, y: 0, zoom: 1 })
  })

  it('centres a single node without zooming in past 100%', () => {
    const vp = fitBounds([node(300, 200)], container)
    expect(vp.zoom).toBe(1)
    const c = worldToScreen({ x: 350, y: 250 }, vp)
    expect(c.x).toBeCloseTo(500)
    expect(c.y).toBeCloseTo(400)
  })

  it('fits the bounding box of several nodes inside the padded container', () => {
    const nodes = [node(-500, -200), node(1500, 900, 200, 100)]
    const vp = fitBounds(nodes, container, 80)
    const tl = worldToScreen({ x: -500, y: -200 }, vp)
    const br = worldToScreen({ x: 1700, y: 1000 }, vp)
    expect(tl.x).toBeGreaterThanOrEqual(80 - 1e-6)
    expect(br.x).toBeLessThanOrEqual(920 + 1e-6)
    expect(tl.y).toBeGreaterThanOrEqual(80 - 1e-6)
    expect(br.y).toBeLessThanOrEqual(720 + 1e-6)
  })

  it('clamps zoom to MIN_ZOOM for huge extents', () => {
    expect(fitBounds([node(0, 0), node(1e6, 1e6)], container).zoom).toBe(MIN_ZOOM)
  })
})
