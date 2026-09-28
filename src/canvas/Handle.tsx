// OWNER: T3 — connection handles (position computed from world coords, not DOM).
import { hasHandle, type CanvasNode, type HandleSide } from '@/domain'
import { cn } from '@/lib/utils'
import { startConnect, useConnectPreview } from './useConnect'

const SIZE = 12

/**
 * Place inside NodeFrame's `handles` slot. Positioned relative to the frame so that its center
 * coincides with `handlePoint(node, side)`; renders nothing if the node type has no such handle.
 */
export function Handle({ node, side }: { node: CanvasNode; side: HandleSide }) {
  const preview = useConnectPreview()
  if (!hasHandle(node, side)) return null
  const isDropTarget = side === 'in' && preview?.targetId === node.id

  return (
    <div
      data-no-drag
      data-handle={side}
      aria-label={side === 'out' ? '输出连接点，拖动到生成节点' : '输入连接点'}
      onPointerDown={side === 'out' ? (e) => startConnect(e, node.id) : (e) => e.stopPropagation()}
      className={cn(
        'absolute z-10 rounded-full border-2 border-background bg-muted-foreground shadow-sm transition-transform',
        side === 'out' ? 'cursor-crosshair hover:scale-125 hover:bg-primary' : 'cursor-default',
        isDropTarget && (preview.valid ? 'scale-150 bg-primary' : 'scale-125 bg-destructive'),
      )}
      style={{
        width: SIZE,
        height: SIZE,
        top: node.size.h / 2 - SIZE / 2,
        [side === 'out' ? 'right' : 'left']: -SIZE / 2,
      }}
    />
  )
}
