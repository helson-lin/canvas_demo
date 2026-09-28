// OWNER: T5 — IndexedDB via idb-keyval (custom store "canvas-demo").
import { createStore, del, get, keys, set, type UseStore } from 'idb-keyval'

export const DOC_KEY = 'doc'
export const BLOB_PREFIX = 'blob:'

let store: UseStore | null = null

// Lazily created so tests can swap the fake IDBFactory between cases (see resetDbForTests).
function db(): UseStore {
  if (!store) store = createStore('canvas-demo', 'kv')
  return store
}

export const readDoc = (): Promise<unknown> => get(DOC_KEY, db())
export const writeDoc = (doc: unknown): Promise<void> => set(DOC_KEY, doc, db())

export const readBlob = (key: string): Promise<Blob | undefined> => get<Blob>(BLOB_PREFIX + key, db())
export const writeBlob = (key: string, blob: Blob): Promise<void> => set(BLOB_PREFIX + key, blob, db())
export const removeBlob = (key: string): Promise<void> => del(BLOB_PREFIX + key, db())

export async function listBlobKeys(): Promise<string[]> {
  const all = await keys(db())
  return all
    .filter((k): k is string => typeof k === 'string' && k.startsWith(BLOB_PREFIX))
    .map((k) => k.slice(BLOB_PREFIX.length))
}

/** Test-only: drop the cached connection so a fresh fake IDBFactory is used. */
export function resetDbForTests(): void {
  store = null
}
