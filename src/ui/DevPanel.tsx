// OWNER: C2 — mock failure switches, timings and a read-only task list.
import { useState, useSyncExternalStore } from 'react'
import { FlaskConical } from 'lucide-react'
import { Button } from '@/components/motion/button/base'
import { Drawer } from '@/components/motion/drawer'
import { Switch } from '@/components/motion/switch'
import { getMockConfig, setMockConfig, subscribeMockConfig, type MockConfig } from '@/services/mockConfig'
import { revealNode } from '@/canvas/reveal'
import type { Task } from '@/domain'
import { useCanvasStore } from '@/store/canvasStore'
import { NodeStatus } from '@/ui/NodeStatus'

const MIN_MS = 100
const MAX_MS = 10000

function clampMs(value: number): number {
  return Math.min(MAX_MS, Math.max(MIN_MS, Math.round(value)))
}

function DurationField({ label, field, config }: { label: string; field: 'queueMs' | 'runMs'; config: MockConfig }) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          min={MIN_MS}
          max={MAX_MS}
          step={100}
          aria-label={label}
          value={config[field]}
          onChange={(e) => {
            const n = Number(e.target.value)
            if (Number.isFinite(n)) setMockConfig({ [field]: clampMs(n) })
          }}
          className="w-24 rounded-md border bg-background px-2 py-1 text-right text-sm tabular-nums"
        />
        <span className="text-xs text-muted-foreground">ms</span>
      </span>
    </label>
  )
}

function TaskList({ onLocate }: { onLocate: (nodeId: string) => void }) {
  const tasks = useCanvasStore((s) => s.doc.tasks)
  const nodes = useCanvasStore((s) => s.doc.nodes)
  const list = Object.values(tasks).sort((a, b) => b.createdAt - a.createdAt)
  if (list.length === 0) return <p className="text-xs text-muted-foreground">暂无任务</p>
  return (
    <ul className="flex flex-col gap-2" data-testid="task-list">
      {list.map((t) => (
        <li key={t.id} data-testid="task-row">
          <TaskRowBody task={t} locatable={!!(t.resultNodeId && nodes[t.resultNodeId])} onLocate={onLocate} />
        </li>
      ))}
    </ul>
  )
}

function TaskRowBody({ task: t, locatable, onLocate }: { task: Task; locatable: boolean; onLocate: (nodeId: string) => void }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono">{t.id.slice(-6)}</span>
        <NodeStatus status={t.status} />
      </div>
      <div className="mt-1 text-muted-foreground">
        生成节点 <span className="font-mono">{t.generatorNodeId.slice(-6)}</span> · 第 {t.attempt} 次 · {t.params.aspectRatio}
      </div>
      {t.inputSnapshot.prompts.length > 0 && <p className="mt-1 truncate text-foreground">{t.inputSnapshot.prompts.join('，')}</p>}
      {t.error && <p className="mt-1 text-destructive">{t.error.message}</p>}
    </>
  )
  if (!locatable) return <div className="rounded-lg border p-2 text-xs opacity-80">{body}</div>
  return (
    <button
      type="button"
      title="定位到结果节点"
      onClick={() => onLocate(t.resultNodeId!)}
      className="w-full rounded-lg border p-2 text-left text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {body}
    </button>
  )
}

export function DevPanel() {
  const [open, setOpen] = useState(false)
  const config = useSyncExternalStore(subscribeMockConfig, getMockConfig)

  return (
    <>
      <div className="absolute right-3 top-3 z-10" data-no-drag>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)} aria-label="Mock 控制台" title="Mock 控制台">
          <FlaskConical className="h-3.5 w-3.5" aria-hidden />
          {/* Icon-only below lg so it never collides with the centred toolbar. */}
          <span className="hidden lg:inline">Mock 控制台</span>
        </Button>
      </div>
      <Drawer open={open} onOpenChange={setOpen} side="right" ariaLabel="Mock 控制台">
        <div className="flex h-full flex-col gap-5 overflow-y-auto p-5" data-no-drag>
          <h2 className="text-base font-semibold">Mock 控制台</h2>
          <section className="flex flex-col gap-3">
            <Switch
              label="下一次任务失败"
              ariaLabel="下一次任务失败"
              checked={config.failNext}
              onCheckedChange={(v) => setMockConfig({ failNext: v })}
            />
            <Switch label="所有任务失败" ariaLabel="所有任务失败" checked={config.failAll} onCheckedChange={(v) => setMockConfig({ failAll: v })} />
            <p className="text-xs text-muted-foreground">
              提示词包含 <code>#fail</code> 也会触发失败（重试沿用原输入，会再次失败；演示重试成功请用上面的开关）。
            </p>
          </section>
          <section className="flex flex-col gap-2">
            <DurationField label="排队时长" field="queueMs" config={config} />
            <DurationField label="生成时长" field="runMs" config={config} />
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">任务历史</h3>
            <p className="-mt-1 text-xs text-muted-foreground">点击任务定位到对应的结果节点</p>
            <TaskList
              onLocate={(nodeId) => {
                setOpen(false)
                revealNode(nodeId, { select: true })
              }}
            />
          </section>
        </div>
      </Drawer>
    </>
  )
}
