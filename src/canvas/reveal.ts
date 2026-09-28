import type { Viewport } from '@/domain'
import { useCanvasStore } from '@/store/canvasStore'
import { persistence } from '@/persistence/persist'

const MARGIN = 72
const DURATION_MS = 320

function containerSize(): { w: number; h: number } {
  const root = typeof document !== 'undefined' ? document.querySelector('[data-canvas-root]') : null
  if (root) {
    const r = root.getBoundingClientRect()
    if (r.width && r.height) return { w: r.width, h: r.height }
  }
  return { w: window.innerWidth, h: window.innerHeight }
}

/** Smallest pan (zoom unchanged) that brings `rect` fully inside the container with a margin; null if already visible. */
export function panToReveal(
  vp: Viewport,
  rect: { x: number; y: number; w: number; h: number },
  container: { w: number; h: number },
  margin = MARGIN,
): Viewport | null {
  const left = rect.x * vp.zoom + vp.x
  const top = rect.y * vp.zoom + vp.y
  const right = left + rect.w * vp.zoom
  const bottom = top + rect.h * vp.zoom
  let dx = 0
  let dy = 0
  if (right > container.w - margin) dx = container.w - margin - right
  if (left + dx < margin) dx = margin - left
  if (bottom > container.h - margin) dy = container.h - margin - bottom
  if (top + dy < margin) dy = margin - top
  if (dx === 0 && dy === 0) return null
  return { ...vp, x: vp.x + dx, y: vp.y + dy }
}

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))

/** Pans the canvas so the node is visible; optionally selects it. */
export function revealNode(nodeId: string, opts: { select?: boolean } = {}): void {
  const { doc, setViewport, select } = useCanvasStore.getState()
  const node = doc.nodes[nodeId]
  if (!node) return
  if (opts.select) select({ nodeIds: [nodeId] })
  const target = panToReveal(doc.viewport, { ...node.position, ...node.size }, containerSize())
  if (!target) return
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  // rAF is paused in hidden tabs; jump instead of leaving the pan pending.
  if (reduce || typeof requestAnimationFrame !== 'function' || document.hidden) {
    setViewport(target)
    persistence.scheduleSave()
    return
  }
  const from = doc.viewport
  const start = performance.now()
  const step = (now: number) => {
    const t = easeOutExpo(Math.min(1, (now - start) / DURATION_MS))
    setViewport({ zoom: from.zoom, x: from.x + (target.x - from.x) * t, y: from.y + (target.y - from.y) * t })
    if (t < 1) requestAnimationFrame(step)
    else persistence.scheduleSave()
  }
  requestAnimationFrame(step)
}
