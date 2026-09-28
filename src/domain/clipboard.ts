import { newId } from './ids'
import type { CanvasDocument, CanvasNode, Edge, Vec2 } from './types'

export interface ClipboardData {
  nodes: CanvasNode[]
  edges: Edge[]
}

/** Selected nodes plus the input edges running between them. Result edges stay behind (provenance isn't copied). */
export function copyNodes(doc: CanvasDocument, nodeIds: string[]): ClipboardData | null {
  const ids = new Set(nodeIds.filter((id) => doc.nodes[id]))
  if (!ids.size) return null
  return {
    nodes: [...ids].map((id) => doc.nodes[id]!),
    edges: Object.values(doc.edges).filter((e) => e.kind === 'input' && ids.has(e.source) && ids.has(e.target)),
  }
}

/**
 * Fresh copies offset by `offset`: new IDs, no task links (a copied result is a plain image of the same
 * immutable asset; a copied generator starts idle), no sample flag.
 */
export function cloneForPaste(clip: ClipboardData, offset: Vec2, now: number): ClipboardData {
  const idMap = new Map<string, string>()
  const nodes = clip.nodes.map((n): CanvasNode => {
    const id = newId('node')
    idMap.set(n.id, id)
    const base = { id, position: { x: n.position.x + offset.x, y: n.position.y + offset.y }, size: { ...n.size }, createdAt: now }
    switch (n.type) {
      case 'image':
        return { ...base, type: 'image', data: { assetId: n.data.assetId } }
      case 'prompt':
        return { ...base, type: 'prompt', data: { text: n.data.text } }
      case 'generator':
        return { ...base, type: 'generator', data: { params: { ...n.data.params }, activeTaskId: null } }
    }
  })
  const edges = clip.edges.map((e) => ({ id: newId('edge'), source: idMap.get(e.source)!, target: idMap.get(e.target)!, kind: e.kind }))
  return { nodes, edges }
}
