// Pure domain types. No React / DOM / store imports allowed in src/domain.

export const SCHEMA_VERSION = 1

export type Vec2 = { x: number; y: number }

/** screen = world * zoom + (x, y) */
export interface Viewport {
  x: number
  y: number
  zoom: number
}

export type NodeType = 'image' | 'prompt' | 'generator'

export type AspectRatio = '1:1' | '16:9' | '9:16'

export interface GenParams {
  aspectRatio: AspectRatio
  seed?: number
}

interface BaseNode {
  id: string
  type: NodeType
  /** World coordinates. Never screen pixels. */
  position: Vec2
  size: { w: number; h: number }
  /** Marks nodes created by "load sample". */
  sample?: boolean
  createdAt: number
}

export interface ImageNode extends BaseNode {
  type: 'image'
  data: { assetId: string | null; pendingTaskId?: string }
}

export interface PromptNode extends BaseNode {
  type: 'prompt'
  data: { text: string }
}

export interface GeneratorNode extends BaseNode {
  type: 'generator'
  data: { params: GenParams; activeTaskId: string | null }
}

export type CanvasNode = ImageNode | PromptNode | GeneratorNode

export type EdgeKind = 'input' | 'result'

/** input: image/prompt -> generator. result: generator -> result image node (provenance only). */
export interface Edge {
  id: string
  source: string
  target: string
  kind: EdgeKind
}

export type AssetSource = { type: 'url'; url: string } | { type: 'blob'; blobKey: string }

export interface Asset {
  id: string
  kind: 'sample' | 'upload' | 'generated'
  src: AssetSource
  width?: number
  height?: number
  origin?: { taskId: string }
  createdAt: number
}

export type TaskStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'interrupted' | 'cancelled'

export const ACTIVE_TASK_STATUSES: readonly TaskStatus[] = ['queued', 'running']

export interface TaskError {
  code: string
  message: string
}

export interface TaskInputSnapshot {
  imageAssetIds: string[]
  prompts: string[]
}

export interface Task {
  id: string
  generatorNodeId: string
  inputSnapshot: TaskInputSnapshot
  params: GenParams
  status: TaskStatus
  error?: TaskError
  resultAssetId?: string
  resultNodeId?: string
  attempt: number
  /** Previous attempt this task retries, if any. */
  retryOf?: string
  idempotencyKey: string
  /** Id assigned by the task service; absent if the submit response never arrived (resume falls back to idempotencyKey). */
  remoteTaskId?: string
  queuedAt: number
  startedAt?: number
  expectedDurationMs: number
  createdAt: number
  updatedAt: number
}

export interface CanvasDocument {
  version: number
  viewport: Viewport
  nodes: Record<string, CanvasNode>
  edges: Record<string, Edge>
  assets: Record<string, Asset>
  tasks: Record<string, Task>
}

export type ImageNodeView = 'ready' | 'queued' | 'running' | 'failed' | 'missing'

export const DEFAULT_NODE_SIZE: Record<NodeType, { w: number; h: number }> = {
  image: { w: 240, h: 240 },
  prompt: { w: 260, h: 180 },
  generator: { w: 300, h: 420 },
}

export function createEmptyDocument(): CanvasDocument {
  return {
    version: SCHEMA_VERSION,
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: {},
    edges: {},
    assets: {},
    tasks: {},
  }
}
