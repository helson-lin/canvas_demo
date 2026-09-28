// OWNER: T2 — task status badge + shared node header title.
import type { ReactNode } from 'react'
import { AnimatedBadge, type AnimatedBadgeStatus } from '@/components/motion/animated-badge'
import type { TaskStatus } from '@/domain'

const STATUS_META: Record<TaskStatus, { badge: AnimatedBadgeStatus; label: string }> = {
  queued: { badge: 'info', label: '排队中' },
  running: { badge: 'loading', label: '生成中' },
  succeeded: { badge: 'success', label: '已完成' },
  failed: { badge: 'danger', label: '失败' },
  interrupted: { badge: 'warning', label: '已中断' },
  cancelled: { badge: 'neutral', label: '已取消' },
}

export function NodeStatus({ status }: { status: TaskStatus }) {
  const meta = STATUS_META[status]
  return (
    <AnimatedBadge status={meta.badge} size="sm" contentKey={status} data-testid="task-status">
      {meta.label}
    </AnimatedBadge>
  )
}

export function NodeTitle({ icon, label, sample }: { icon: ReactNode; label: string; sample?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      {icon}
      <span>{label}</span>
      {sample && (
        <span className="rounded bg-muted px-1 py-px text-[10px] font-normal text-muted-foreground">示例</span>
      )}
    </span>
  )
}
