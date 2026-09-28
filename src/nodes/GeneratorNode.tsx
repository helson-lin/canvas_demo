// OWNER: T2
import type { GeneratorNode as GeneratorNodeModel } from '@/domain'
import { useCanvasStore } from '@/store/canvasStore'
import { NodeFrame } from './NodeFrame'

export function GeneratorNode({ node }: { node: GeneratorNodeModel }) {
  const selected = useCanvasStore((s) => s.ui.selection.nodeIds.includes(node.id))
  return (
    <NodeFrame node={node} selected={selected} title="generator">
      <div className="text-xs text-muted-foreground">TODO T2</div>
    </NodeFrame>
  )
}
