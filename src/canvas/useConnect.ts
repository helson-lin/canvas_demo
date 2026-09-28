// OWNER: T3 — drag from output handle to generator to create an edge.
import { useSyncExternalStore, type PointerEvent as ReactPointerEvent } from 'react'
import { canConnect, handlePoint, type Vec2 } from '@/domain'
import { persistence } from '@/persistence/persist'
import { useCanvasStore } from '@/store/canvasStore'
import { toast } from '@/ui/toast'
import { screenToWorld, worldToScreen } from './coords'
import { checkpoint } from '@/store/history'

export interface ConnectPreview {
  sourceId: string
  /** World coordinates of the pointer. */
  to: Vec2
  /** Node under the pointer and whether dropping there would be accepted. */
  targetId: string | null
  valid: boolean
}

// Module-level store: the preview is transient UI and must never enter the persisted doc.
let preview: ConnectPreview | null = null
const listeners = new Set<() => void>()
function setPreview(next: ConnectPreview | null) {
  preview = next
  listeners.forEach((l) => l())
}
function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useConnectPreview(): ConnectPreview | null {
  return useSyncExternalStore(subscribe, () => preview)
}

function nodeIdAt(clientX: number, clientY: number): string | null {
  const el = document.elementFromPoint(clientX, clientY)
  return el?.closest<HTMLElement>('[data-node-id]')?.dataset.nodeId ?? null
}

/**
 * Container offset (client px of the canvas container's top-left). Prefer `[data-canvas-root]`;
 * otherwise derive it from the handle itself: its client center must equal worldToScreen(handlePoint) + offset.
 */
function containerOffset(handleEl: Element, sourceId: string): Vec2 {
  const root = handleEl.closest('[data-canvas-root]')
  if (root) {
    const r = root.getBoundingClientRect()
    return { x: r.left, y: r.top }
  }
  const { doc } = useCanvasStore.getState()
  const r = handleEl.getBoundingClientRect()
  const s = worldToScreen(handlePoint(doc.nodes[sourceId], 'out'), doc.viewport)
  return { x: r.left + r.width / 2 - s.x, y: r.top + r.height / 2 - s.y }
}

export function startConnect(e: ReactPointerEvent<Element>, sourceId: string): void {
  if (e.button !== 0) return
  // Keep T1's node drag / canvas pan from starting.
  e.stopPropagation()
  e.preventDefault()
  const offset = containerOffset(e.currentTarget, sourceId)

  const toWorld = (clientX: number, clientY: number) =>
    screenToWorld({ x: clientX - offset.x, y: clientY - offset.y }, useCanvasStore.getState().doc.viewport)

  const update = (clientX: number, clientY: number) => {
    const targetId = nodeIdAt(clientX, clientY)
    const valid =
      !!targetId && targetId !== sourceId && canConnect(useCanvasStore.getState().doc, sourceId, targetId).ok
    setPreview({ sourceId, to: toWorld(clientX, clientY), targetId, valid })
  }

  const cleanup = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', cancel)
    window.removeEventListener('keydown', onKey, true)
    setPreview(null)
  }
  const cancel = () => cleanup()
  const onMove = (ev: PointerEvent) => update(ev.clientX, ev.clientY)
  const onKey = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape') {
      ev.stopPropagation()
      cleanup()
    }
  }
  const onUp = (ev: PointerEvent) => {
    const targetId = nodeIdAt(ev.clientX, ev.clientY)
    cleanup()
    // Dropping on empty canvas or back on the source is a silent cancel.
    if (!targetId || targetId === sourceId) return
    const store = useCanvasStore.getState()
    const res = canConnect(store.doc, sourceId, targetId)
    if (!res.ok) {
      toast('无法连接', { kind: 'error', description: res.reason })
      return
    }
    checkpoint()
    if (store.addEdge(sourceId, targetId)) void persistence.saveNow()
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', cancel)
  window.addEventListener('keydown', onKey, true)
  update(e.clientX, e.clientY)
}

/** Hook form for components: `const { preview, startConnect } = useConnect()`. */
export function useConnect() {
  return { preview: useConnectPreview(), startConnect }
}
