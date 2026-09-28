// OWNER: C3 — save status badge (bottom-left).
import { AnimatedBadge } from '@/components/motion/animated-badge'
import { useSaveStatus } from '@/persistence/persist'

function time(ts?: number): string {
  return ts ? new Date(ts).toLocaleTimeString('zh-CN', { hour12: false }) : ''
}

export function SaveIndicator() {
  const { status, error, savedAt } = useSaveStatus()
  if (status === 'idle') return null
  const view =
    status === 'saving'
      ? { badge: 'loading' as const, text: '保存中…' }
      : status === 'saved'
        ? { badge: 'success' as const, text: `已保存 ${time(savedAt)}` }
        : { badge: 'danger' as const, text: `保存失败：${error ?? '未知错误'}` }
  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-10" data-testid="save-indicator">
      <AnimatedBadge status={view.badge} size="sm" contentKey={status}>
        {view.text}
      </AnimatedBadge>
    </div>
  )
}
