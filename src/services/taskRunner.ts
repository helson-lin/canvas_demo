// OWNER: T4 — drives Task state in the store (submit, poll, success/failure, retry, resume).
import { toast } from '@/ui/toast'

export function startGeneration(_generatorId: string): void {
  toast('生成功能尚未实现（T4）')
}
export function retryTask(_taskId: string): void {
  toast('重试尚未实现（T4）')
}
export function cancelTask(_taskId: string): void {}
/** Called by persistence after hydration. */
export async function resumeTasks(): Promise<void> {}
