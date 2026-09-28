// OWNER: T1 — node drag with pointer capture, rAF-batched moves, click-to-select.
import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import type { Vec2 } from '@/domain'
import { useCanvasStore } from '@/store/canvasStore'
import { persistence } from '@/persistence/persist'
import { isSpacePanActive } from './usePanZoom'

export const DRAG_THRESHOLD = 3
export const NO_DRAG_SELECTOR = '[data-no-drag], input, textarea, button, select'

/** Screen-space delta is divided by zoom so the node tracks the pointer at any zoom. */
export function dragPosition(startWorld: Vec2, startScreen: Vec2, nowScreen: Vec2, zoom: number): Vec2 {
  return {
    x: startWorld.x + (nowScreen.x - startScreen.x) / zoom,
    y: startWorld.y + (nowScreen.y - startScreen.y) / zoom,
  }
}

export function exceedsDragThreshold(startScreen: Vec2, nowScreen: Vec2): boolean {
  return Math.hypot(nowScreen.x - startScreen.x, nowScreen.y - startScreen.y) >= DRAG_THRESHOLD
}

/** Selection after a click (no drag) on a node; Shift toggles membership. */
export function nextSelection(current: string[], id: string, additive: boolean): string[] {
  if (!additive) return [id]
  return current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
}

interface DragState {
  pointerId: number
  startScreen: Vec2
  starts: Record<string, Vec2>
  zoom: number
  moved: boolean
  shift: boolean
  last: Vec2
  raf: number
}

export function useNodeDrag(nodeId: string) {
  const drag = useRef<DragState | null>(null)

  const flush = useCallback(() => {
    const d = drag.current
    if (!d) return
    d.raf = 0
    const { moveNode } = useCanvasStore.getState()
    for (const [id, start] of Object.entries(d.starts)) moveNode(id, dragPosition(start, d.startScreen, d.last, d.zoom))
  }, [])

  useEffect(
    () => () => {
      if (drag.current?.raf) cancelAnimationFrame(drag.current.raf)
    },
    [],
  )

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (e.button !== 0 || isSpacePanActive()) return
      if (e.target instanceof Element && e.target.closest(NO_DRAG_SELECTOR)) return
      const state = useCanvasStore.getState()
      const selected = state.ui.selection.nodeIds
      // Dragging a node that is part of a multi-selection moves the whole group.
      const ids = selected.includes(nodeId) && !e.shiftKey ? selected : [nodeId]
      const starts: Record<string, Vec2> = {}
      for (const id of ids) {
        const n = state.doc.nodes[id]
        if (n) starts[id] = { ...n.position }
      }
      const p = { x: e.clientX, y: e.clientY }
      drag.current = {
        pointerId: e.pointerId,
        startScreen: p,
        starts,
        zoom: state.doc.viewport.zoom,
        moved: false,
        shift: e.shiftKey,
        last: p,
        raf: 0,
      }
      e.currentTarget.setPointerCapture(e.pointerId)
    },
    [nodeId],
  )

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const d = drag.current
      if (!d || e.pointerId !== d.pointerId) return
      const p = { x: e.clientX, y: e.clientY }
      if (!d.moved) {
        if (!exceedsDragThreshold(d.startScreen, p)) return
        d.moved = true
        const state = useCanvasStore.getState()
        if (!state.ui.selection.nodeIds.includes(nodeId)) state.select({ nodeIds: [nodeId] })
      }
      d.last = p
      if (!d.raf) d.raf = requestAnimationFrame(flush)
    },
    [flush, nodeId],
  )

  const end = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const d = drag.current
      if (!d || e.pointerId !== d.pointerId) return
      if (d.raf) cancelAnimationFrame(d.raf)
      if (d.moved) {
        d.last = { x: e.clientX, y: e.clientY }
        flush()
        persistence.scheduleSave()
      } else if (e.type === 'pointerup') {
        const state = useCanvasStore.getState()
        state.select({ nodeIds: nextSelection(state.ui.selection.nodeIds, nodeId, d.shift), edgeIds: [] })
      }
      drag.current = null
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    },
    [flush, nodeId],
  )

  return { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end }
}
