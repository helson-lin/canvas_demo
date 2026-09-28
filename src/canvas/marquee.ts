// Box selection state (screen-space rectangle relative to the canvas container) + the pure hit test.
import { useSyncExternalStore } from 'react'
import type { CanvasNode, Vec2 } from '@/domain'

export interface ScreenRect {
  x: number
  y: number
  w: number
  h: number
}

let rect: ScreenRect | null = null
const listeners = new Set<() => void>()

export function setMarquee(next: ScreenRect | null): void {
  rect = next
  listeners.forEach((l) => l())
}

export function useMarquee(): ScreenRect | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => rect,
  )
}

export function rectFromPoints(a: Vec2, b: Vec2): ScreenRect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) }
}

/** Nodes whose world rectangle intersects the world-space box. */
export function nodesInRect(nodes: CanvasNode[], box: { x: number; y: number; w: number; h: number }): string[] {
  return nodes
    .filter(
      (n) =>
        n.position.x < box.x + box.w &&
        n.position.x + n.size.w > box.x &&
        n.position.y < box.y + box.h &&
        n.position.y + n.size.h > box.y,
    )
    .map((n) => n.id)
}
