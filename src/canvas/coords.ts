import type { Vec2, Viewport } from '@/domain'

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 4

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

export function screenToWorld(p: Vec2, vp: Viewport): Vec2 {
  return { x: (p.x - vp.x) / vp.zoom, y: (p.y - vp.y) / vp.zoom }
}

export function worldToScreen(p: Vec2, vp: Viewport): Vec2 {
  return { x: p.x * vp.zoom + vp.x, y: p.y * vp.zoom + vp.y }
}

/** Zoom by `factor` keeping the world point under `screenPt` fixed. `screenPt` is relative to the canvas container. */
export function zoomAt(vp: Viewport, screenPt: Vec2, factor: number): Viewport {
  const zoom = clampZoom(vp.zoom * factor)
  const w = screenToWorld(screenPt, vp)
  return { zoom, x: screenPt.x - w.x * zoom, y: screenPt.y - w.y * zoom }
}
