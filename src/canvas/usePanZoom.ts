// OWNER: T1 — pan (blank drag / middle / Space+drag / trackpad), mouse-anchored zoom.
import { useEffect, type RefObject } from 'react'
import { useCanvasStore } from '@/store/canvasStore'
import { persistence } from '@/persistence/persist'
import { screenToWorld, zoomAt } from './coords'
import { copySelection, duplicateSelection, nudgeSelection, pasteClipboard, selectAll } from './editing'
import { nodesInRect, rectFromPoints, setMarquee } from './marquee'
import { checkpoint, redo, undo } from '@/store/history'
import { summarizeNodeRemoval, type Vec2 } from '@/domain'
import { confirm, isConfirmOpen } from '@/ui/confirm'

const ARROWS: Record<string, Vec2> = {
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
}

const ZOOM_SPEED = 0.01
// Mouse wheels report ~100px per notch, trackpad pinch only a few px; clamp so one notch ≈ 15%.
const MAX_ZOOM_DELTA = 15
const CLICK_SLOP = 3

let spaceDown = false
/** NodeFrame reads this so Space+drag over a node pans instead of dragging it. */
export function isSpacePanActive(): boolean {
  return spaceDown
}

export function wheelZoomFactor(deltaY: number): number {
  const d = Math.max(-MAX_ZOOM_DELTA, Math.min(MAX_ZOOM_DELTA, deltaY))
  return Math.exp(-d * ZOOM_SPEED)
}

export function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || !!el.closest('input, textarea, select, [contenteditable="true"]')
}

/**
 * True when a press lands on empty canvas. Edges, handles and controls opt out with [data-no-drag]:
 * their React handlers run after this native listener, so stopPropagation there can't prevent a blank-click deselect.
 */
export function isBlankCanvasTarget(target: Element | null): boolean {
  return !target?.closest('[data-node-id], [data-no-drag]')
}

/** Edges delete immediately; nodes (which may cascade edges and cancel tasks) ask first. */
export async function deleteSelection(nodeIds: string[], edgeIds: string[]): Promise<boolean> {
  const store = useCanvasStore.getState()
  if (nodeIds.length) {
    const { nodes, edges, activeTasks } = summarizeNodeRemoval(store.doc, nodeIds)
    const parts = [edges ? `及其 ${edges} 条连线` : '', activeTasks ? `，并取消 ${activeTasks} 个进行中的任务` : '']
    const ok = await confirm({
      title: nodes > 1 ? `删除 ${nodes} 个节点？` : '删除该节点？',
      description: `将删除所选节点${parts.join('')}。可用 ⌘/Ctrl+Z 撤销${activeTasks ? '，但已取消的任务不会恢复' : ''}。`,
      confirmLabel: '删除',
      destructive: true,
    })
    if (!ok) return false
  }
  checkpoint()
  const s = useCanvasStore.getState()
  if (edgeIds.length) s.removeEdges(edgeIds)
  if (nodeIds.length) s.removeNodes(nodeIds)
  void persistence.saveNow()
  return true
}

