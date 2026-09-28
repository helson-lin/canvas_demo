import { describe, expect, it } from 'vitest'
import {
  bezierMidpoint,
  bezierPath,
  canConnect,
  createEmptyDocument,
  edgeEndpoints,
  edgesOf,
  findDanglingEdges,
  handlePoint,
  hasHandle,
  inputEdgesOf,
  inputsOf,
  type CanvasDocument,
} from '@/domain'

function doc(): CanvasDocument {
  const d = createEmptyDocument()
  const base = { size: { w: 100, h: 50 }, position: { x: 0, y: 0 }, createdAt: 0 }
  d.nodes.img = { ...base, id: 'img', type: 'image', data: { assetId: null } }
  d.nodes.p = { ...base, id: 'p', type: 'prompt', data: { text: 'cat' } }
  d.nodes.g = { ...base, id: 'g', type: 'generator', data: { params: { aspectRatio: '1:1' }, activeTaskId: null } }
  d.nodes.g2 = { ...base, id: 'g2', type: 'generator', data: { params: { aspectRatio: '1:1' }, activeTaskId: null } }
  d.nodes.out = { ...base, id: 'out', type: 'image', data: { assetId: null } }
  d.edges.e1 = { id: 'e1', source: 'img', target: 'g', kind: 'input' }
  d.edges.e3 = { id: 'e3', source: 'g', target: 'out', kind: 'result' }
  return d
}

describe('canConnect', () => {
  it('accepts image/prompt -> generator', () => {
    expect(canConnect(doc(), 'p', 'g')).toEqual({ ok: true })
    expect(canConnect(doc(), 'img', 'g2')).toEqual({ ok: true })
  })

  it('accepts a result image as input to another generator', () => {
    expect(canConnect(doc(), 'out', 'g2')).toEqual({ ok: true })
  })

  it('rejects missing nodes', () => {
    expect(canConnect(doc(), 'nope', 'g')).toEqual({ ok: false, reason: '节点不存在' })
    expect(canConnect(doc(), 'img', 'nope')).toEqual({ ok: false, reason: '节点不存在' })
  })

  it('rejects self loops', () => {
    expect(canConnect(doc(), 'g', 'g')).toEqual({ ok: false, reason: '不能连接到自身' })
  })

  it('rejects generator as input source', () => {
    expect(canConnect(doc(), 'g', 'g2')).toEqual({ ok: false, reason: '生成节点不能作为输入' })
  })

  it('rejects non-generator targets', () => {
    expect(canConnect(doc(), 'img', 'p')).toEqual({ ok: false, reason: '只能连接到生成节点' })
  })

  it('rejects duplicates', () => {
    expect(canConnect(doc(), 'img', 'g')).toEqual({ ok: false, reason: '连接已存在' })
  })

  it('result kind: only generator -> image, no duplicates', () => {
    expect(canConnect(doc(), 'g2', 'img', 'result')).toEqual({ ok: true })
    expect(canConnect(doc(), 'img', 'g', 'result').ok).toBe(false)
    expect(canConnect(doc(), 'g', 'p', 'result').ok).toBe(false)
    expect(canConnect(doc(), 'g', 'out', 'result')).toEqual({ ok: false, reason: '连接已存在' })
  })
})

describe('edge queries', () => {
  it('edgesOf / inputEdgesOf', () => {
    const d = doc()
    expect(edgesOf(d, 'g').map((e) => e.id).sort()).toEqual(['e1', 'e3'])
    expect(inputEdgesOf(d, 'g').map((e) => e.id)).toEqual(['e1'])
    expect(inputsOf).toBe(inputEdgesOf)
  })

  it('findDanglingEdges finds edges with missing endpoints', () => {
    const d = doc()
    expect(findDanglingEdges(d)).toEqual([])
    delete d.nodes.out
    d.edges.e4 = { id: 'e4', source: 'ghost', target: 'g2', kind: 'input' }
    expect(findDanglingEdges(d).map((e) => e.id).sort()).toEqual(['e3', 'e4'])
  })
})

describe('geometry', () => {
  it('handlePoint uses world position + size', () => {
    const d = doc()
    const n = { ...d.nodes.img, position: { x: 10, y: 20 } }
    expect(handlePoint(n, 'out')).toEqual({ x: 110, y: 45 })
    expect(handlePoint(n, 'in')).toEqual({ x: 10, y: 45 })
  })

  it('hasHandle', () => {
    const d = doc()
    expect(hasHandle(d.nodes.img, 'out')).toBe(true)
    expect(hasHandle(d.nodes.img, 'in')).toBe(false)
    expect(hasHandle(d.nodes.g, 'in')).toBe(true)
    expect(hasHandle(d.nodes.g, 'out')).toBe(false)
  })

  it('bezierPath and midpoint', () => {
    expect(bezierPath({ x: 0, y: 0 }, { x: 200, y: 100 })).toBe('M 0 0 C 100 0, 100 100, 200 100')
    // minimum control offset keeps short/backward edges curved
    expect(bezierPath({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe('M 0 0 C 40 0, -30 0, 10 0')
    expect(bezierMidpoint({ x: 0, y: 0 }, { x: 200, y: 100 })).toEqual({ x: 100, y: 50 })
  })

  it('edgeEndpoints', () => {
    const d = doc()
    expect(edgeEndpoints(d, d.edges.e1)).toEqual({ a: { x: 100, y: 25 }, b: { x: 0, y: 25 } })
    expect(edgeEndpoints(d, { id: 'x', source: 'ghost', target: 'g', kind: 'input' })).toBeNull()
  })
})
