import { describe, expect, it } from 'vitest'
import { findFreePosition, findResultSlot, resultNodeSize, type CanvasNode } from '@/domain'

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
    const mediaW = 240 - 2 - 12
    expect(Math.abs(square.h - wide.h - (mediaW - (mediaW * 9) / 16))).toBeLessThanOrEqual(1)
    expect(tall.h).toBeGreaterThan(square.h)
  })
})

describe('findResultSlot', () => {
  const gen = { position: { x: 0, y: 0 }, size: { w: 300, h: 420 } }
  const size = { w: 240, h: 200 }
  const at = (x: number, y: number): CanvasNode => ({
    id: `r${x}_${y}`, type: 'image', position: { x, y }, size, createdAt: 0, data: { assetId: null },
  })

  it('fills a 3-column grid right of the generator, row by row', () => {
    const first = findResultSlot([], gen, size, 40)
    expect(first).toEqual({ x: 340, y: 0 })
    const nodes = [at(340, 0), at(604, 0), at(868, 0)]
    expect(findResultSlot(nodes, gen, size, 40)).toEqual({ x: 340, y: 224 })
    expect(findResultSlot(nodes.slice(0, 1), gen, size, 40)).toEqual({ x: 604, y: 0 })
  })
})
