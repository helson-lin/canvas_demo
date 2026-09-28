import { describe, expect, it } from 'vitest'
import { createEmptyDocument, selectGeneratorInputs, selectImageNodeView, summarizeNodeRemoval, type CanvasDocument } from '@/domain'

function doc(): CanvasDocument {
  const d = createEmptyDocument()
  const base = { size: { w: 1, h: 1 }, position: { x: 0, y: 0 }, createdAt: 0 }
  d.assets.a1 = { id: 'a1', kind: 'sample', src: { type: 'url', url: '/x.svg' }, createdAt: 0 }
  d.nodes.img = { ...base, id: 'img', type: 'image', data: { assetId: 'a1' } }
  d.nodes.p = { ...base, id: 'p', type: 'prompt', data: { text: 'cat' } }
  d.nodes.g = { ...base, id: 'g', type: 'generator', data: { params: { aspectRatio: '1:1' }, activeTaskId: null } }
  d.nodes.out = { ...base, id: 'out', type: 'image', data: { assetId: null, pendingTaskId: 't' } }
  d.edges.e1 = { id: 'e1', source: 'img', target: 'g', kind: 'input' }
  d.edges.e2 = { id: 'e2', source: 'p', target: 'g', kind: 'input' }
  d.edges.e3 = { id: 'e3', source: 'g', target: 'out', kind: 'result' }
  return d
}

describe('selectors', () => {
  it('selectGeneratorInputs reads only input edges', () => {
    const inputs = selectGeneratorInputs(doc(), 'g')
    expect(inputs.images.map((i) => i.asset?.id)).toEqual(['a1'])
    expect(inputs.prompts.map((p) => p.text)).toEqual(['cat'])
  })

  it('selectImageNodeView derives state from task', () => {
    const d = doc()
    expect(selectImageNodeView(d, 'img')).toBe('ready')
    expect(selectImageNodeView(d, 'out')).toBe('missing')
    const now = 0
    d.tasks.t = {
      id: 't', generatorNodeId: 'g', inputSnapshot: { imageAssetIds: [], prompts: [] },
      params: { aspectRatio: '1:1' }, status: 'running', attempt: 1, idempotencyKey: 'k',
      queuedAt: now, expectedDurationMs: 1, createdAt: now, updatedAt: now,
    }
    expect(selectImageNodeView(d, 'out')).toBe('running')
    d.tasks.t.status = 'interrupted'
    expect(selectImageNodeView(d, 'out')).toBe('failed')
  })
})

describe('summarizeNodeRemoval', () => {
  it('counts nodes, attached edges and tasks that would be cancelled', () => {
    const d = doc()
    d.tasks.t = {
      id: 't', generatorNodeId: 'g', inputSnapshot: { imageAssetIds: [], prompts: [] },
      params: { aspectRatio: '1:1' }, status: 'running', attempt: 1, idempotencyKey: 'k',
      queuedAt: 0, expectedDurationMs: 1, createdAt: 0, updatedAt: 0,
    }
    expect(summarizeNodeRemoval(d, ['out'])).toEqual({ nodes: 1, edges: 1, activeTasks: 1 })
    expect(summarizeNodeRemoval(d, ['img', 'p', 'missing'])).toEqual({ nodes: 2, edges: 2, activeTasks: 0 })
  })
})
