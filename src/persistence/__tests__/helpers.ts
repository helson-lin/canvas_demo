import { IDBFactory } from 'fake-indexeddb'
import { createEmptyDocument } from '@/domain'
import { resetDbForTests } from '@/persistence/db'
import { resetPersistenceForTests } from '@/persistence/persist'
import { useCanvasStore } from '@/store/canvasStore'

/** Fresh IndexedDB + fresh store + fresh persistence module state. */
export async function resetAll(): Promise<void> {
  await resetPersistenceForTests()
  globalThis.indexedDB = new IDBFactory()
  resetDbForTests()
  useCanvasStore.getState().replaceDoc(createEmptyDocument())
  useCanvasStore.getState().setHydrated(false)
}

/** Simulate a page reload: drop in-memory state but keep IndexedDB. */
export async function simulateReload(): Promise<void> {
  await resetPersistenceForTests()
  resetDbForTests()
  useCanvasStore.getState().replaceDoc(createEmptyDocument())
  useCanvasStore.getState().setHydrated(false)
}
