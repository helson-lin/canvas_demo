// OWNER: T5 — asset import/persist and URL resolution.
import { useEffect, useState } from 'react'
import { newId, type Asset } from '@/domain'
import { listBlobKeys } from '@/persistence/db'
import { persistence } from '@/persistence/persist'
import { useCanvasStore } from '@/store/canvasStore'

async function measure(blob: Blob): Promise<{ width?: number; height?: number }> {
  if (typeof createImageBitmap !== 'function') return {}
  try {
    const bmp = await createImageBitmap(blob)
    const size = { width: bmp.width, height: bmp.height }
    bmp.close()
    return size
  } catch {
    return {}
  }
}

/** Blob → IndexedDB first, then the Asset in the doc, then a durable save. Returns the asset id. */
export async function importFile(file: File): Promise<string> {
  const id = newId('asset')
  const blobKey = id
  await persistence.putBlob(blobKey, file)
  const size = await measure(file)
  useCanvasStore.getState().upsertAsset({
    id,
    kind: 'upload',
    src: { type: 'blob', blobKey },
    ...size,
    createdAt: Date.now(),
  })
  await persistence.saveNow()
  return id
}

/**
 * Fetch a remote/mock URL into a Blob, persist it, then register a generated Asset. Blob first, doc second.
 * Does NOT call saveNow: the caller (T4) links the asset to the node and flips the task to succeeded,
 * then calls saveNow once so asset + node + task land in the same doc write. Until then the asset is
 * only in memory, which is safe — its blob is already durable and an orphan blob is cleaned by gcBlobs.
 */
export async function persistRemote(url: string, originTaskId: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`下载生成结果失败（HTTP ${res.status}）`)
  const blob = await res.blob()
  const id = newId('asset')
  await persistence.putBlob(id, blob)
  const size = await measure(blob)
  useCanvasStore.getState().upsertAsset({
    id,
    kind: 'generated',
    src: { type: 'blob', blobKey: id },
    ...size,
    origin: { taskId: originTaskId },
    createdAt: Date.now(),
  })
  return id
}

/** Delete stored blobs no Asset references. Assets themselves are kept even when no node uses them. */
export async function gcBlobs(): Promise<number> {
  const referenced = new Set<string>()
  for (const a of Object.values(useCanvasStore.getState().doc.assets)) {
    if (a.src.type === 'blob') referenced.add(a.src.blobKey)
  }
  const orphans = (await listBlobKeys()).filter((k) => !referenced.has(k))
  await Promise.all(orphans.map((k) => persistence.deleteBlob(k)))
  return orphans.length
}

// In-memory objectURL cache, ref-counted per blobKey. Never persisted.
interface Entry {
  refs: number
  url: string | null
  promise: Promise<string | null>
}
const urlCache = new Map<string, Entry>()

function acquire(blobKey: string): Entry {
  let entry = urlCache.get(blobKey)
  if (!entry) {
    const e: Entry = { refs: 0, url: null, promise: Promise.resolve(null) }
    e.promise = persistence.getBlob(blobKey).then(
      (blob) => {
        if (!blob || urlCache.get(blobKey) !== e) return null
        e.url = URL.createObjectURL(blob)
        return e.url
      },
      () => null,
    )
    urlCache.set(blobKey, e)
    entry = e
  }
  entry.refs += 1
  return entry
}

function release(blobKey: string): void {
  const entry = urlCache.get(blobKey)
  if (!entry) return
  entry.refs -= 1
  if (entry.refs > 0) return
  urlCache.delete(blobKey)
  if (entry.url) URL.revokeObjectURL(entry.url)
}

function blobKeyOf(asset: Asset | undefined): string | null {
  return asset?.src.type === 'blob' ? asset.src.blobKey : null
}

/**
 * Resolves an asset to a displayable URL.
 * - url sources: returned synchronously.
 * - blob sources: null while loading, then an objectURL (shared + revoked when the last user unmounts).
 * - missing asset or missing blob: null — UI should render the "missing" placeholder.
 */
export function useAssetUrl(assetId: string | null | undefined): string | null {
  const asset = useCanvasStore((s) => (assetId ? s.doc.assets[assetId] : undefined))
  const blobKey = blobKeyOf(asset)
  const [resolved, setResolved] = useState<{ key: string; url: string | null } | null>(null)

  useEffect(() => {
    if (!blobKey) return
    let alive = true
    const entry = acquire(blobKey)
    void entry.promise.then((url) => {
      if (alive) setResolved({ key: blobKey, url })
    })
    return () => {
      alive = false
      release(blobKey)
    }
  }, [blobKey])

  if (!asset) return null
  if (asset.src.type === 'url') return asset.src.url
  return resolved && resolved.key === blobKey ? resolved.url : null
}
