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

  it('offsets consecutive nodes by 24 screen pixels and resets after viewport changes', () => {
    store().setViewport({ x: 103, y: 50, zoom: 2 })
    render(<Toolbar />)
    const add = () => fireEvent.click(screen.getByRole('button', { name: '新建图片节点' }))

    add()
    add()
    let nodes = Object.values(store().doc.nodes)
    expect(nodes[1].position.x - nodes[0].position.x).toBe(12)
    expect(nodes[1].position.y - nodes[0].position.y).toBe(12)

    store().setViewport({ x: 125, y: 50, zoom: 2 })
    add()
    nodes = Object.values(store().doc.nodes)
    expect(nodes[2].position).toEqual({ x: 187.5 - DEFAULT_NODE_SIZE.image.w / 2, y: 175 - DEFAULT_NODE_SIZE.image.h / 2 })
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
