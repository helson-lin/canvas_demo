import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyDocument, type ImageNode } from '@/domain'
import { useCanvasStore } from '@/store/canvasStore'
import { checkpoint, clearHistory, redo, undo } from '@/store/history'

const s = () => useCanvasStore.getState()

beforeEach(() => {
  s().replaceDoc(createEmptyDocument())
  clearHistory()
})

describe('history', () => {
  it('undoes and redoes a user edit', () => {
    const id = s().addNode('prompt', { x: 0, y: 0 })
    checkpoint()
    s().moveNode(id, { x: 100, y: 50 })
    expect(undo()).toBe(true)
    expect(s().doc.nodes[id]?.position).toEqual({ x: 0, y: 0 })
    expect(redo()).toBe(true)
    expect(s().doc.nodes[id]?.position).toEqual({ x: 100, y: 50 })
    expect(redo()).toBe(false)
  })

  it('restores deleted nodes together with their edges', () => {
    const img = s().addNode('image', { x: 0, y: 0 })
    const gen = s().addNode('generator', { x: 400, y: 0 })
    s().addEdge(img, gen)
    checkpoint()
    s().removeNodes([img])
    undo()
    expect(s().doc.nodes[img]).toBeDefined()
    expect(Object.values(s().doc.edges).some((e) => e.source === img && e.target === gen)).toBe(true)
  })

  it('coalesces a burst with the same key into one step', () => {
    vi.useFakeTimers()
    try {
      const id = s().addNode('prompt', { x: 0, y: 0 })
      for (const text of ['a', 'ab', 'abc']) {
        checkpoint(`text:${id}`)
        s().updateNodeData(id, { text })
        vi.advanceTimersByTime(200)
      }
      undo()
      expect(s().doc.nodes[id]?.data).toEqual({ text: '' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('never rolls back generation: keeps new result nodes and task-owned fields', () => {
    const gen = s().addNode('generator', { x: 0, y: 0 })
    checkpoint()
    s().moveNode(gen, { x: 10, y: 10 })
    // Generation happens after the checkpoint (not recorded).
    const result = s().addNode('image', { x: 400, y: 0 }, { data: { assetId: 'asset_done' } })
    s().addEdge(gen, result, 'result')
    s().updateNodeData(gen, { activeTaskId: 'task_1' })
    undo()
    expect(s().doc.nodes[gen]?.position).toEqual({ x: 0, y: 0 })
    expect((s().doc.nodes[result] as ImageNode).data.assetId).toBe('asset_done')
    expect(Object.values(s().doc.edges).some((e) => e.kind === 'result' && e.target === result)).toBe(true)
    expect(s().doc.nodes[gen]?.type === 'generator' && s().doc.nodes[gen]?.data).toMatchObject({ activeTaskId: 'task_1' })
  })

  it('keeps a result node finished after the checkpoint instead of reverting it to pending', () => {
    const gen = s().addNode('generator', { x: 0, y: 0 })
    const result = s().addNode('image', { x: 400, y: 0 }, { data: { assetId: null, pendingTaskId: 't' } })
    s().addEdge(gen, result, 'result')
    checkpoint()
    s().moveNode(result, { x: 500, y: 0 })
    s().updateNodeData(result, { assetId: 'asset_done', pendingTaskId: undefined })
    undo()
    const node = s().doc.nodes[result] as ImageNode
    expect(node.position).toEqual({ x: 400, y: 0 })
    expect(node.data.assetId).toBe('asset_done')
  })
})
