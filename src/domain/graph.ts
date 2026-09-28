// OWNER: T3 — T0 provides a minimal working version; T3 completes it with tests.
import type { CanvasDocument, Edge, EdgeKind } from './types'

export type ConnectResult = { ok: true } | { ok: false; reason: string }

export function canConnect(
  doc: CanvasDocument,
  source: string,
  target: string,
  kind: EdgeKind = 'input',
): ConnectResult {
  const s = doc.nodes[source]
  const t = doc.nodes[target]
  if (!s || !t) return { ok: false, reason: '节点不存在' }
  if (source === target) return { ok: false, reason: '不能连接到自身' }
  const dup = Object.values(doc.edges).some((e) => e.source === source && e.target === target)
  if (dup) return { ok: false, reason: '连接已存在' }
  if (kind === 'result') {
    return s.type === 'generator' && t.type === 'image' ? { ok: true } : { ok: false, reason: '非法结果连接' }
  }
  if (t.type !== 'generator') return { ok: false, reason: '只能连接到生成节点' }
  if (s.type === 'generator') return { ok: false, reason: '生成节点不能作为输入' }
  return { ok: true }
}

export function edgesOf(doc: CanvasDocument, nodeId: string): Edge[] {
  return Object.values(doc.edges).filter((e) => e.source === nodeId || e.target === nodeId)
}

export function inputEdgesOf(doc: CanvasDocument, generatorId: string): Edge[] {
  return Object.values(doc.edges).filter((e) => e.target === generatorId && e.kind === 'input')
}

export function findDanglingEdges(doc: CanvasDocument): Edge[] {
  return Object.values(doc.edges).filter((e) => !doc.nodes[e.source] || !doc.nodes[e.target])
}
