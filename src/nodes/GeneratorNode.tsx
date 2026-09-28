// OWNER: T2
import { memo, useMemo } from 'react'
import { ImageIcon, RotateCcw, Sparkles, Wand2 } from 'lucide-react'
import { Button } from '@/components/motion/button/base'
import { StatefulButton, type ButtonState } from '@/components/motion/button/stateful'
import { Tabs, TabsList, TabsTrigger } from '@/components/motion/tabs'
import {
  isTaskActive,
  selectActiveTask,
  selectGeneratorInputs,
  type AspectRatio,
  type GeneratorInputs,
  type GeneratorNode as GeneratorNodeModel,
  type TaskStatus,
} from '@/domain'
import { persistence } from '@/persistence/persist'
import { useAssetUrl } from '@/services/assetStore'
import { cancelTask, retryTask, startGeneration } from '@/services/taskRunner'
import { useCanvasStore } from '@/store/canvasStore'
import { NodeStatus, NodeTitle } from '@/ui/NodeStatus'
import { toast } from '@/ui/toast'
import { sameNodeContent } from './memo'
import { NodeFrame } from './NodeFrame'

const RATIOS: AspectRatio[] = ['1:1', '16:9', '9:16']

function buttonState(status: TaskStatus | undefined): ButtonState {
  switch (status) {
    case 'queued':
    case 'running':
      return 'loading'
    case 'succeeded':
      return 'success'
    case 'failed':
    case 'interrupted':
      return 'error'
    default:
      return 'idle'
  }
}

function Thumb({ assetId }: { assetId: string | null }) {
  const url = useAssetUrl(assetId)
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted">
      {url ? (
        <img src={url} alt="输入图片" draggable={false} className="h-full w-full object-cover" />
      ) : (
        <ImageIcon className="h-4 w-4 text-muted-foreground" aria-label="图片缺失" />
      )}
    </div>
  )
}

function GeneratorNodeView({ node }: { node: GeneratorNodeModel }) {
  const selected = useCanvasStore((s) => s.ui.selection.nodeIds.includes(node.id))
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  // Serialize so the selector returns a value-comparable primitive; avoids re-rendering on unrelated doc changes.
  const inputsKey = useCanvasStore((s) => {
    const inputs = selectGeneratorInputs(s.doc, node.id)
    return JSON.stringify({
      images: inputs.images.map((i) => ({ nodeId: i.nodeId, assetId: i.asset?.id ?? null })),
      prompts: inputs.prompts,
    })
  })
  const inputs = useMemo(
    () => JSON.parse(inputsKey) as { images: { nodeId: string; assetId: string | null }[]; prompts: GeneratorInputs['prompts'] },
    [inputsKey],
  )
  const task = useCanvasStore((s) => selectActiveTask(s.doc, node.id))
  const active = isTaskActive(task)
  const ratio = node.data.params.aspectRatio

  const onGenerate = () => {
    if (active) {
      toast('任务进行中，请等待完成')
      return
    }
    startGeneration(node.id)
  }

  return (
    <NodeFrame
      node={node}
      selected={selected}
      title={<NodeTitle icon={<Sparkles className="h-3.5 w-3.5" />} label="生成器" sample={node.sample} />}
    >
      <div className="flex flex-col gap-3">
        <section>
          <div className="mb-1 text-[11px] text-muted-foreground">参考图片（{inputs.images.length}）</div>
          {inputs.images.length === 0 ? (
            <div className="text-xs text-muted-foreground/70">未连接图片</div>
          ) : (
            <div className="flex flex-wrap gap-1" data-testid="gen-images">
              {inputs.images.map((img) => (
                <Thumb key={img.nodeId} assetId={img.assetId} />
              ))}
            </div>
          )}
        </section>
        <section>
          <div className="mb-1 text-[11px] text-muted-foreground">提示词（{inputs.prompts.length}）</div>
          {inputs.prompts.length === 0 ? (
            <div className="text-xs text-muted-foreground/70">未连接提示词</div>
          ) : (
            <ul className="flex flex-col gap-1" data-testid="gen-prompts">
              {inputs.prompts.map((p) => (
                <li key={p.nodeId} className="line-clamp-2 rounded bg-muted px-2 py-1 text-xs">
                  {p.text || <span className="text-muted-foreground">（空）</span>}
                </li>
              ))}
            </ul>
          )}
        </section>
        <div data-no-drag>
          <Tabs
            value={ratio}
            variant="segment"
            onValueChange={(v) => {
              updateNodeData<GeneratorNodeModel>(node.id, { params: { ...node.data.params, aspectRatio: v as AspectRatio } })
              persistence.scheduleSave()
            }}
          >
            <TabsList>
              {RATIOS.map((r) => (
                <TabsTrigger key={r} value={r} className="px-3 text-xs">
                  {r}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="relative" data-no-drag>
          <StatefulButton
            size="sm"
            className="w-full"
            state={buttonState(task?.status)}
            loadingText={task?.status === 'queued' ? '排队中' : '生成中'}
            successText="再次生成"
            errorText="重新生成"
            icon={<Wand2 className="h-3.5 w-3.5" />}
            onClick={onGenerate}
          >
            生成
          </StatefulButton>
          {/* Disabled buttons swallow clicks; this overlay still surfaces the "busy" hint. */}
          {active && <div className="absolute inset-0 cursor-not-allowed" aria-hidden onClick={onGenerate} />}
        </div>
        {task && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <NodeStatus status={task.status} />
              {task.attempt > 1 && <span className="text-[10px] text-muted-foreground">第 {task.attempt} 次</span>}
              {active && (
                <button
                  type="button"
                  data-no-drag
                  onClick={() => void cancelTask(task.id)}
                  className="ml-auto rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  取消任务
                </button>
              )}
            </div>
            {task.error && task.status !== 'cancelled' && <p className="text-xs text-destructive">{task.error.message}</p>}
            {(task.status === 'failed' || task.status === 'interrupted' || task.status === 'cancelled') && (
              <Button data-no-drag size="sm" variant="secondary" onClick={() => retryTask(task.id)}>
                <RotateCcw className="h-3.5 w-3.5" />
                重试
              </Button>
            )}
          </div>
        )}
      </div>
    </NodeFrame>
  )
}

export const GeneratorNode = memo(GeneratorNodeView, sameNodeContent)
