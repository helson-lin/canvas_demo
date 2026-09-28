// OWNER: T5 — load/migrate/repair/resume on boot; debounced + immediate saves.
import type { PersistenceAdapter } from './api'
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
