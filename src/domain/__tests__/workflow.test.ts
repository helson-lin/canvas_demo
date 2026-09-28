import { describe, expect, it } from 'vitest'
import { createEmptyDocument, parseWorkflow, SCHEMA_VERSION, toWorkflow, WORKFLOW_FORMAT, type CanvasDocument } from '@/domain'

function doc(): CanvasDocument {
  const d = createEmptyDocument()
  const base = { size: { w: 100, h: 100 }, createdAt: 0, position: { x: 1, y: 2 } }
  d.viewport = { x: 10, y: 20, zoom: 0.5 }
  d.assets.s = { id: 's', kind: 'sample', src: { type: 'url', url: '/samples/square.svg' }, createdAt: 0 }
  d.assets.u = { id: 'u', kind: 'upload', src: { type: 'blob', blobKey: 'blob_1' }, createdAt: 0 }
  d.assets.g = { id: 'g', kind: 'generated', src: { type: 'blob', blobKey: 'blob_2' }, origin: { taskId: 't' }, createdAt: 0 }
  d.assets.unused = { id: 'unused', kind: 'sample', src: { type: 'url', url: '/x.svg' }, createdAt: 0 }
  d.nodes.a = { ...base, id: 'a', type: 'image', data: { assetId: 's' } }
  d.nodes.b = { ...base, id: 'b', type: 'image', data: { assetId: 'u' } }
  d.nodes.r = { ...base, id: 'r', type: 'image', data: { assetId: 'g' } }
  d.nodes.pending = { ...base, id: 'pending', type: 'image', data: { assetId: null, pendingTaskId: 't2' } }
  d.nodes.gen = { ...base, id: 'gen', type: 'generator', data: { params: { aspectRatio: '1:1' }, activeTaskId: 't2' } }
  d.edges.e = { id: 'e', source: 'a', target: 'gen', kind: 'input' }
  d.tasks.t = { id: 't' } as CanvasDocument['tasks'][string]
  return d
}

const dataUrls = { u: 'data:image/png;base64,AAA', g: 'data:image/png;base64,BBB' }

describe('workflow export', () => {
  it('strips task links, embeds blob assets as data URLs, keeps only referenced assets', () => {
    const wf = toWorkflow(doc(), dataUrls, '2026-09-28T00:00:00Z')
    expect(wf.format).toBe(WORKFLOW_FORMAT)
    expect(wf.version).toBe(SCHEMA_VERSION)
    expect(Object.keys(wf.assets).sort()).toEqual(['g', 's', 'u'])
    expect(wf.assets.u?.src).toEqual({ type: 'data', dataUrl: dataUrls.u })
    expect(wf.assets.g).not.toHaveProperty('origin')
    expect(wf.nodes.pending?.data).toEqual({ assetId: null })
    expect(wf.nodes.gen?.data).toMatchObject({ activeTaskId: null })
    expect(wf).not.toHaveProperty('tasks')
  })

  it('round-trips through parseWorkflow', () => {
    const wf = toWorkflow(doc(), dataUrls, 'now')
    const parsed = parseWorkflow(JSON.stringify(wf))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(Object.keys(parsed.workflow.nodes).sort()).toEqual(Object.keys(wf.nodes).sort())
      expect(parsed.workflow.viewport).toEqual({ x: 10, y: 20, zoom: 0.5 })
    }
  })
})

describe('workflow parse', () => {
  const valid = () => toWorkflow(doc(), dataUrls, 'now')

  it('rejects non-JSON, wrong format and newer versions', () => {
    expect(parseWorkflow('nope')).toMatchObject({ ok: false })
    expect(parseWorkflow(JSON.stringify({ format: 'other' }))).toMatchObject({ ok: false, reason: '不是画布工作流文件' })
    expect(parseWorkflow(JSON.stringify({ ...valid(), version: SCHEMA_VERSION + 1 }))).toMatchObject({ ok: false })
  })

  it('rejects malformed nodes and unsafe asset sources', () => {
    const badNode = valid()
    ;(badNode.nodes.a as unknown as { position: unknown }).position = { x: 'x', y: 0 }
    expect(parseWorkflow(JSON.stringify(badNode))).toMatchObject({ ok: false })
    const badAsset = valid()
    badAsset.assets.u = { ...badAsset.assets.u!, src: { type: 'data', dataUrl: 'javascript:alert(1)' } }
    expect(parseWorkflow(JSON.stringify(badAsset))).toMatchObject({ ok: false })
  })

  it('drops dangling edges and unresolved asset references', () => {
    const wf = valid()
    wf.edges.bad = { id: 'bad', source: 'a', target: 'missing', kind: 'input' }
    delete (wf.assets as Record<string, unknown>).s
    const parsed = parseWorkflow(JSON.stringify(wf))
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.workflow.edges.bad).toBeUndefined()
      expect(parsed.workflow.nodes.a?.data).toEqual({ assetId: null })
    }
  })
})
