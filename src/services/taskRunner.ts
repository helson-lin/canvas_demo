// OWNER: T4 — drives Task state in the store (submit, poll, success/failure, retry, resume).
import {
  isTaskActive,
  newId,
  selectActiveTask,
  selectGeneratorInputs,
  findFreePosition,
  resultNodeSize,
  TASK_ERROR_CODES,
  type CanvasDocument,
  type ImageNode,
  type Task,
  type TaskError,
  type TaskService,
  type TaskStatusResponse,
} from '@/domain'
import type { PersistenceAdapter } from '@/persistence/api'
import { persistence as defaultPersistence } from '@/persistence/persist'
import { persistRemote as defaultPersistRemote } from '@/services/assetStore'
import { createMockTaskService } from '@/services/mockTaskService'
import { getMockConfig } from '@/services/mockConfig'
import { useCanvasStore } from '@/store/canvasStore'
import { toast } from '@/ui/toast'

export const POLL_INTERVAL_MS = 500
export const TIMEOUT_FACTOR = 3
export const RESULT_GAP_PX = 40

export interface TaskRunnerDeps {
  service: TaskService
  persistRemote: (url: string, originTaskId: string) => Promise<string>
  persistence: Pick<PersistenceAdapter, 'saveNow'>
  now: () => number
}

let deps: TaskRunnerDeps = {
  service: createMockTaskService(),
  persistRemote: defaultPersistRemote,
  persistence: defaultPersistence,
  now: () => Date.now(),
}

interface Tracker {
  remoteId: string
  pollTimer?: ReturnType<typeof setTimeout>
  guardTimer?: ReturnType<typeof setTimeout>
  lastStatus?: string
}
// Local task id -> service task id + timers. In-memory only: after reload, resume re-attaches under the local id.
const trackers = new Map<string, Tracker>()

/** Test/DI hook. Stops all in-flight polling so a fresh configuration starts clean. */
export function configureTaskRunner(patch: Partial<TaskRunnerDeps>): void {
  resetTaskRunner()
  deps = { ...deps, ...patch }
}

export function resetTaskRunner(): void {
  for (const t of trackers.values()) stopTimers(t)
  trackers.clear()
}

function stopTimers(t: Tracker): void {
  if (t.pollTimer) clearTimeout(t.pollTimer)
  if (t.guardTimer) clearTimeout(t.guardTimer)
  t.pollTimer = undefined
  t.guardTimer = undefined
}

const store = () => useCanvasStore.getState()
const doc = () => store().doc

function save(): Promise<void> {
  return deps.persistence.saveNow().catch(() => undefined)
}

function fail(taskId: string, error: TaskError): void {
  const task = doc().tasks[taskId]
  if (!task || !isTaskActive(task)) return
  store().patchTask(taskId, { status: 'failed', error })
  finishTracking(taskId)
  void save()
}

function finishTracking(taskId: string): void {
  const t = trackers.get(taskId)
  if (t) stopTimers(t)
  trackers.delete(taskId)
}

function buildInputs(d: CanvasDocument, generatorId: string) {
  const inputs = selectGeneratorInputs(d, generatorId)
  return {
    imageAssetIds: inputs.images.flatMap((i) => (i.asset ? [i.asset.id] : [])),
    prompts: inputs.prompts.map((p) => p.text).filter((t) => t.trim().length > 0),
  }
}

export async function startGeneration(generatorId: string): Promise<string | null> {
  const d = doc()
  const gen = d.nodes[generatorId]
  if (!gen || gen.type !== 'generator') return null
  if (isTaskActive(selectActiveTask(d, generatorId))) {
    toast('任务进行中', { description: '请等待当前任务完成' })
    return null
  }
  const inputSnapshot = buildInputs(d, generatorId)
  if (inputSnapshot.imageAssetIds.length === 0 && inputSnapshot.prompts.length === 0) {
    toast('缺少输入', { kind: 'error', description: `${TASK_ERROR_CODES.EMPTY_INPUT}：请连接图片或提示词` })
    return null
  }
  const params = { ...gen.data.params }
  const now = deps.now()
  const cfg = getMockConfig()
  const taskId = newId('task')
  const placeholderId = newId('node')
  const task: Task = {
    id: taskId,
    generatorNodeId: generatorId,
    inputSnapshot,
    params,
    status: 'queued',
    resultNodeId: placeholderId,
    attempt: 1,
    idempotencyKey: newId('idem'),
    queuedAt: now,
    expectedDurationMs: cfg.queueMs + cfg.runMs,
    createdAt: now,
    updatedAt: now,
  }
  store().transact((draft) => {
    const g = draft.nodes[generatorId]
    if (!g || g.type !== 'generator') return
    const placeholder: ImageNode = {
      id: placeholderId,
      type: 'image',
      position: findFreePosition(
        Object.values(draft.nodes),
        { x: g.position.x + g.size.w + RESULT_GAP_PX, y: g.position.y },
        resultNodeSize(params.aspectRatio),
        { x: 0, y: 24 },
      ),
      size: resultNodeSize(params.aspectRatio),
      createdAt: now,
      data: { assetId: null, pendingTaskId: taskId },
    }
    draft.nodes[placeholderId] = placeholder
    const edgeId = newId('edge')
    draft.edges[edgeId] = { id: edgeId, source: generatorId, target: placeholderId, kind: 'result' }
    draft.tasks[taskId] = task
    g.data.activeTaskId = taskId
  })
  await save()
  await submitTask(task)
  return taskId
}

