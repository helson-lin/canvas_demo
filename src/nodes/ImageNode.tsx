// OWNER: T2
import type { ImageNode as ImageNodeModel } from '@/domain'
import { useCanvasStore } from '@/store/canvasStore'
import { NodeFrame } from './NodeFrame'

export function ImageNode({ node }: { node: ImageNodeModel }) {
  const selected = useCanvasStore((s) => s.ui.selection.nodeIds.includes(node.id))
  return (
    <NodeFrame node={node} selected={selected} title="image">
      <div className="text-xs text-muted-foreground">TODO T2</div>
    </NodeFrame>
  )
}
