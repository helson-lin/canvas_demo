// Large view of a generated result (double-click a result node). beUI CenterMorphModal, controlled.
import { CenterMorphModal, CenterMorphModalContent } from '@/components/motion/center-morph-modal'
import { MOCK_OUTPUTS, type Task } from '@/domain'

export function ResultLightbox({
  open,
  onOpenChange,
  task,
  url,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: Task
  url: string
}) {
  const prompt = task.inputSnapshot.prompts.join('，')
  const output = MOCK_OUTPUTS[task.params.aspectRatio]
  const [w, h] = task.params.aspectRatio.split(':').map(Number)
  const landscape = w >= h
  return (
    <CenterMorphModal open={open} onOpenChange={onOpenChange}>
      <CenterMorphModalContent
        ariaLabel={prompt ? `生成结果：${prompt}` : '生成结果'}
        closeButtonLabel="关闭"
        className={landscape ? 'max-w-[min(88vw,960px)]' : 'max-w-[min(88vw,520px)]'}
      >
        <figure className="flex flex-col" data-no-drag>
          <img
            src={url}
            alt={prompt || '生成结果'}
            draggable={false}
            className="max-h-[72vh] w-full bg-muted object-contain"
            style={{ aspectRatio: `${w} / ${h}` }}
          />
          <figcaption className="flex flex-col gap-2 px-6 py-5">
            <p className="text-sm leading-relaxed text-foreground">{prompt || '（无提示词）'}</p>
            <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <div className="flex gap-1.5">
                <dt>比例</dt>
                <dd className="tabular-nums text-foreground">{task.params.aspectRatio}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt>尺寸</dt>
                <dd className="tabular-nums text-foreground">
                  {output.width} × {output.height}
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt>参考图</dt>
                <dd className="tabular-nums text-foreground">{task.inputSnapshot.imageAssetIds.length} 张</dd>
              </div>
              <div className="flex gap-1.5">
                <dt>任务</dt>
                <dd className="font-mono text-foreground">
                  {task.id.slice(-6)} · 第 {task.attempt} 次
                </dd>
              </div>
            </dl>
          </figcaption>
        </figure>
      </CenterMorphModalContent>
    </CenterMorphModal>
  )
}
