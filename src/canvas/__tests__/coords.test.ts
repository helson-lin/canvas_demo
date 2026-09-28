import { describe, it, expect } from 'vitest'
import { clampZoom, MAX_ZOOM, MIN_ZOOM, screenToWorld, worldToScreen, zoomAt } from '@/canvas/coords'
import { dragPosition, exceedsDragThreshold, nextSelection } from '@/canvas/useNodeDrag'
import { isBlankCanvasTarget, wheelZoomFactor } from '@/canvas/usePanZoom'

const vps = [
  { x: 0, y: 0, zoom: 1 },
  { x: 120, y: -80, zoom: 0.3 },
  { x: -500, y: 240, zoom: 3 },
]
const pts = [
  { x: 0, y: 0 },
  { x: 400, y: 300 },
  { x: -37.5, y: 912.25 },
]

describe('coords', () => {
  it('round-trips screen <-> world', () => {
    for (const vp of vps)
      for (const p of pts) {
        const back = worldToScreen(screenToWorld(p, vp), vp)
        expect(back.x).toBeCloseTo(p.x, 9)
        expect(back.y).toBeCloseTo(p.y, 9)
      }
  })

  it('zoomAt keeps the world point under the anchor fixed', () => {
    for (const vp of vps)
      for (const p of pts)
        for (const f of [0.5, 1.1, 2, 0.01, 100]) {
          const before = screenToWorld(p, vp)
          const after = screenToWorld(p, zoomAt(vp, p, f))
          expect(after.x).toBeCloseTo(before.x, 6)
          expect(after.y).toBeCloseTo(before.y, 6)
        }
  })

  it('clamps zoom to [MIN_ZOOM, MAX_ZOOM]', () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM)
    expect(clampZoom(10)).toBe(MAX_ZOOM)
    expect(clampZoom(1.5)).toBe(1.5)
    expect(zoomAt({ x: 0, y: 0, zoom: 3 }, { x: 10, y: 10 }, 10).zoom).toBe(MAX_ZOOM)
    expect(zoomAt({ x: 0, y: 0, zoom: 0.2 }, { x: 10, y: 10 }, 0.1).zoom).toBe(MIN_ZOOM)
  })

  it('wheel zoom factor is symmetric', () => {
    expect(wheelZoomFactor(100) * wheelZoomFactor(-100)).toBeCloseTo(1, 12)
    expect(wheelZoomFactor(-10)).toBeGreaterThan(1)
    // A mouse-wheel notch (~100px) is clamped to a gentle step.
    expect(wheelZoomFactor(-100)).toBeCloseTo(Math.exp(0.15), 12)
  })
})

describe('drag math', () => {
  it('divides screen delta by zoom', () => {
    const start = { x: 100, y: 50 }
    const a = dragPosition(start, { x: 0, y: 0 }, { x: 30, y: -60 }, 0.3)
    expect(a.x).toBeCloseTo(200)
    expect(a.y).toBeCloseTo(-150)
    expect(dragPosition(start, { x: 10, y: 10 }, { x: 40, y: 70 }, 3)).toEqual({ x: 110, y: 70 })
  })

  it('treats movement under 3px as a click', () => {
    expect(exceedsDragThreshold({ x: 0, y: 0 }, { x: 2, y: 2 })).toBe(false)
    expect(exceedsDragThreshold({ x: 0, y: 0 }, { x: 3, y: 0 })).toBe(true)
  })

  it('computes click selection with Shift toggling', () => {
    expect(nextSelection(['a', 'b'], 'c', false)).toEqual(['c'])
    expect(nextSelection(['a'], 'b', true)).toEqual(['a', 'b'])
    expect(nextSelection(['a', 'b'], 'a', true)).toEqual(['b'])
  })
})

describe('isBlankCanvasTarget', () => {
  it('treats nodes, edges, handles and controls as non-blank', () => {
    document.body.innerHTML = `
      <div id="canvas"><div id="blank"></div>
        <div data-node-id="n1"><span id="inNode"></span></div>
        <svg><g data-no-drag><path id="edge"></path></g></svg>
      </div>`
    const $ = (id: string) => document.getElementById(id)
    expect(isBlankCanvasTarget($('blank'))).toBe(true)
    expect(isBlankCanvasTarget($('inNode'))).toBe(false)
    expect(isBlankCanvasTarget($('edge'))).toBe(false)
  })
})
