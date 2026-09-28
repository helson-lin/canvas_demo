// OWNER: T1 — selection highlight, drag handling.
import type { ReactNode } from 'react'
import type { CanvasNode } from '@/domain'
import { cn } from '@/lib/utils'
import { useNodeDrag } from '@/canvas/useNodeDrag'
import { Handle } from '@/canvas/Handle'

export interface NodeFrameProps {
  node: CanvasNode
  selected: boolean
  title: ReactNode
  children: ReactNode
  /** Overrides the default connection handles (each Handle hides itself where the node type has none). */
  handles?: ReactNode
}

export function NodeFrame({ node, selected, title, children, handles }: NodeFrameProps) {
  const dragHandlers = useNodeDrag(node.id)
  return (
    <div
      data-node-id={node.id}
      {...dragHandlers}
      className={cn(
        'absolute isolate flex touch-none flex-col rounded-xl border bg-card text-card-foreground shadow-sm',
        selected && 'ring-2 ring-primary',
      )}
      style={{ left: node.position.x, top: node.position.y, width: node.size.w, height: node.size.h, zIndex: selected ? 1 : 0 }}
    >
      <div className="flex cursor-move items-center justify-between border-b px-3 py-2 text-xs font-medium">
        {title}
        <span className="font-mono text-[10px] text-muted-foreground">{node.id.slice(-6)}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
      {handles ?? (
        <>
          <Handle node={node} side="in" />
          <Handle node={node} side="out" />
        </>
      )}
    </div>
  )
}
