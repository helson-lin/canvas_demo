// OWNER: T5 — load/migrate/repair/resume on boot; debounced + immediate saves.
import { useSyncExternalStore } from 'react'
import type { PersistenceAdapter, SaveStatus } from './api'
import { readBlob, readDoc, removeBlob, writeBlob, writeDoc } from './db'
import { createEmptyDocument, findDanglingEdges, migrate, UnsupportedVersionError, type CanvasDocument } from '@/domain'
import { useCanvasStore } from '@/store/canvasStore'
import { resumeTasks } from '@/services/taskRunner'
import { toast } from '@/ui/toast'

export const SAVE_DEBOUNCE_MS = 300

// Saving is off until hydration finishes (so the empty initial doc never clobbers storage),
// and stays off for the session when the stored doc is from a newer, unsupported version.
let savingEnabled = false
let debounceTimer: ReturnType<typeof setTimeout> | null = null
// Serial write queue: each write captures its snapshot at enqueue time and runs FIFO,
// so an older snapshot can never land after a newer one.
let writeQueue: Promise<void> = Promise.resolve()
let lastWritten: CanvasDocument | null = null
let initPromise: Promise<void> | null = null
let teardown: (() => void) | null = null

function enqueueWrite(): Promise<void> {
  if (!savingEnabled) return writeQueue
  const snapshot = useCanvasStore.getState().doc
  const run = async () => {
    if (snapshot === lastWritten) return
    setSaveStatus({ status: 'saving' })
    try {
      await writeDoc(snapshot)
      lastWritten = snapshot
      setSaveStatus({ status: 'saved', savedAt: Date.now() })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setSaveStatus({ status: 'error', error: message })
      toast('保存失败', { kind: 'error', description: message })
      throw err
    }
  }
  const p = writeQueue.then(run)
  // Keep the queue alive after a failure; the caller still sees the rejection.
  writeQueue = p.catch(() => {})
  return p
}

export const persistence: PersistenceAdapter = {
  saveNow: () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    return enqueueWrite()
  },
  scheduleSave: () => {
    if (!savingEnabled) return
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      void enqueueWrite().catch(() => {})
    }, SAVE_DEBOUNCE_MS)
  },
  putBlob: (key, blob) => writeBlob(key, blob),
  getBlob: (key) => readBlob(key),
  deleteBlob: (key) => removeBlob(key),
}

/** Fix references that can't be valid after a crash/partial write. Mutates and returns doc. */
export function repairDocument(doc: CanvasDocument): CanvasDocument {
  for (const e of findDanglingEdges(doc)) delete doc.edges[e.id]
  for (const node of Object.values(doc.nodes)) {
    if (node.type === 'image' && node.data.pendingTaskId && !doc.tasks[node.data.pendingTaskId]) {
      const { pendingTaskId: _drop, ...rest } = node.data
      node.data = rest
    }
    if (node.type === 'generator' && node.data.activeTaskId && !doc.tasks[node.data.activeTaskId]) {
      node.data = { ...node.data, activeTaskId: null }
    }
  }
  return doc
}

async function loadDocument(): Promise<{ doc: CanvasDocument; canSave: boolean }> {
  let raw: unknown
  try {
    raw = await readDoc()
  } catch (err) {
    // Storage unreadable: don't overwrite what might still be recoverable.
    toast('读取本地画布失败', { kind: 'error', description: err instanceof Error ? err.message : String(err) })
    return { doc: createEmptyDocument(), canSave: false }
  }
  if (raw === undefined) return { doc: createEmptyDocument(), canSave: true }
  try {
    return { doc: repairDocument(migrate(raw)), canSave: true }
  } catch (err) {
    const description = err instanceof Error ? err.message : String(err)
    if (err instanceof UnsupportedVersionError) {
      toast('画布数据来自更新的版本', { kind: 'error', description: `${description}。本次不会保存，以免覆盖。` })
    } else {
      toast('画布数据无法解析', { kind: 'error', description: `${description}。本次不会保存，以免覆盖。` })
    }
    return { doc: createEmptyDocument(), canSave: false }
  }
}

function attachListeners(): () => void {
  const unsub = useCanvasStore.subscribe((state, prev) => {
    if (state.doc !== prev.doc) persistence.scheduleSave()
  })
  const flush = () => void persistence.saveNow().catch(() => {})
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flush()
  }
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', flush)
  return () => {
    unsub()
    document.removeEventListener('visibilitychange', onVisibility)
    window.removeEventListener('pagehide', flush)
  }
}

/** Idempotent (safe under StrictMode double effects). */
export function initPersistence(): Promise<void> {
  if (!initPromise) initPromise = boot()
  return initPromise
}

async function boot(): Promise<void> {
  const { doc, canSave } = await loadDocument()
  const store = useCanvasStore.getState()
  store.replaceDoc(doc)
  // The loaded doc is by definition what's stored; skip the redundant write.
  lastWritten = useCanvasStore.getState().doc
  teardown = attachListeners()
  savingEnabled = canSave
  try {
    await resumeTasks()
  } catch (err) {
    toast('恢复任务失败', { kind: 'error', description: err instanceof Error ? err.message : String(err) })
  }
  useCanvasStore.getState().setHydrated(true)
}

/** Test-only: forget boot state and listeners so initPersistence can run again. */
export async function resetPersistenceForTests(): Promise<void> {
  teardown?.()
  teardown = null
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = null
  await writeQueue
  writeQueue = Promise.resolve()
  savingEnabled = false
  lastWritten = null
  initPromise = null
  setSaveStatus({ status: 'idle' })
}

// Save status for C3 SaveIndicator. T5 must call setSaveStatus on every save transition.
let saveStatus: { status: SaveStatus; error?: string; savedAt?: number } = { status: 'idle' }
const saveListeners = new Set<() => void>()

export function setSaveStatus(next: typeof saveStatus): void {
  saveStatus = next
  saveListeners.forEach((l) => l())
}

export function useSaveStatus() {
  return useSyncExternalStore(
    (l) => {
      saveListeners.add(l)
      return () => saveListeners.delete(l)
    },
    () => saveStatus,
  )
}
