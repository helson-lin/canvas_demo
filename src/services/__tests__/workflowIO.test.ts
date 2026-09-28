import { Blob as NodeBlob } from 'node:buffer'
import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyDocument, type ImageNode } from '@/domain'
import { persistence } from '@/persistence/persist'
import { buildExport, importWorkflowText } from '@/services/workflowIO'
import { useCanvasStore } from '@/store/canvasStore'

const s = () => useCanvasStore.getState()

beforeEach(() => s().replaceDoc(createEmptyDocument()))

describe('workflow IO', () => {
  it('export embeds blob images; import restores them as new blobs and drops tasks', async () => {
    const png = new NodeBlob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }) as unknown as Blob
    await persistence.putBlob('blob_src', png)
    const doc = createEmptyDocument()
    doc.assets.a = { id: 'a', kind: 'upload', src: { type: 'blob', blobKey: 'blob_src' }, createdAt: 0 }
    doc.nodes.n = { id: 'n', type: 'image', position: { x: 5, y: 6 }, size: { w: 240, h: 280 }, createdAt: 0, data: { assetId: 'a' } }
    doc.tasks.t = { id: 't' } as (typeof doc.tasks)[string]

    const json = await buildExport(doc, new Date('2026-09-28T00:00:00Z'))
    expect(JSON.parse(json).assets.a.src.dataUrl).toMatch(/^data:image\/png;base64,/)

    expect(await importWorkflowText(json, { skipConfirm: true })).toBe(true)
    const imported = s().doc
    expect(imported.tasks).toEqual({})
    expect((imported.nodes.n as ImageNode).data.assetId).toBe('a')
    const src = imported.assets.a?.src
    expect(src?.type).toBe('blob')
    const restored = src?.type === 'blob' ? await persistence.getBlob(src.blobKey) : undefined
    expect(restored?.size).toBe(4)
  })

  it('rejects an invalid file without touching the canvas', async () => {
    const id = s().addNode('prompt', { x: 0, y: 0 })
    expect(await importWorkflowText('{"format":"nope"}', { skipConfirm: true })).toBe(false)
    expect(s().doc.nodes[id]).toBeDefined()
  })
})
