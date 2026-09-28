// OWNER: T2
import { memo, useEffect, useRef, useState, type ReactNode } from 'react'
import { ImageIcon, RotateCcw, Upload } from 'lucide-react'
import { Button } from '@/components/motion/button/base'
import { ImageGeneration, type ImageGenerationStatus } from '@/components/agents/image-generation'
import { Loader } from '@/components/motion/loader'
import {
  MOCK_OUTPUTS,
  newId,
  SAMPLE_IMAGES,
  selectImageNodeView,
  type ImageNode as ImageNodeModel,
  type SampleImage,
  type Task,
} from '@/domain'
import { persistence } from '@/persistence/persist'
import { importFile, useAssetUrl } from '@/services/assetStore'
import { retryTask } from '@/services/taskRunner'
import { useCanvasStore } from '@/store/canvasStore'
import { NodeStatus, NodeTitle } from '@/ui/NodeStatus'
import { toast } from '@/ui/toast'
import { sameNodeContent } from './memo'
import { NodeFrame } from './NodeFrame'

// TODO(contract): should move into assetStore as an atomic `useSampleImage` (see handoff T2).
function pickSample(nodeId: string, sample: SampleImage) {
  const assetId = newId('asset')
  useCanvasStore.getState().transact((doc) => {
    const node = doc.nodes[nodeId]
    if (!node || node.type !== 'image') return
    doc.assets[assetId] = {
      id: assetId,
      kind: 'sample',
      src: { type: 'url', url: sample.url },
      width: sample.width,
      height: sample.height,
      createdAt: Date.now(),
    }
    node.data.assetId = assetId
  })
  void persistence.saveNow()
}

async function uploadFile(nodeId: string, file: File) {
  try {
    const assetId = await importFile(file)
    useCanvasStore.getState().updateNodeData<ImageNodeModel>(nodeId, { assetId })
    void persistence.saveNow()
  } catch (err) {
    toast('图片上传失败', { kind: 'error', description: err instanceof Error ? err.message : String(err) })
  }
}

const STATUS_TEXT: Record<ImageGenerationStatus, string> = {
  queued: '排队中',
  generating: '生成中',
  refining: '细化中',
  complete: '已完成',
  error: '生成失败',
}

/** Last 30% of the expected duration shows as "refining" — purely presentational, derived from task timing. */
function useGenerationStatus(task: Task, hasImage: boolean): ImageGenerationStatus {
  const refineAt = task.queuedAt + task.expectedDurationMs * 0.7
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (task.status !== 'running') return
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, refineAt - Date.now()))
    return () => clearTimeout(timer)
  }, [task.status, refineAt])
  const refining = now >= refineAt
  switch (task.status) {
    case 'queued':
      return 'queued'
    case 'running':
      return refining ? 'refining' : 'generating'
    case 'succeeded':
      return hasImage ? 'complete' : 'refining'
    default:
      return 'error'
  }
}

/** Placeholder and result of a generation task, rendered with beUI ImageGeneration. */
function ResultImage({ task, url }: { task: Task; url: string | null }) {
  const status = useGenerationStatus(task, !!url)
  const [w, h] = task.params.aspectRatio.split(':')
  const output = MOCK_OUTPUTS[task.params.aspectRatio]
  const prompt = task.inputSnapshot.prompts.join('，')
  const canRetry = task.status === 'failed' || task.status === 'interrupted'
  const testId = status === 'complete' ? 'image-result' : status === 'error' ? 'image-failed' : 'image-pending'
  return (
    <div data-testid={testId} data-status={status}>
      <ImageGeneration
        status={status}
        size="fluid"
        aspectRatio={`${w} / ${h}`}
        prompt={prompt || undefined}
        label={prompt ? `生成图片：${prompt}` : '生成图片'}
        resolution={`${output.width} × ${output.height}`}
        statusText={status === 'error' ? (task.error?.message ?? '任务未完成') : STATUS_TEXT[status]}
      >
        {url ? <img src={url} alt={prompt || '生成结果'} draggable={false} className="size-full object-cover" /> : null}
      </ImageGeneration>
      {/* ImageGeneration's built-in retry label is English-only; render our own. */}
      {canRetry && (
        <Button data-no-drag size="sm" variant="secondary" className="mt-2" onClick={() => void retryTask(task.id)}>
          <RotateCcw className="h-3.5 w-3.5" />
          重试
        </Button>
      )}
    </div>
  )
}