async function submitTask(task: Task): Promise<void> {
  try {
    const res = await deps.service.submit({
      idempotencyKey: task.idempotencyKey,
      generatorNodeId: task.generatorNodeId,
      inputs: task.inputSnapshot,
      params: task.params,
    })
    store().patchTask(task.id, { remoteTaskId: res.taskId, expectedDurationMs: res.expectedDurationMs })
    void save()
    track(task.id, res.taskId)
  } catch (err) {
    const code = (err as { code?: unknown }).code
    fail(task.id, {
      code: typeof code === 'string' ? code : 'SUBMIT_FAILED',
      message: err instanceof Error ? err.message : '提交失败',
    })
    toast('提交失败', { kind: 'error' })
  }
}

function track(taskId: string, remoteId: string): void {
  const task = doc().tasks[taskId]
  if (!task) return
  const t: Tracker = { remoteId, lastStatus: task.status }
  trackers.set(taskId, t)
  // Guard is measured from the original queuedAt so resumed tasks keep their deadline.
  const deadline = task.queuedAt + task.expectedDurationMs * TIMEOUT_FACTOR - deps.now()
  t.guardTimer = setTimeout(
    () => fail(taskId, { code: TASK_ERROR_CODES.TIMEOUT, message: '任务超时' }),
    Math.max(0, deadline),
  )
  schedulePoll(taskId)
}

function schedulePoll(taskId: string): void {
  const t = trackers.get(taskId)
  if (!t) return
  t.pollTimer = setTimeout(() => void poll(taskId), POLL_INTERVAL_MS)
}

async function poll(taskId: string): Promise<void> {
  const t = trackers.get(taskId)
  if (!t) return
  let res: TaskStatusResponse
  try {
    res = await deps.service.get(t.remoteId)
  } catch {
    schedulePoll(taskId)
    return
  }
  if (trackers.get(taskId) !== t) return
  const task = doc().tasks[taskId]
  // Cancelled locally (e.g. placeholder deleted) or gone: stop and drop any result.
  if (!task || !isTaskActive(task)) {
    finishTracking(taskId)
    void deps.service.cancel(t.remoteId).catch(() => undefined)
    return
  }
  if (res.status === t.lastStatus) {
    schedulePoll(taskId)
    return
  }
  t.lastStatus = res.status
  switch (res.status) {
    case 'queued':
      schedulePoll(taskId)
      return
    case 'running':
      store().patchTask(taskId, { status: 'running', startedAt: res.startedAt ?? deps.now() })
      void save()
      schedulePoll(taskId)
      return
    case 'succeeded':
      stopTimers(t)
      await complete(taskId, res)
      return
    case 'failed':
    case 'interrupted':
    case 'cancelled':
      store().patchTask(taskId, {
        status: res.status,
        error: res.error ?? { code: 'UNKNOWN', message: '任务失败' },
      })
      finishTracking(taskId)
      void save()
      return
  }
}

function placeholderOk(taskId: string): boolean {
  const d = doc()
  const task = d.tasks[taskId]
  if (!task || !isTaskActive(task) || !task.resultNodeId) return false
  const node = d.nodes[task.resultNodeId]
  return !!node && node.type === 'image' && node.data.pendingTaskId === taskId
}

