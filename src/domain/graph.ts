// OWNER: T3 — connection rules, edge queries and pure edge geometry.
import type { CanvasDocument, CanvasNode, Edge, EdgeKind, Vec2 } from './types'

export type ConnectResult = { ok: true } | { ok: false; reason: string }

export type HandleSide = 'in' | 'out'

/**
 * `kind: 'input'` is what users create (image/prompt -> generator).
 * `kind: 'result'` is reserved for the task system (generator -> result image).
 */
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
  if (kind === 'result') {
    if (s.type !== 'generator' || t.type !== 'image') {
      return { ok: false, reason: '结果连接只能从生成节点指向图片节点' }
    }
  } else {
    if (s.type === 'generator') return { ok: false, reason: '生成节点不能作为输入' }
    if (t.type !== 'generator') return { ok: false, reason: '只能连接到生成节点' }
  }
  // Any existing edge between the pair blocks a new one, regardless of kind.
  const dup = Object.values(doc.edges).some((e) => e.source === source && e.target === target)
  if (dup) return { ok: false, reason: '连接已存在' }
  return { ok: true }
}

export function edgesOf(doc: CanvasDocument, nodeId: string): Edge[] {
  return Object.values(doc.edges).filter((e) => e.source === nodeId || e.target === nodeId)
}

export function inputEdgesOf(doc: CanvasDocument, generatorId: string): Edge[] {
  return Object.values(doc.edges).filter((e) => e.target === generatorId && e.kind === 'input')
}

/** Spec name; alias of `inputEdgesOf`. */
export const inputsOf = inputEdgesOf

export function findDanglingEdges(doc: CanvasDocument): Edge[] {
  return Object.values(doc.edges).filter((e) => !doc.nodes[e.source] || !doc.nodes[e.target])
}

/** Users drag from image/prompt outputs into generator inputs. */
export function hasHandle(node: CanvasNode, side: HandleSide): boolean {
  return side === 'out' ? node.type !== 'generator' : node.type === 'generator'
}

/** World-space handle anchor: left ('in') / right ('out') edge at the vertical center of `size`. */
export function handlePoint(node: CanvasNode, side: HandleSide): Vec2 {
  return {
    x: side === 'out' ? node.position.x + node.size.w : node.position.x,
    y: node.position.y + node.size.h / 2,
  }
}

/** Cubic bezier with horizontal tangents at both ends. */
export function bezierPath(a: Vec2, b: Vec2): string {
  const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5)
  return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`
}

/** B(0.5) of `bezierPath(a, b)`; control points are symmetric so it equals the chord midpoint. */
export function bezierMidpoint(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

/** World endpoints for rendering an edge; null when either node is missing. */
export function edgeEndpoints(doc: CanvasDocument, edge: Edge): { a: Vec2; b: Vec2 } | null {
  const s = doc.nodes[edge.source]
  const t = doc.nodes[edge.target]
  if (!s || !t) return null
  return { a: handlePoint(s, 'out'), b: handlePoint(t, 'in') }
}
