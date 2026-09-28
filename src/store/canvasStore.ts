// Shared contract — changes go through the reviewer (see AGENTS.md).
import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import {
  ACTIVE_TASK_STATUSES,
  canConnect,
  createEmptyDocument,
  DEFAULT_NODE_SIZE,
  newId,
  type Asset,
  type CanvasDocument,
  type CanvasNode,
  type EdgeKind,
  type NodeType,
  type Task,
  type Vec2,
  type Viewport,
} from '@/domain'

export interface Selection {
  nodeIds: string[]
  edgeIds: string[]
}

export interface CanvasState {
  doc: CanvasDocument
  ui: { selection: Selection; hydrated: boolean }

  addNode: (type: NodeType, position: Vec2, opts?: { sample?: boolean; data?: Partial<CanvasNode['data']> }) => string
  updateNodeData: <T extends CanvasNode>(id: string, patch: Partial<T['data']>) => void
  moveNode: (id: string, position: Vec2) => void
  /** Records the rendered size (height follows content); keeps handles, edges and fit-all accurate. */
  setNodeSize: (id: string, size: { w: number; h: number }) => void
  /** Removes nodes, cascades their edges, cancels their active tasks. */
  removeNodes: (ids: string[]) => void
  /** Returns the new edge id, or null when `canConnect` rejects. */
  addEdge: (source: string, target: string, kind?: EdgeKind) => string | null
  removeEdges: (ids: string[]) => void
  setViewport: (vp: Viewport) => void
  select: (sel: Partial<Selection>) => void
  clearSelection: () => void
  replaceDoc: (doc: CanvasDocument) => void
  setHydrated: (hydrated: boolean) => void
  upsertAsset: (asset: Asset) => void
  upsertTask: (task: Task) => void
  patchTask: (id: string, patch: Partial<Task>) => void
  /** Escape hatch for multi-entity atomic updates (e.g. task submit / success). */
  transact: (fn: (doc: CanvasDocument) => void) => void
}

function defaultData(type: NodeType): CanvasNode['data'] {
  switch (type) {
    case 'image':
      return { assetId: null }
    case 'prompt':
      return { text: '' }
    case 'generator':
      return { params: { aspectRatio: '1:1' }, activeTaskId: null }
  }
}

export const useCanvasStore = create<CanvasState>()(
  immer((set) => ({
    doc: createEmptyDocument(),
    ui: { selection: { nodeIds: [], edgeIds: [] }, hydrated: false },

    addNode: (type, position, opts) => {
      const id = newId('node')
      set((s) => {
        s.doc.nodes[id] = {
          id,
          type,
          position: { ...position },
          size: { ...DEFAULT_NODE_SIZE[type] },
          sample: opts?.sample,
          createdAt: Date.now(),
          data: { ...defaultData(type), ...opts?.data },
        } as CanvasNode
      })
      return id
    },

    updateNodeData: (id, patch) =>
      set((s) => {
        const node = s.doc.nodes[id]
        if (node) Object.assign(node.data, patch)
      }),

    moveNode: (id, position) =>
      set((s) => {
        const node = s.doc.nodes[id]
        if (node) node.position = { ...position }
      }),

    setNodeSize: (id, size) =>
      set((s) => {
        const node = s.doc.nodes[id]
        if (node && (node.size.w !== size.w || node.size.h !== size.h)) node.size = { ...size }
      }),

    removeNodes: (ids) =>
      set((s) => {
        const removed = new Set(ids)
        const now = Date.now()
        for (const id of ids) {
          const node = s.doc.nodes[id]
          if (!node) continue
          const taskIds: string[] = []
          if (node.type === 'generator' && node.data.activeTaskId) taskIds.push(node.data.activeTaskId)
          if (node.type === 'image' && node.data.pendingTaskId) taskIds.push(node.data.pendingTaskId)
          for (const tid of taskIds) {
            const task = s.doc.tasks[tid]
            if (task && ACTIVE_TASK_STATUSES.includes(task.status)) {
              task.status = 'cancelled'
              task.updatedAt = now
            }
          }
          delete s.doc.nodes[id]
        }
        for (const edge of Object.values(s.doc.edges)) {
          if (removed.has(edge.source) || removed.has(edge.target)) delete s.doc.edges[edge.id]
        }
        s.ui.selection.nodeIds = s.ui.selection.nodeIds.filter((id) => !removed.has(id))
        s.ui.selection.edgeIds = s.ui.selection.edgeIds.filter((id) => !!s.doc.edges[id])
      }),

    addEdge: (source, target, kind = 'input') => {
      let created: string | null = null
      set((s) => {
        if (!canConnect(s.doc, source, target, kind).ok) return
        const id = newId('edge')
        s.doc.edges[id] = { id, source, target, kind }
        created = id
      })
      return created
    },

    removeEdges: (ids) =>
      set((s) => {
        for (const id of ids) delete s.doc.edges[id]
        s.ui.selection.edgeIds = s.ui.selection.edgeIds.filter((id) => !ids.includes(id))
      }),

    setViewport: (vp) =>
      set((s) => {
        s.doc.viewport = { ...vp }
      }),

    select: (sel) =>
      set((s) => {
        s.ui.selection = { nodeIds: sel.nodeIds ?? [], edgeIds: sel.edgeIds ?? [] }
      }),

    clearSelection: () =>
      set((s) => {
        s.ui.selection = { nodeIds: [], edgeIds: [] }
      }),

    replaceDoc: (doc) =>
      set((s) => {
        s.doc = doc
        s.ui.selection = { nodeIds: [], edgeIds: [] }
      }),

    setHydrated: (hydrated) =>
      set((s) => {
        s.ui.hydrated = hydrated
      }),

    upsertAsset: (asset) =>
      set((s) => {
        s.doc.assets[asset.id] = asset
      }),

    upsertTask: (task) =>
      set((s) => {
        s.doc.tasks[task.id] = task
      }),

    patchTask: (id, patch) =>
      set((s) => {
        const task = s.doc.tasks[id]
        if (task) Object.assign(task, patch, { updatedAt: Date.now() })
      }),

    transact: (fn) => set((s) => fn(s.doc)),
  })),
)

export const getDoc = () => useCanvasStore.getState().doc