function ImageNodeView({ node }: { node: ImageNodeModel }) {
  const selected = useCanvasStore((s) => s.ui.selection.nodeIds.includes(node.id))
  const view = useCanvasStore((s) => selectImageNodeView(s.doc, node.id))
  const pendingTaskId = node.data.pendingTaskId
  const pendingTask = useCanvasStore((s) => (pendingTaskId ? s.doc.tasks[pendingTaskId] : undefined))
  const originTaskId = useCanvasStore((s) => {
    const asset = node.data.assetId ? s.doc.assets[node.data.assetId] : undefined
    return asset?.origin?.taskId
  })
  const originTask = useCanvasStore((s) => (originTaskId ? s.doc.tasks[originTaskId] : undefined))
  const url = useAssetUrl(node.data.assetId)
  const fileRef = useRef<HTMLInputElement>(null)
  const generationTask = pendingTask ?? originTask

  let body: ReactNode
  if (generationTask && (view !== 'missing' || pendingTask)) {
    body = <ResultImage task={generationTask} url={url} />
  } else if (view === 'ready' && url) {
    body = <img src={url} alt="图片" draggable={false} className="h-full w-full rounded-lg object-contain" />
  } else if (view === 'ready') {
    // Blob-backed assets resolve asynchronously after a reload; don't flash the "missing" picker meanwhile.
    body = (
      <div className="flex h-full items-center justify-center" data-testid="image-loading">
        <Loader variant="dots" label="加载图片" />
      </div>
    )
  } else if ((view === 'queued' || view === 'running') && pendingTask) {
    body = (
      <div className="flex h-full flex-col items-center justify-center gap-3" data-testid="image-pending">
        <Loader variant="dots" label={view === 'queued' ? '排队中' : '生成中'} />
        <NodeStatus status={pendingTask.status} />
      </div>
    )
  } else if (view === 'failed' && pendingTask) {
    body = (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center" data-testid="image-failed">
        <NodeStatus status={pendingTask.status} />
        <p className="line-clamp-3 text-xs text-destructive">{pendingTask.error?.message ?? '任务未完成'}</p>
        <Button data-no-drag size="sm" variant="secondary" onClick={() => retryTask(pendingTask.id)}>
          <RotateCcw className="h-3.5 w-3.5" />
          重试
        </Button>
      </div>
    )
  } else {
    body = (
      <div className="flex h-full flex-col items-center justify-center gap-2" data-testid="image-missing">
        <ImageIcon className="h-6 w-6 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">图片缺失</p>
        <div className="flex gap-1" data-no-drag>
          {SAMPLE_IMAGES.map((s) => (
            <button
              key={s.id}
              type="button"
              title={s.label}
              aria-label={s.label}
              className="h-10 w-10 overflow-hidden rounded border border-border hover:border-primary"
              onClick={() => pickSample(node.id, s)}
            >
              <img src={s.url} alt="" draggable={false} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
        <Button data-no-drag size="sm" variant="ghost" onClick={() => fileRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" />
          上传图片
        </Button>
        <input
          ref={fileRef}
          data-no-drag
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="上传图片"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void uploadFile(node.id, file)
          }}
        />
      </div>
    )
  }

  return (
    <NodeFrame
      node={node}
      selected={selected}
      title={<NodeTitle icon={<ImageIcon className="h-3.5 w-3.5" />} label="图片" sample={node.sample} />}
    >
      {body}
    </NodeFrame>
  )
}

export const ImageNode = memo(ImageNodeView, sameNodeContent)
