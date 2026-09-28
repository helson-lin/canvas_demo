// Keyboard-level editing commands: clipboard, select all, nudge. Each records one undo step.
import { cloneForPaste, copyNodes, type ClipboardData } from '@/domain'
import { persistence } from '@/persistence/persist'
import { useCanvasStore } from '@/store/canvasStore'
import { checkpoint } from '@/store/history'
import { toast } from '@/ui/toast'

const PASTE_STEP = 32
let clipboard: ClipboardData | null = null
let pasteCount = 0

export function copySelection(): boolean {
  const { doc, ui } = useCanvasStore.getState()
  const clip = copyNodes(doc, ui.selection.nodeIds)
  if (!clip) return false
  clipboard = clip
  pasteCount = 0
  toast(`已复制 ${clip.nodes.length} 个节点`)
  return true
}

function insert(clip: ClipboardData, step: number): string[] {
  const pasted = cloneForPaste(clip, { x: PASTE_STEP * step, y: PASTE_STEP * step }, Date.now())
  checkpoint()
  const store = useCanvasStore.getState()
  store.transact((doc) => {
    for (const n of pasted.nodes) doc.nodes[n.id] = n
    for (const e of pasted.edges) doc.edges[e.id] = e
  })
  const ids = pasted.nodes.map((n) => n.id)
  store.select({ nodeIds: ids })
  void persistence.saveNow()
  return ids
}

/** Each paste of the same clipboard lands one step further so copies don't stack exactly. */
export function pasteClipboard(): string[] {
  if (!clipboard) return []
  pasteCount += 1
  return insert(clipboard, pasteCount)
}

export function duplicateSelection(): string[] {
  const { doc, ui } = useCanvasStore.getState()
  const clip = copyNodes(doc, ui.selection.nodeIds)
  return clip ? insert(clip, 1) : []
}

export function selectAll(): void {
  const store = useCanvasStore.getState()
  store.select({ nodeIds: Object.keys(store.doc.nodes) })
}

/** Arrow keys: 1 world unit, Shift for 10. A burst of presses is one undo step. */
export function nudgeSelection(dx: number, dy: number): boolean {
  const store = useCanvasStore.getState()
  const ids = store.ui.selection.nodeIds
  if (!ids.length) return false
  checkpoint('nudge')
  store.transact((doc) => {
    for (const id of ids) {
      const n = doc.nodes[id]
      if (n) n.position = { x: n.position.x + dx, y: n.position.y + dy }
    }
  })
  persistence.scheduleSave()
  return true
}

export function resetClipboardForTests(): void {
  clipboard = null
  pasteCount = 0
}
