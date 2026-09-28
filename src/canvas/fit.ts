// OWNER: C3 — pure viewport fitting.
import type { CanvasNode, Viewport } from '@/domain'
import { MIN_ZOOM } from './coords'

/** Viewport that fits all nodes (position + size) inside `container`, centred; never zooms in past 100%. */
export function fitBounds(nodes: CanvasNode[], container: { w: number; h: number }, padding = 80): Viewport {
  if (nodes.length === 0) return { x: 0, y: 0, zoom: 1 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodes) {
    minX = Math.min(minX, n.position.x)
    minY = Math.min(minY, n.position.y)
    maxX = Math.max(maxX, n.position.x + n.size.w)
    maxY = Math.max(maxY, n.position.y + n.size.h)
  }
  const w = maxX - minX
  const h = maxY - minY
  const availW = Math.max(1, container.w - padding * 2)
  const availH = Math.max(1, container.h - padding * 2)
  const zoom = Math.min(1, Math.max(MIN_ZOOM, Math.min(availW / w, availH / h)))
  return {
    zoom,
    x: container.w / 2 - (minX + w / 2) * zoom,
    y: container.h / 2 - (minY + h / 2) * zoom,
  }
}
