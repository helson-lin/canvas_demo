// OWNER: T2
import { useRef, type ReactNode } from 'react'
import { ImageIcon, RotateCcw, Upload } from 'lucide-react'
import { Button } from '@/components/motion/button/base'
import { Loader } from '@/components/motion/loader'
import {
  newId,
  SAMPLE_IMAGES,
  selectImageNodeView,
  type ImageNode as ImageNodeModel,
  type SampleImage,
} from '@/domain'
import { persistence } from '@/persistence/persist'
import { importFile, useAssetUrl } from '@/services/assetStore'
import { retryTask } from '@/services/taskRunner'
import { useCanvasStore } from '@/store/canvasStore'
import { NodeStatus, NodeTitle } from '@/ui/NodeStatus'
import { toast } from '@/ui/toast'
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

export function ImageNode({ node }: { node: ImageNodeModel }) {
  const selected = useCanvasStore((s) => s.ui.selection.nodeIds.includes(node.id))
  const view = useCanvasStore((s) => selectImageNodeView(s.doc, node.id))
  const pendingTaskId = node.data.pendingTaskId
  const pendingTask = useCanvasStore((s) => (pendingTaskId ? s.doc.tasks[pendingTaskId] : undefined))
  const url = useAssetUrl(node.data.assetId)
  const fileRef = useRef<HTMLInputElement>(null)

  let body: ReactNode
  if (view === 'ready' && url) {
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