async function complete(taskId: string, res: TaskStatusResponse): Promise<void> {
  if (!res.result || !placeholderOk(taskId)) {
    finishTracking(taskId)
    if (!res.result) fail(taskId, { code: 'NO_RESULT', message: '任务未返回结果' })
    return
  }
  let assetId: string
  try {
    // Blob first, doc second (AGENTS §3.7).
    assetId = await deps.persistRemote(res.result.url, taskId)
  } catch (err) {
    finishTracking(taskId)
    fail(taskId, { code: 'ASSET_PERSIST_FAILED', message: err instanceof Error ? err.message : '结果保存失败' })
    return
  }
  finishTracking(taskId)
  const now = deps.now()
  let applied = false
  store().transact((draft) => {
    const task = draft.tasks[taskId]
    const node = task?.resultNodeId ? draft.nodes[task.resultNodeId] : undefined
    if (!task || !isTaskActive(task) || !node || node.type !== 'image' || node.data.pendingTaskId !== taskId) {
      // Dropped: don't leave a generated asset that nothing references.
      const orphan = draft.assets[assetId]
      if (orphan?.origin?.taskId === taskId) delete draft.assets[assetId]
      return
    }
    node.data.assetId = assetId
    delete node.data.pendingTaskId
    task.status = 'succeeded'
    task.resultAssetId = assetId
    task.error = undefined
    task.updatedAt = now
    applied = true
  })
  await save()
  if (applied) toast('生成完成', { kind: 'success' })
}

export async function retryTask(taskId: string): Promise<string | null> {
  const d = doc()
  const old = d.tasks[taskId]
  if (!old) return null
  if (isTaskActive(old)) {
    toast('任务进行中')
    return null
  }
  if (isTaskActive(selectActiveTask(d, old.generatorNodeId))) {
    toast('任务进行中', { description: '请等待当前任务完成' })
    return null
  }
  const placeholderId = old.resultNodeId
  const placeholder = placeholderId ? d.nodes[placeholderId] : undefined
  if (!placeholder || placeholder.type !== 'image') {
    toast('结果节点已删除，无法重试', { kind: 'error' })
    return null
  }
  const now = deps.now()
  const cfg = getMockConfig()
  const task: Task = {
    id: newId('task'),
    generatorNodeId: old.generatorNodeId,
    inputSnapshot: structuredClone(old.inputSnapshot),
    params: { ...old.params },
    status: 'queued',
    resultNodeId: placeholderId,
    attempt: old.attempt + 1,
    retryOf: old.id,
    idempotencyKey: newId('idem'),
    queuedAt: now,
    expectedDurationMs: cfg.queueMs + cfg.runMs,
    createdAt: now,
    updatedAt: now,
  }
  store().transact((draft) => {
    draft.tasks[task.id] = task
    const node = draft.nodes[placeholderId!]
    if (node?.type === 'image') {
      node.data.assetId = null
      node.data.pendingTaskId = task.id
    }
    const g = draft.nodes[task.generatorNodeId]
    if (g?.type === 'generator') g.data.activeTaskId = task.id
  })
  await save()
  await submitTask(task)
  return task.id
}

export async function cancelTask(taskId: string): Promise<void> {
  const task = doc().tasks[taskId]
  if (!task || !isTaskActive(task)) return
  const t = trackers.get(taskId)
  finishTracking(taskId)
  store().patchTask(taskId, { status: 'cancelled' })
  await save()
  if (t) await deps.service.cancel(t.remoteId).catch(() => undefined)
}

/** Called by persistence after hydration. */
export async function resumeTasks(): Promise<void> {
  const pending = Object.values(doc().tasks).filter((t) => isTaskActive(t) && !trackers.has(t.id))
  for (const task of pending) {
    let resumable = false
    let remoteId = task.remoteTaskId ?? task.id
    try {
      const res = await deps.service.resume({
        taskId: task.remoteTaskId,
        localTaskId: task.id,
        idempotencyKey: task.idempotencyKey,
        generatorNodeId: task.generatorNodeId,
        inputs: task.inputSnapshot,
        params: task.params,
        queuedAt: task.queuedAt,
        startedAt: task.startedAt,
        expectedDurationMs: task.expectedDurationMs,
      })
      resumable = res.resumable
      if (res.resumable) remoteId = res.taskId
    } catch {
      resumable = false
    }
    if (resumable) {
      if (remoteId !== task.remoteTaskId) store().patchTask(task.id, { remoteTaskId: remoteId })
      track(task.id, remoteId)
    } else {
      store().patchTask(task.id, {
        status: 'interrupted',
        error: { code: TASK_ERROR_CODES.INTERRUPTED, message: '页面刷新导致任务中断' },
      })
    }
  }
  if (pending.length > 0) await save()
}
