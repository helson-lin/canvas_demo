// OWNER: T4 — in-browser async task service implementing the domain TaskService contract.
import {
  MOCK_OUTPUTS,
  newId,
  TASK_ERROR_CODES,
  type ResumeTaskRequest,
  type ResumeTaskResponse,
  type SubmitTaskRequest,
  type SubmitTaskResponse,
  type TaskError,
  type TaskService,
  type TaskStatus,
  type TaskStatusResponse,
} from '@/domain'
import { getMockConfig, setMockConfig } from './mockConfig'

/** Tasks older than expected + grace are treated as lost after a reload (ARCHITECTURE §7.1). */
export const RESUME_GRACE_MS = 10_000

interface MockTask {
  taskId: string
  req: SubmitTaskRequest
  status: TaskStatus
  queuedAt: number
  startedAt?: number
  error?: TaskError
  result?: { url: string; width: number; height: number }
  timers: ReturnType<typeof setTimeout>[]
}

export interface MockTaskServiceOptions {
  now?: () => number
}

export function isEmptyInput(inputs: SubmitTaskRequest['inputs']): boolean {
  return inputs.imageAssetIds.length === 0 && inputs.prompts.every((p) => !p.trim())
}

export function createMockTaskService(opts: MockTaskServiceOptions = {}): TaskService {
  const now = opts.now ?? (() => Date.now())
  const tasks = new Map<string, MockTask>()
  const byKey = new Map<string, string>()

  // Outcome is decided up front and deterministically — never by randomness.
  function decideFailure(req: SubmitTaskRequest, consumeFailNext: boolean): TaskError | undefined {
    if (req.inputs.prompts.some((p) => p.includes('#fail'))) {
      return { code: TASK_ERROR_CODES.CONTENT_REJECTED, message: '提示词包含 #fail，内容被拒绝' }
    }
    const cfg = getMockConfig()
    if (cfg.failAll) return { code: TASK_ERROR_CODES.MOCK_FORCED_FAILURE, message: 'Mock：全部失败开关已开启' }
    if (consumeFailNext && cfg.failNext) {
      setMockConfig({ failNext: false })
      return { code: TASK_ERROR_CODES.MOCK_FORCED_FAILURE, message: 'Mock：下一次任务失败' }
    }
    return undefined
  }

  function schedule(t: MockTask, queueLeft: number, runLeft: number, failure: TaskError | undefined): void {
    const q = Math.max(0, queueLeft)
    const r = Math.max(0, runLeft)
    if (t.status === 'queued') {
      t.timers.push(
        setTimeout(() => {
          if (t.status !== 'queued') return
          t.status = 'running'
          t.startedAt = now()
        }, q),
      )
    }
    t.timers.push(
      setTimeout(() => {
        if (t.status !== 'running') return
        if (failure) {
          t.status = 'failed'
          t.error = failure
        } else {
          t.status = 'succeeded'
          t.result = { ...MOCK_OUTPUTS[t.req.params.aspectRatio] }
        }
      }, q + r),
    )
  }

  return {
    async submit(req): Promise<SubmitTaskResponse> {
      const cfg = getMockConfig()
      const expectedDurationMs = cfg.queueMs + cfg.runMs
      const existing = byKey.get(req.idempotencyKey)
      if (existing) return { taskId: existing, expectedDurationMs }
      if (isEmptyInput(req.inputs)) {
        throw Object.assign(new Error('缺少输入'), { code: TASK_ERROR_CODES.EMPTY_INPUT })
      }
      const t: MockTask = { taskId: newId('task'), req, status: 'queued', queuedAt: now(), timers: [] }
      tasks.set(t.taskId, t)
      byKey.set(req.idempotencyKey, t.taskId)
      schedule(t, cfg.queueMs, cfg.runMs, decideFailure(req, true))
      return { taskId: t.taskId, expectedDurationMs }
    },

    async get(taskId): Promise<TaskStatusResponse> {
      const t = tasks.get(taskId)
      if (!t) {
        return { taskId, status: 'failed', error: { code: TASK_ERROR_CODES.NOT_FOUND, message: '任务不存在' } }
      }
      return {
        taskId: t.taskId,
        status: t.status,
        startedAt: t.startedAt,
        error: t.error,
        result: t.result ? { ...t.result } : undefined,
      }
    },

    async cancel(taskId): Promise<void> {
      const t = tasks.get(taskId)
      if (!t) return
      t.timers.forEach(clearTimeout)
      t.timers = []
      if (t.status === 'queued' || t.status === 'running') t.status = 'cancelled'
    },

    async resume(req: ResumeTaskRequest): Promise<ResumeTaskResponse> {
      // A real backend would find the task by id, or by idempotencyKey when the submit response was lost.
      const knownId = (req.taskId && tasks.has(req.taskId) ? req.taskId : undefined) ?? byKey.get(req.idempotencyKey)
      if (knownId) return { resumable: true, taskId: knownId }
      const elapsed = now() - req.queuedAt
      if (elapsed > req.expectedDurationMs + RESUME_GRACE_MS) {
        return { resumable: false, reason: '任务已超过预期时长' }
      }
      // Re-split the original schedule so the task finishes near its original ETA.
      const queueMs = Math.min(getMockConfig().queueMs, req.expectedDurationMs)
      const runMs = req.expectedDurationMs - queueMs
      const t: MockTask = { taskId: req.taskId ?? `remote_${req.localTaskId}`, req, status: 'queued', queuedAt: req.queuedAt, timers: [] }
      let queueLeft = queueMs - elapsed
      let runLeft = runMs
      if (req.startedAt !== undefined) {
        t.status = 'running'
        t.startedAt = req.startedAt
        queueLeft = 0
        runLeft = runMs - (now() - req.startedAt)
      }
      tasks.set(t.taskId, t)
      byKey.set(req.idempotencyKey, t.taskId)
      // failNext was already consumed by the original submit; don't consume it again.
      schedule(t, queueLeft, runLeft, decideFailure(req, false))
      return { resumable: true, taskId: t.taskId }
    },
  }
}
