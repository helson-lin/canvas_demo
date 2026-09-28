// OWNER: C3 — zoom percentage, step zoom around the viewport centre, reset and fit-all.
import { Maximize, Minus, Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import { zoomAt } from '@/canvas/coords'
import { fitBounds } from '@/canvas/fit'
import type { Viewport } from '@/domain'
import { persistence } from '@/persistence/persist'
import { useCanvasStore } from '@/store/canvasStore'

const STEP = 1.2

function viewportSize() {
  return { w: window.innerWidth, h: window.innerHeight }
}

function apply(next: (vp: Viewport) => Viewport) {
  const { doc, setViewport } = useCanvasStore.getState()
  setViewport(next(doc.viewport))
  persistence.scheduleSave()
}

function zoomAroundCenter(factor: number) {
  const { w, h } = viewportSize()
  apply((vp) => zoomAt(vp, { x: w / 2, y: h / 2 }, factor))
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-8 min-w-8 place-items-center rounded-md px-2 text-xs hover:bg-muted"
    >
      {children}
    </button>
  )
}

export function ZoomControls() {
  const zoom = useCanvasStore((s) => s.doc.viewport.zoom)
  return (
    <div
      data-no-drag
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute bottom-3 right-3 z-10 flex items-center gap-0.5 rounded-lg border bg-card p-1 shadow-sm"
    >
      <IconButton label="缩小" onClick={() => zoomAroundCenter(1 / STEP)}>
        <Minus className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton label="重置为 100%" onClick={() => zoomAroundCenter(1 / useCanvasStore.getState().doc.viewport.zoom)}>
        <span className="w-10 tabular-nums" data-testid="zoom-percent">
          {Math.round(zoom * 100)}%
        </span>
      </IconButton>
      <IconButton label="放大" onClick={() => zoomAroundCenter(STEP)}>
        <Plus className="h-3.5 w-3.5" />
      </IconButton>
      <IconButton
        label="适配全部"
        onClick={() => apply(() => fitBounds(Object.values(useCanvasStore.getState().doc.nodes), viewportSize()))}
      >
        <Maximize className="h-3.5 w-3.5" />
      </IconButton>
    </div>
  )
}
