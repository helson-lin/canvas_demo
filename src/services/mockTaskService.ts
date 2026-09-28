// OWNER: T4 — in-browser async task service implementing the domain TaskService contract.
import type { TaskService } from '@/domain'

export function createMockTaskService(): TaskService {
  const todo = () => Promise.reject(new Error('TODO T4'))
  return { submit: todo, get: todo, cancel: todo, resume: todo }
}
