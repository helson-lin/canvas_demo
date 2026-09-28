// Undo/redo for user edits to the graph. Only nodes + edges are snapshotted: tasks and assets are the
// async source of truth and never roll back. Snapshots share structure with the immutable doc (cheap).
import { useSyncExternalStore } from 'react'
import type { CanvasNode, Edge } from '@/domain'
import { useCanvasStore } from './canvasStore'

interface Snapshot {
  nodes: Record<string, CanvasNode>
  edges: Record<string, Edge>
}

const LIMIT = 100
const COALESCE_MS = 1200

let past: Snapshot[] = []
let future: Snapshot[] = []
let lastKey: string | null = null
let lastAt = 0
let version = 0
const listeners = new Set<() => void>()
const emit = () => {
  version++
  listeners.forEach((l) => l())
}

function current(): Snapshot {
  const { nodes, edges } = useCanvasStore.getState().doc
  return { nodes, edges }
}

/**
 * Record the graph before a user edit. Calls with the same `key` within COALESCE_MS extend one step
 * (typing, arrow nudges), so a burst undoes as a unit.
 */
export function checkpoint(key?: string): void {
  const now = Date.now()
  if (key && key === lastKey && now - lastAt < COALESCE_MS) {
    lastAt = now
    return
  }
  lastKey = key ?? null
  lastAt = now
  past.push(current())
  if (past.length > LIMIT) past.shift()
  future = []
  emit()
}

/**
 * Restore `snap` while keeping what the task system owns: a result node's asset/pending task, a generator's
 * active task, measured sizes, and result nodes (with their result edges) created by generation since then.
 */
export function mergeSnapshot(snap: Snapshot, live: Snapshot): Snapshot {
  const nodes: Record<string, CanvasNode> = {}
  for (const [id, node] of Object.entries(snap.nodes)) {
    const cur = live.nodes[id]
    if (!cur || cur.type !== node.type) {
      nodes[id] = node
      continue
    }
    if (node.type === 'generator' && cur.type === 'generator') {
      nodes[id] = { ...node, size: cur.size, data: { ...node.data, activeTaskId: cur.data.activeTaskId } }
    } else if (node.type === 'image' && cur.type === 'image' && (cur.data.pendingTaskId || node.data.pendingTaskId || isResultNode(live, id))) {
      nodes[id] = { ...node, size: cur.size, data: { ...cur.data } }
    } else {
      nodes[id] = { ...node, size: cur.size }
    }
  }
  const edges: Record<string, Edge> = {}
  for (const [id, edge] of Object.entries(snap.edges)) edges[id] = edge
  for (const edge of Object.values(live.edges)) {
    if (edge.kind !== 'result' || snap.nodes[edge.target] || !nodes[edge.source]) continue
    const target = live.nodes[edge.target]
    if (!target) continue
    nodes[target.id] = target
    edges[edge.id] = edge
  }
  for (const [id, edge] of Object.entries(edges)) if (!nodes[edge.source] || !nodes[edge.target]) delete edges[id]
  return { nodes, edges }
}

function isResultNode(s: Snapshot, nodeId: string): boolean {
  return Object.values(s.edges).some((e) => e.kind === 'result' && e.target === nodeId)
}

function apply(snap: Snapshot): void {
  const store = useCanvasStore.getState()
  const merged = mergeSnapshot(snap, current())
  store.transact((doc) => {
    doc.nodes = merged.nodes
    doc.edges = merged.edges
  })
  const { selection } = useCanvasStore.getState().ui
  store.select({
    nodeIds: selection.nodeIds.filter((id) => merged.nodes[id]),
    edgeIds: selection.edgeIds.filter((id) => merged.edges[id]),
  })
}

export function undo(): boolean {
  const snap = past.pop()
  if (!snap) return false
  future.push(current())
  lastKey = null
  apply(snap)
  emit()
  return true
}

export function redo(): boolean {
  const snap = future.pop()
  if (!snap) return false
  past.push(current())
  lastKey = null
  apply(snap)
  emit()
  return true
}

/** After loading or importing a document, old steps no longer apply. */
export function clearHistory(): void {
  past = []
  future = []
  lastKey = null
  emit()
}

export function useHistoryState(): { canUndo: boolean; canRedo: boolean } {
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => version,
  )
  return { canUndo: past.length > 0, canRedo: future.length > 0 }
}