export function usePanZoom(containerRef: RefObject<HTMLDivElement | null>): void {
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const store = useCanvasStore

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const vp = store.getState().doc.viewport
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect()
        const pt = { x: e.clientX - rect.left, y: e.clientY - rect.top }
        store.getState().setViewport(zoomAt(vp, pt, wheelZoomFactor(e.deltaY)))
      } else {
        store.getState().setViewport({ ...vp, x: vp.x - e.deltaX, y: vp.y - e.deltaY })
      }
      persistence.scheduleSave()
    }

    let pan: { id: number; sx: number; sy: number; vx: number; vy: number; moved: boolean } | null = null
    let box: { id: number; start: Vec2; base: string[] } | null = null
    const local = (e: PointerEvent): Vec2 => {
      const r = el.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target : null
      const onNode = !isBlankCanvasTarget(target)
      const isMiddle = e.button === 1
      const isSpacePan = e.button === 0 && spaceDown
      const isBlankPan = e.button === 0 && !onNode
      // Shift + drag on blank canvas = box select (adds to the current selection).
      if (isBlankPan && e.shiftKey && !spaceDown) {
        e.preventDefault()
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
        box = { id: e.pointerId, start: local(e), base: store.getState().ui.selection.nodeIds }
        el.setPointerCapture(e.pointerId)
        return
      }
      if (!isMiddle && !isSpacePan && !isBlankPan) return
      e.preventDefault()
      // Blur inputs so Delete/Space shortcuts work after clicking the canvas.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      const vp = store.getState().doc.viewport
      pan = { id: e.pointerId, sx: e.clientX, sy: e.clientY, vx: vp.x, vy: vp.y, moved: false }
      el.setPointerCapture(e.pointerId)
      el.style.cursor = 'grabbing'
    }

    const onPointerMove = (e: PointerEvent) => {
      if (box && e.pointerId === box.id) {
        const r = rectFromPoints(box.start, local(e))
        setMarquee(r)
        const vp = store.getState().doc.viewport
        const tl = screenToWorld({ x: r.x, y: r.y }, vp)
        const hits = nodesInRect(Object.values(store.getState().doc.nodes), {
          x: tl.x,
          y: tl.y,
          w: r.w / vp.zoom,
          h: r.h / vp.zoom,
        })
        store.getState().select({ nodeIds: [...new Set([...box.base, ...hits])] })
        return
      }
      if (!pan || e.pointerId !== pan.id) return
      const dx = e.clientX - pan.sx
      const dy = e.clientY - pan.sy
      if (!pan.moved && Math.hypot(dx, dy) < CLICK_SLOP) return
      pan.moved = true
      const vp = store.getState().doc.viewport
      store.getState().setViewport({ ...vp, x: pan.vx + dx, y: pan.vy + dy })
    }

    const endPan = (e: PointerEvent) => {
      if (box && e.pointerId === box.id) {
        box = null
        setMarquee(null)
        if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
        return
      }
      if (!pan || e.pointerId !== pan.id) return
      if (pan.moved) persistence.scheduleSave()
      else if (e.type === 'pointerup' && e.button === 0 && !spaceDown) store.getState().clearSelection()
      pan = null
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      el.style.cursor = spaceDown ? 'grab' : ''
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target) || isEditableTarget(document.activeElement)) return
      if (e.code === 'Space') {
        e.preventDefault()
        if (!spaceDown) {
          spaceDown = true
          if (!pan) el.style.cursor = 'grab'
        }
        return
      }
      if (isConfirmOpen()) return
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()
      if (mod && key === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
        return
      }
      if (mod && key === 'y') {
        e.preventDefault()
        redo()
        return
      }
      if (mod && key === 'a') {
        e.preventDefault()
        selectAll()
        return
      }
      if (mod && key === 'c') {
        if (copySelection()) e.preventDefault()
        return
      }
      if (mod && key === 'v') {
        if (pasteClipboard().length) e.preventDefault()
        return
      }
      if (mod && key === 'd') {
        e.preventDefault()
        duplicateSelection()
        return
      }
      if (e.key === 'Escape') {
        store.getState().clearSelection()
        return
      }
      const arrow = ARROWS[e.key]
      if (arrow) {
        const step = e.shiftKey ? 10 : 1
        if (nudgeSelection(arrow.x * step, arrow.y * step)) e.preventDefault()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selection } = store.getState().ui
        if (!selection.nodeIds.length && !selection.edgeIds.length) return
        e.preventDefault()
        if (isConfirmOpen()) return
        void deleteSelection(selection.nodeIds, selection.edgeIds)
      }
    }

    const resetSpace = () => {
      spaceDown = false
      if (!pan) el.style.cursor = ''
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') resetSpace()
    }
    // Stop the browser's middle-click autoscroll.
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 1) e.preventDefault()
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', endPan)
    el.addEventListener('pointercancel', endPan)
    el.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', resetSpace)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', endPan)
      el.removeEventListener('pointercancel', endPan)
      el.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', resetSpace)
    }
  }, [containerRef])
}
