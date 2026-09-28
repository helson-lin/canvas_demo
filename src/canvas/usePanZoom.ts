// OWNER: T1 — pan (blank drag / middle / Space+drag / trackpad), mouse-anchored zoom.
import { useEffect, type RefObject } from 'react'
import { useCanvasStore } from '@/store/canvasStore'
import { persistence } from '@/persistence/persist'
import { zoomAt } from './coords'

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

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target instanceof Element ? e.target : null
      const onNode = !!target?.closest('[data-node-id]')
      const isMiddle = e.button === 1
      const isSpacePan = e.button === 0 && spaceDown
      const isBlankPan = e.button === 0 && !onNode
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
      if (!pan || e.pointerId !== pan.id) return
      const dx = e.clientX - pan.sx
      const dy = e.clientY - pan.sy
      if (!pan.moved && Math.hypot(dx, dy) < CLICK_SLOP) return
      pan.moved = true
      const vp = store.getState().doc.viewport
      store.getState().setViewport({ ...vp, x: pan.vx + dx, y: pan.vy + dy })
    }

    const endPan = (e: PointerEvent) => {
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
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const { selection } = store.getState().ui
        if (!selection.nodeIds.length && !selection.edgeIds.length) return
        e.preventDefault()
        if (selection.edgeIds.length) store.getState().removeEdges(selection.edgeIds)
        if (selection.nodeIds.length) store.getState().removeNodes(selection.nodeIds)
        void persistence.saveNow()
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
