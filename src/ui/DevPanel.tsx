// OWNER: C2 — mock failure switches, timings and a read-only task list.
import { useState, useSyncExternalStore } from 'react'
import { FlaskConical } from 'lucide-react'
import { Button } from '@/components/motion/button/base'
import { Drawer } from '@/components/motion/drawer'
import { Switch } from '@/components/motion/switch'
import { getMockConfig, setMockConfig, subscribeMockConfig, type MockConfig } from '@/services/mockConfig'
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

function TaskList() {
  const tasks = useCanvasStore((s) => s.doc.tasks)
  const list = Object.values(tasks).sort((a, b) => b.createdAt - a.createdAt)
  if (list.length === 0) return <p className="text-xs text-muted-foreground">暂无任务</p>
  return (
    <ul className="flex flex-col gap-2" data-testid="task-list">
      {list.map((t) => (
        <li key={t.id} className="rounded-lg border p-2 text-xs" data-testid="task-row">
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono">{t.id.slice(-6)}</span>
            <NodeStatus status={t.status} />
          </div>
          <div className="mt-1 text-muted-foreground">
            生成节点 <span className="font-mono">{t.generatorNodeId.slice(-6)}</span> · 第 {t.attempt} 次 · {t.params.aspectRatio}
          </div>
          {t.error && <p className="mt-1 text-destructive">{t.error.message}</p>}
        </li>
      ))}
    </ul>
  )
}

export function DevPanel() {
  const [open, setOpen] = useState(false)
  const config = useSyncExternalStore(subscribeMockConfig, getMockConfig)

  return (
    <>
      <div className="absolute right-3 top-3 z-10" data-no-drag>
        <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
          <FlaskConical className="h-3.5 w-3.5" />
          Mock 控制台
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
            <h3 className="text-sm font-medium">任务列表</h3>
            <TaskList />
          </section>
        </div>
      </Drawer>
    </>
  )
}
