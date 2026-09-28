import { describe, expect, it } from 'vitest'
import { findFreePosition, resultNodeSize, type CanvasNode } from '@/domain'

const node = (x: number, y: number): CanvasNode => ({
  id: `n${x}_${y}`, type: 'prompt', position: { x, y }, size: { w: 100, h: 100 }, createdAt: 0, data: { text: '' },
})

describe('findFreePosition', () => {
  it('keeps the desired position when free', () => {
    expect(findFreePosition([node(500, 500)], { x: 0, y: 0 }, { w: 100, h: 100 }, { x: 0, y: 24 })).toEqual({ x: 0, y: 0 })
  })

  it('steps past occupied space with a gap', () => {
    const pos = findFreePosition([node(0, 0), node(0, 130)], { x: 0, y: 0 }, { w: 100, h: 100 }, { x: 0, y: 24 })
    expect(pos.x).toBe(0)
    expect(pos.y).toBeGreaterThanOrEqual(130 + 100 + 16)
  })
})

describe('resultNodeSize', () => {
  it('reserves height for the aspect ratio plus status chrome', () => {
    const square = resultNodeSize('1:1')
    const wide = resultNodeSize('16:9')
    const tall = resultNodeSize('9:16')
    expect(square.w).toBe(240)
    expect(Math.abs(square.h - wide.h - (216 - (216 * 9) / 16))).toBeLessThanOrEqual(1)
    expect(tall.h).toBeGreaterThan(square.h)
  })
})
