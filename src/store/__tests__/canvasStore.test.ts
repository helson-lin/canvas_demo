import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyDocument, newId, type Task } from '@/domain'
import { useCanvasStore } from '@/store/canvasStore'

const s = () => useCanvasStore.getState()

function task(generatorNodeId: string, status: Task['status']): Task {
  const now = Date.now()
  return {
    id: newId('task'),
    generatorNodeId,
    inputSnapshot: { imageAssetIds: [], prompts: ['p'] },
    params: { aspectRatio: '1:1' },
    status,
    attempt: 1,
    idempotencyKey: newId('idem'),
    queuedAt: now,
    expectedDurationMs: 1000,
    createdAt: now,
    updatedAt: now,
  }
}

beforeEach(() => s().replaceDoc(createEmptyDocument()))

describe('canvasStore', () => {
  it('stores world positions and stable ids', () => {
    const id = s().addNode('prompt', { x: 10, y: 20 })
    expect(id).toMatch(/^node_/)
    expect(s().doc.nodes[id]?.position).toEqual({ x: 10, y: 20 })
  })

  it('addEdge enforces canConnect', () => {
    const img = s().addNode('image', { x: 0, y: 0 })
    const prompt = s().addNode('prompt', { x: 0, y: 0 })
    const gen = s().addNode('generator', { x: 0, y: 0 })
    expect(s().addEdge(img, gen)).toMatch(/^edge_/)
    expect(s().addEdge(prompt, gen)).toMatch(/^edge_/)
    expect(s().addEdge(img, gen)).toBeNull() // duplicate
    expect(s().addEdge(gen, gen)).toBeNull() // self loop
    expect(s().addEdge(gen, img)).toBeNull() // input edge must target a generator
    expect(s().addEdge(img, prompt)).toBeNull()
  })

  it('removeNodes cascades edges and leaves no dangling references', () => {
    const img = s().addNode('image', { x: 0, y: 0 })
    const gen = s().addNode('generator', { x: 0, y: 0 })
    const gen2 = s().addNode('generator', { x: 0, y: 0 })
    s().addEdge(img, gen)
    s().addEdge(img, gen2)
    s().select({ nodeIds: [img] })
    s().removeNodes([img])
    expect(Object.keys(s().doc.edges)).toHaveLength(0)
    expect(s().ui.selection.nodeIds).toEqual([])
  })

  it('removeNodes cancels active tasks of generator and placeholder nodes', () => {
    const gen = s().addNode('generator', { x: 0, y: 0 })
    const t1 = task(gen, 'running')
    s().upsertTask(t1)
    s().updateNodeData(gen, { activeTaskId: t1.id })
    const placeholder = s().addNode('image', { x: 0, y: 0 })
    const t2 = task(gen, 'queued')
    s().upsertTask(t2)
    s().updateNodeData(placeholder, { pendingTaskId: t2.id })
    const done = task(gen, 'succeeded')
    s().upsertTask(done)

    s().removeNodes([gen, placeholder])
    expect(s().doc.tasks[t1.id]?.status).toBe('cancelled')
    expect(s().doc.tasks[t2.id]?.status).toBe('cancelled')
    expect(s().doc.tasks[done.id]?.status).toBe('succeeded')
  })
})
