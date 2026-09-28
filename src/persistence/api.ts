// Shared contract — T5 implements it in persist.ts.
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface PersistenceAdapter {
  /** Immediate write; resolves when the doc is durable. Use for state transitions. */
  saveNow(): Promise<void>
  /** Debounced write (drag / viewport / text). */
  scheduleSave(): void
  putBlob(key: string, blob: Blob): Promise<void>
  getBlob(key: string): Promise<Blob | undefined>
  deleteBlob(key: string): Promise<void>
}
