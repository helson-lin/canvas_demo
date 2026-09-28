import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Toolbar } from '@/ui/Toolbar'
import { createEmptyDocument, DEFAULT_NODE_SIZE, SAMPLE_IMAGES, type NodeType } from '@/domain'
import { persistence } from '@/persistence/persist'
import { useCanvasStore } from '@/store/canvasStore'
import { toast } from '@/ui/toast'

vi.mock('@/ui/toast', () => ({ toast: vi.fn() }))

const store = () => useCanvasStore.getState()

beforeEach(() => {
  store().replaceDoc(createEmptyDocument())
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
  vi.spyOn(persistence, 'saveNow').mockResolvedValue()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('Toolbar', () => {
  it.each([
    ['image', '新建图片节点', 100],
    ['prompt', '新建提示词节点', 101],
    ['generator', '新建生成节点', 102],
  ] as const)('creates a %s node at the viewport center in world coordinates', (type, label, viewportX) => {
    store().setViewport({ x: viewportX, y: 50, zoom: 2 })
    render(<Toolbar />)

    fireEvent.click(screen.getByRole('button', { name: label }))

    const nodes = Object.values(store().doc.nodes)
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({
      type,
      position: { x: (500 - viewportX) / 2 - DEFAULT_NODE_SIZE[type].w / 2, y: 175 - DEFAULT_NODE_SIZE[type].h / 2 },
    })
    expect(store().ui.selection.nodeIds).toEqual([nodes[0].id])
    expect(persistence.saveNow).toHaveBeenCalledTimes(1)
  })

  it('places consecutive nodes without overlap, the first centred in the viewport', () => {
    store().setViewport({ x: 103, y: 50, zoom: 2 })
    render(<Toolbar />)
    const add = () => fireEvent.click(screen.getByRole('button', { name: '新建图片节点' }))
    add()
    add()
    add()
    const nodes = Object.values(store().doc.nodes)
    const { w, h } = DEFAULT_NODE_SIZE.image
    expect(nodes[0].position).toEqual({ x: (500 - 103) / 2 - w / 2, y: (400 - 50) / 2 - h / 2 })
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i].position
        const b = nodes[j].position
        expect(Math.abs(a.x - b.x) >= w || Math.abs(a.y - b.y) >= h).toBe(true)
      }
    }
    expect(persistence.saveNow).toHaveBeenCalledTimes(3)
  })

  it('loads a connected sample without starting a task', () => {
    store().setViewport({ x: 100, y: 50, zoom: 2 })
    render(<Toolbar />)

    fireEvent.click(screen.getByRole('button', { name: '载入示例' }))

    const doc = store().doc
    const nodes = Object.values(doc.nodes)
    const edges = Object.values(doc.edges)
    const byType = (type: NodeType) => nodes.find((node) => node.type === type)
    const image = byType('image')
    const prompt = byType('prompt')
    const generator = byType('generator')
    expect(nodes).toHaveLength(3)
    expect(nodes.every((node) => node.sample === true)).toBe(true)
    expect(edges).toHaveLength(2)
    expect(edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: image?.id, target: generator?.id, kind: 'input' }),
      expect.objectContaining({ source: prompt?.id, target: generator?.id, kind: 'input' }),
    ]))
    expect(Object.values(doc.assets)).toEqual([
      expect.objectContaining({ kind: 'sample', src: { type: 'url', url: SAMPLE_IMAGES[0].url } }),
    ])
    expect(image?.data).toMatchObject({ assetId: Object.keys(doc.assets)[0] })
    expect(prompt?.data).toMatchObject({ text: '一只戴墨镜的柴犬，赛博朋克风' })
    expect(Object.keys(doc.tasks)).toHaveLength(0)
    expect(persistence.saveNow).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith('已载入示例数据', { kind: 'success' })
  })
})
