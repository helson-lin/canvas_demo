import type { CanvasNode } from '@/domain'

/**
 * Node bodies re-render only when content changes, not when the node moves. beUI components use motion
 * layout animations, which animate any change in page position between renders — re-rendering them while
 * dragging makes them trail behind the node. NodeFrame reads position from the store itself.
 */
export function sameNodeContent(a: { node: CanvasNode }, b: { node: CanvasNode }): boolean {
  return (
    a.node.id === b.node.id &&
    a.node.type === b.node.type &&
    a.node.data === b.node.data &&
    a.node.size === b.node.size &&
    a.node.sample === b.node.sample
  )
}
