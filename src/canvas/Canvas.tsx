// OWNER: T1 — viewport container, pan/zoom, blank-click deselect, keyboard delete.
import { useRef } from 'react'
import { useCanvasStore } from '@/store/canvasStore'
import { renderNode } from '@/nodes/registry'
import { EdgeLayer } from './EdgeLayer'
import { usePanZoom } from './usePanZoom'

export function Canvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewport = useCanvasStore((s) => s.doc.viewport)
  const nodes = useCanvasStore((s) => s.doc.nodes)
  usePanZoom(containerRef)

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-muted/40 select-none">
      <div
        className="absolute left-0 top-0"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        <EdgeLayer />
        {Object.values(nodes).map(renderNode)}
      </div>
    </div>
  )
}
