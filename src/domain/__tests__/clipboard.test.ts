import { describe, expect, it } from 'vitest'
import { cloneForPaste, copyNodes, createEmptyDocument, type CanvasDocument } from '@/domain'

function doc(): CanvasDocument {
  const d = createEmptyDocument()
  const base = { size: { w: 100, h: 100 }, createdAt: 0 }
  d.nodes.img = { ...base, id: 'img', type: 'image', sample: true, position: { x: 0, y: 0 }, data: { assetId: 'a1' } }
  d.nodes.p = { ...base, id: 'p', type: 'prompt', position: { x: 0, y: 200 }, data: { text: 'cat' } }
  d.nodes.g = { ...base, id: 'g', type: 'generator', position: { x: 300, y: 0 }, data: { params: { aspectRatio: '16:9' }, activeTaskId: 't1' } }
  d.nodes.r = { ...base, id: 'r', type: 'image', position: { x: 600, y: 0 }, data: { assetId: null, pendingTaskId: 't1' } }
  d.edges.e1 = { id: 'e1', source: 'img', target: 'g', kind: 'input' }
  d.edges.e2 = { id: 'e2', source: 'p', target: 'g', kind: 'input' }
  d.edges.e3 = { id: 'e3', source: 'g', target: 'r', kind: 'result' }
  return d
}

describe('clipboard', () => {
  it('copies only input edges between selected nodes', () => {
    const clip = copyNodes(doc(), ['img', 'g', 'r'])!
    expect(clip.nodes.map((n) => n.id).sort()).toEqual(['g', 'img', 'r'])
    expect(clip.edges.map((e) => e.id)).toEqual(['e1'])
    expect(copyNodes(doc(), ['nope'])).toBeNull()
  })

  it('pastes with new ids, remapped edges, offset and no task links', () => {
    const pasted = cloneForPaste(copyNodes(doc(), ['img', 'g', 'r'])!, { x: 32, y: 32 }, 5)
    const byOld = (old: string) => pasted.nodes.find((n) => n.position.x === doc().nodes[old]!.position.x + 32)!
    const [img, g, r] = [byOld('img'), byOld('g'), byOld('r')]
    expect(new Set(pasted.nodes.map((n) => n.id)).has('img')).toBe(false)
    expect(img).toMatchObject({ type: 'image', data: { assetId: 'a1' } })
    expect(img.sample).toBeUndefined()
    expect(g).toMatchObject({ type: 'generator', data: { params: { aspectRatio: '16:9' }, activeTaskId: null } })
    expect(r).toMatchObject({ type: 'image', data: { assetId: null } })
    expect(pasted.edges).toEqual([{ id: expect.stringMatching(/^edge_/), source: img.id, target: g.id, kind: 'input' }])
  })
})
