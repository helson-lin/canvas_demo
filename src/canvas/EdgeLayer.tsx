// OWNER: T3 — bezier edges inside the world container.
import { useState } from 'react'
import { bezierMidpoint, bezierPath, edgeEndpoints, handlePoint, type Edge } from '@/domain'
import { persistence } from '@/persistence/persist'
import { useCanvasStore } from '@/store/canvasStore'
import { useConnectPreview } from './useConnect'

/** Render as the first child of the world (transformed) container. Coordinates are world units. */
export function EdgeLayer() {
  const doc = useCanvasStore((s) => s.doc)
  const zoom = doc.viewport.zoom
  const selected = useCanvasStore((s) => s.ui.selection.edgeIds)
  const preview = useConnectPreview()
  const [hovered, setHovered] = useState<string | null>(null)

  const previewSource = preview ? doc.nodes[preview.sourceId] : undefined

  return (
    <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1}>
      {Object.values(doc.edges).map((edge) => (
        <EdgePath
          key={edge.id}
          edge={edge}
          d={pathOf(edge)}
          mid={midOf(edge)}
          zoom={zoom}
          selected={selected.includes(edge.id)}
          hovered={hovered === edge.id}
          onHover={(h) => setHovered((cur) => (h ? edge.id : cur === edge.id ? null : cur))}
        />
      ))}
      {preview && previewSource && (
        <path
          d={bezierPath(handlePoint(previewSource, 'out'), preview.to)}
          fill="none"
          strokeWidth={2}
          strokeDasharray="6 4"
          vectorEffect="non-scaling-stroke"
          className={preview.targetId && !preview.valid ? 'stroke-destructive' : 'stroke-primary'}
        />
      )}
    </svg>
  )

  function pathOf(edge: Edge) {
    const ends = edgeEndpoints(doc, edge)
    return ends ? bezierPath(ends.a, ends.b) : null
  }
  function midOf(edge: Edge) {
    const ends = edgeEndpoints(doc, edge)
    return ends ? bezierMidpoint(ends.a, ends.b) : null
  }
}

function EdgePath(props: {
  edge: Edge
  d: string | null
  mid: { x: number; y: number } | null
  zoom: number
  selected: boolean
  hovered: boolean
  onHover: (h: boolean) => void
}) {
  const { edge, d, mid, zoom, selected, hovered } = props
  if (!d || !mid) return null
  const remove = () => {
    useCanvasStore.getState().removeEdges([edge.id])
    void persistence.saveNow()
  }
  // Button is sized in screen px regardless of zoom.
  const r = 9 / zoom
  const x = 3.5 / zoom

  return (
    <g
      data-edge-id={edge.id}
      data-no-drag
      className="pointer-events-auto"
      onPointerEnter={() => props.onHover(true)}
      onPointerLeave={() => props.onHover(false)}
    >
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={14}
        vectorEffect="non-scaling-stroke"
        className="cursor-pointer"
        style={{ pointerEvents: 'stroke' }}
        onPointerDown={(e) => {
          // Prevent T1's blank-click deselect / pan.
          e.stopPropagation()
          useCanvasStore.getState().select({ edgeIds: [edge.id] })
        }}
      />
      <path
        d={d}
        fill="none"
        strokeWidth={selected ? 3 : 2}
        strokeDasharray={edge.kind === 'result' ? '6 4' : undefined}
        vectorEffect="non-scaling-stroke"
        className={selected ? 'stroke-primary' : hovered ? 'stroke-foreground/70' : 'stroke-muted-foreground'}
        style={{ pointerEvents: 'none' }}
      />
      {(hovered || selected) && (
        <g
          role="button"
          aria-label="删除连接"
          className="cursor-pointer"
          onPointerDown={(e) => {
            e.stopPropagation()
            remove()
          }}
        >
          <circle cx={mid.x} cy={mid.y} r={r} className="fill-background stroke-border" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <path
            d={`M ${mid.x - x} ${mid.y - x} L ${mid.x + x} ${mid.y + x} M ${mid.x + x} ${mid.y - x} L ${mid.x - x} ${mid.y + x}`}
            className="stroke-foreground"
            strokeWidth={1.5}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}
    </g>
  )
}
