// Workflow JSON: a portable canvas (nodes, edges, assets, viewport) without task history.
import { findDanglingEdges } from './graph'
import { SCHEMA_VERSION, type Asset, type CanvasDocument, type CanvasNode, type Edge, type Viewport } from './types'

export const WORKFLOW_FORMAT = 'ai-canvas-workflow'

export type WorkflowAsset = Omit<Asset, 'src'> & {
  src: { type: 'url'; url: string } | { type: 'data'; dataUrl: string }
}

export interface WorkflowFile {
  format: typeof WORKFLOW_FORMAT
  version: number
  exportedAt: string
  viewport: Viewport
  nodes: Record<string, CanvasNode>
  edges: Record<string, Edge>
  assets: Record<string, WorkflowAsset>
}

/**
 * Tasks are runtime history, not part of a workflow: pending/active task links are dropped, so an in-flight
 * placeholder exports as an empty image node. Only assets referenced by nodes are included; blob assets
 * must be supplied as data URLs.
 */
export function toWorkflow(doc: CanvasDocument, blobDataUrls: Record<string, string>, exportedAt: string): WorkflowFile {
  const nodes: Record<string, CanvasNode> = {}
  const assets: Record<string, WorkflowAsset> = {}
  for (const node of Object.values(doc.nodes)) {
    if (node.type === 'image') {
      const asset = node.data.assetId ? doc.assets[node.data.assetId] : undefined
      let assetId: string | null = null
      if (asset) {
        const src = asset.src.type === 'url' ? asset.src : blobDataUrls[asset.id] ? { type: 'data' as const, dataUrl: blobDataUrls[asset.id]! } : null
        if (src) {
          const { origin: _origin, ...rest } = asset
          assets[asset.id] = { ...rest, src }
          assetId = asset.id
        }
      }
      nodes[node.id] = { ...node, data: { assetId } }
    } else if (node.type === 'generator') {
      nodes[node.id] = { ...node, data: { ...node.data, activeTaskId: null } }
    } else {
      nodes[node.id] = node
    }
  }
  return { format: WORKFLOW_FORMAT, version: SCHEMA_VERSION, exportedAt, viewport: doc.viewport, nodes, edges: doc.edges, assets }
}

export type ParseResult = { ok: true; workflow: WorkflowFile } | { ok: false; reason: string }

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

function validNode(n: unknown): n is CanvasNode {
  if (!isObj(n) || typeof n.id !== 'string' || !isObj(n.position) || !isObj(n.size) || !isObj(n.data)) return false
  if (!isNum(n.position.x) || !isNum(n.position.y) || !isNum(n.size.w) || !isNum(n.size.h)) return false
  if (n.type === 'image') return n.data.assetId === null || typeof n.data.assetId === 'string'
  if (n.type === 'prompt') return typeof n.data.text === 'string'
  if (n.type === 'generator') return isObj(n.data.params) && ['1:1', '16:9', '9:16'].includes(String(n.data.params.aspectRatio))
  return false
}

/** Strict-enough validation for a user-supplied file; never trusts shapes it didn't check. */
export function parseWorkflow(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, reason: '不是有效的 JSON 文件' }
  }
  if (!isObj(raw) || raw.format !== WORKFLOW_FORMAT) return { ok: false, reason: '不是画布工作流文件' }
  if (!isNum(raw.version) || raw.version > SCHEMA_VERSION) return { ok: false, reason: `工作流版本 ${String(raw.version)} 高于当前支持的 ${SCHEMA_VERSION}` }
  if (!isObj(raw.nodes) || !isObj(raw.edges) || !isObj(raw.assets)) return { ok: false, reason: '文件缺少节点、连线或资源' }

  const nodes: Record<string, CanvasNode> = {}
  for (const [id, n] of Object.entries(raw.nodes)) {
    if (!validNode(n) || n.id !== id) return { ok: false, reason: `节点 ${id} 格式无效` }
    nodes[id] = n
  }
  const assets: Record<string, WorkflowAsset> = {}
  for (const [id, a] of Object.entries(raw.assets)) {
    if (!isObj(a) || !isObj(a.src)) return { ok: false, reason: `资源 ${id} 格式无效` }
    const src = a.src
    const okSrc = (src.type === 'url' && typeof src.url === 'string') || (src.type === 'data' && typeof src.dataUrl === 'string' && src.dataUrl.startsWith('data:image/'))
    if (!okSrc) return { ok: false, reason: `资源 ${id} 来源无效` }
    assets[id] = a as unknown as WorkflowAsset
  }
  const edges: Record<string, Edge> = {}
  for (const [id, e] of Object.entries(raw.edges)) {
    if (!isObj(e) || typeof e.source !== 'string' || typeof e.target !== 'string') return { ok: false, reason: `连线 ${id} 格式无效` }
    edges[id] = { id, source: e.source, target: e.target, kind: e.kind === 'result' ? 'result' : 'input' }
  }
  for (const node of Object.values(nodes)) {
    if (node.type === 'image' && node.data.assetId && !assets[node.data.assetId]) nodes[node.id] = { ...node, data: { assetId: null } }
  }
  const probe = { version: SCHEMA_VERSION, viewport: { x: 0, y: 0, zoom: 1 }, nodes, edges, assets: {}, tasks: {} } as CanvasDocument
  for (const dangling of findDanglingEdges(probe)) delete edges[dangling.id]
  const vp = isObj(raw.viewport) && isNum(raw.viewport.x) && isNum(raw.viewport.y) && isNum(raw.viewport.zoom) ? (raw.viewport as unknown as Viewport) : { x: 0, y: 0, zoom: 1 }
  return {
    ok: true,
    workflow: { format: WORKFLOW_FORMAT, version: SCHEMA_VERSION, exportedAt: String(raw.exportedAt ?? ''), viewport: vp, nodes, edges, assets },
  }
}
