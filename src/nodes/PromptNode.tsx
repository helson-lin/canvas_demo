// OWNER: T2
import { Type } from 'lucide-react'
import type { PromptNode as PromptNodeModel } from '@/domain'
import { persistence } from '@/persistence/persist'
import { useCanvasStore } from '@/store/canvasStore'
import { NodeTitle } from '@/ui/NodeStatus'
import { NodeFrame } from './NodeFrame'

export function PromptNode({ node }: { node: PromptNodeModel }) {
  const selected = useCanvasStore((s) => s.ui.selection.nodeIds.includes(node.id))
  const updateNodeData = useCanvasStore((s) => s.updateNodeData)
  const text = node.data.text

  return (
    <NodeFrame
      node={node}
      selected={selected}
      title={<NodeTitle icon={<Type className="h-3.5 w-3.5" />} label="提示词" sample={node.sample} />}
    >
      <div className="flex h-full flex-col gap-1">
        <textarea
          data-no-drag
          aria-label="提示词"
          className="min-h-24 w-full flex-1 resize-none rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder="描述你想生成的画面…（包含 #fail 可模拟失败）"
          value={text}
          onChange={(e) => {
            updateNodeData<PromptNodeModel>(node.id, { text: e.target.value })
            persistence.scheduleSave()
          }}
        />
        <div className="text-right text-[10px] text-muted-foreground">{text.length} 字</div>
      </div>
    </NodeFrame>
  )
}
