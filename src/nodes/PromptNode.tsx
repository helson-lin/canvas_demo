// OWNER: T2
import type { PromptNode as PromptNodeModel } from '@/domain'
import { useCanvasStore } from '@/store/canvasStore'
import { NodeFrame } from './NodeFrame'

export function PromptNode({ node }: { node: PromptNodeModel }) {
  const selected = useCanvasStore((s) => s.ui.selection.nodeIds.includes(node.id))
  return (
    <NodeFrame node={node} selected={selected} title="prompt">
      <div className="text-xs text-muted-foreground">TODO T2</div>
    </NodeFrame>
  )
}
