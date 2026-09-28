// OWNER: T5 — load/migrate/repair/resume on boot; debounced + immediate saves.
import { useSyncExternalStore } from 'react'
import type { PersistenceAdapter, SaveStatus } from './api'
import { useCanvasStore } from '@/store/canvasStore'

export const persistence: PersistenceAdapter = {
  saveNow: async () => {},
  scheduleSave: () => {},
  putBlob: async () => {},
  getBlob: async () => undefined,
  deleteBlob: async () => {},
}

export async function initPersistence(): Promise<void> {
  useCanvasStore.getState().setHydrated(true)
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
