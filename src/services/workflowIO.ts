// Export / import the canvas as a workflow JSON file. Pure shaping lives in @/domain/workflow.
import { newId, parseWorkflow, SCHEMA_VERSION, toWorkflow, type Asset, type CanvasDocument } from '@/domain'
import { persistence } from '@/persistence/persist'
import { useCanvasStore } from '@/store/canvasStore'
import { clearHistory } from '@/store/history'
import { confirm } from '@/ui/confirm'
import { toast } from '@/ui/toast'

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  // Chunked so large images don't overflow String.fromCharCode's argument limit.
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:${blob.type || 'application/octet-stream'};base64,${btoa(binary)}`
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob()
}

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

export async function buildExport(doc: CanvasDocument, now = new Date()): Promise<string> {
  const dataUrls: Record<string, string> = {}
  for (const node of Object.values(doc.nodes)) {
    const asset = node.type === 'image' && node.data.assetId ? doc.assets[node.data.assetId] : undefined
    if (asset?.src.type !== 'blob' || dataUrls[asset.id]) continue
    const blob = await persistence.getBlob(asset.src.blobKey)
    if (blob) dataUrls[asset.id] = await blobToDataUrl(blob)
  }
  return JSON.stringify(toWorkflow(doc, dataUrls, now.toISOString()), null, 2)
}

export async function exportWorkflow(): Promise<void> {
  const doc = useCanvasStore.getState().doc
  if (!Object.keys(doc.nodes).length) {
    toast('画布为空，没有可导出的内容')
    return
  }
  try {
    const json = await buildExport(doc)
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `canvas-workflow-${stamp(new Date())}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
    toast('已导出工作流', { kind: 'success', description: '任务记录不包含在导出文件中' })
  } catch (err) {
    toast('导出失败', { kind: 'error', description: err instanceof Error ? err.message : String(err) })
  }
}

/** Replaces the current canvas (after confirmation). Embedded images are written back as blobs first. */
export async function importWorkflowText(text: string, opts: { skipConfirm?: boolean } = {}): Promise<boolean> {
  const parsed = parseWorkflow(text)
  if (!parsed.ok) {
    toast('导入失败', { kind: 'error', description: parsed.reason })
    return false
  }
  const wf = parsed.workflow
  const hasContent = Object.keys(useCanvasStore.getState().doc.nodes).length > 0
  if (hasContent && !opts.skipConfirm) {
    const ok = await confirm({
      title: '导入工作流？',
      description: `将用文件中的 ${Object.keys(wf.nodes).length} 个节点替换当前画布，当前内容与任务记录会被清除，且无法撤销。`,
      confirmLabel: '替换并导入',
      destructive: true,
    })
    if (!ok) return false
  }
  const assets: Record<string, Asset> = {}
  for (const [id, a] of Object.entries(wf.assets)) {
    if (a.src.type === 'url') {
      assets[id] = { ...a, src: a.src }
    } else {
      const blobKey = newId('blob')
      await persistence.putBlob(blobKey, await dataUrlToBlob(a.src.dataUrl))
      assets[id] = { ...a, src: { type: 'blob', blobKey } }
    }
  }
  const doc: CanvasDocument = { version: SCHEMA_VERSION, viewport: wf.viewport, nodes: wf.nodes, edges: wf.edges, assets, tasks: {} }
  useCanvasStore.getState().replaceDoc(doc)
  clearHistory()
  await persistence.saveNow()
  toast('已导入工作流', { kind: 'success', description: `${Object.keys(wf.nodes).length} 个节点` })
  return true
}

export async function importWorkflowFile(file: File): Promise<boolean> {
  if (file.size > 50 * 1024 * 1024) {
    toast('导入失败', { kind: 'error', description: '文件超过 50 MB' })
    return false
  }
  return importWorkflowText(await file.text())
}
