// Task service contract. Mock implementation lives in src/services; a future HTTP
// implementation must satisfy the same interface (see ARCHITECTURE.md §10).
import type { GenParams, TaskError, TaskInputSnapshot, TaskStatus } from './types'

export interface SubmitTaskRequest {
  idempotencyKey: string
  generatorNodeId: string
  inputs: TaskInputSnapshot
  params: GenParams
}

export interface SubmitTaskResponse {
  taskId: string
  expectedDurationMs: number
}

export interface TaskStatusResponse {
  taskId: string
  status: TaskStatus
  startedAt?: number
  error?: TaskError
  result?: { url: string; width?: number; height?: number }
}

export interface ResumeTaskRequest extends SubmitTaskRequest {
  taskId: string
  queuedAt: number
  startedAt?: number
  expectedDurationMs: number
}

export type ResumeTaskResponse = { resumable: true } | { resumable: false; reason: string }

export interface TaskService {
  submit(req: SubmitTaskRequest): Promise<SubmitTaskResponse>
  get(taskId: string): Promise<TaskStatusResponse>
  cancel(taskId: string): Promise<void>
  /** Re-attach a task persisted before a page reload. */
  resume(req: ResumeTaskRequest): Promise<ResumeTaskResponse>
}

export const TASK_ERROR_CODES = {
  CONTENT_REJECTED: 'CONTENT_REJECTED',
  MOCK_FORCED_FAILURE: 'MOCK_FORCED_FAILURE',
  EMPTY_INPUT: 'EMPTY_INPUT',
  INTERRUPTED: 'INTERRUPTED',
  TIMEOUT: 'TIMEOUT',
  NOT_FOUND: 'NOT_FOUND',
} as const
