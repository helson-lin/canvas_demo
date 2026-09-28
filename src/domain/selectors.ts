import { inputEdgesOf } from './graph'
import {
  ACTIVE_TASK_STATUSES,
  type Asset,
  type CanvasDocument,
  type ImageNodeView,
  type Task,
} from './types'

export interface GeneratorInputs {
  images: { nodeId: string; asset: Asset | null }[]
  prompts: { nodeId: string; text: string }[]
}

export function selectGeneratorInputs(doc: CanvasDocument, generatorId: string): GeneratorInputs {
  const result: GeneratorInputs = { images: [], prompts: [] }
  for (const edge of inputEdgesOf(doc, generatorId)) {
    const node = doc.nodes[edge.source]
    if (!node) continue
    if (node.type === 'image') {
      result.images.push({
        nodeId: node.id,
        asset: node.data.assetId ? (doc.assets[node.data.assetId] ?? null) : null,
      })
    } else if (node.type === 'prompt') {
      result.prompts.push({ nodeId: node.id, text: node.data.text })
    }
  }
  return result
}

export function isTaskActive(task: Task | undefined): boolean {
  return !!task && ACTIVE_TASK_STATUSES.includes(task.status)
}

export function selectActiveTask(doc: CanvasDocument, generatorId: string): Task | undefined {
  const node = doc.nodes[generatorId]
  if (!node || node.type !== 'generator' || !node.data.activeTaskId) return undefined
  return doc.tasks[node.data.activeTaskId]
}

/** Image node display state is derived from its task, never stored on the node (ARCHITECTURE §7.1). */
export function selectImageNodeView(doc: CanvasDocument, nodeId: string): ImageNodeView {
  const node = doc.nodes[nodeId]
  if (!node || node.type !== 'image') return 'missing'
  if (node.data.assetId) return doc.assets[node.data.assetId] ? 'ready' : 'missing'
  const task = node.data.pendingTaskId ? doc.tasks[node.data.pendingTaskId] : undefined
  if (!task) return 'missing'
  switch (task.status) {
    case 'queued':
      return 'queued'
    case 'running':
      return 'running'
    case 'failed':
    case 'interrupted':
    case 'cancelled':
      return 'failed'
    case 'succeeded':
      return 'missing'
  }
}

export interface RemovalSummary {
  nodes: number
  edges: number
  /** Queued/running tasks that removing these nodes will cancel. */
  activeTasks: number
}

/** What deleting `nodeIds` will take with it — shown in the delete confirmation. */
export function summarizeNodeRemoval(doc: CanvasDocument, nodeIds: string[]): RemovalSummary {
  const ids = new Set(nodeIds.filter((id) => doc.nodes[id]))
  const edges = Object.values(doc.edges).filter((e) => ids.has(e.source) || ids.has(e.target)).length
  const tasks = new Set<string>()
  for (const id of ids) {
    const node = doc.nodes[id]
    const taskId =
      node?.type === 'generator' ? node.data.activeTaskId : node?.type === 'image' ? node.data.pendingTaskId : undefined
    if (taskId && isTaskActive(doc.tasks[taskId])) tasks.add(taskId)
  }
  return { nodes: ids.size, edges, activeTasks: tasks.size }
}
