// OWNER: T5 — asset import/persist and URL resolution.
import { useCanvasStore } from '@/store/canvasStore'

export async function importFile(_file: File): Promise<string> {
  throw new Error('TODO T5')
}

/** Fetch a remote/mock URL into a Blob, persist it, then register a generated Asset. Blob first, doc second. */
export async function persistRemote(_url: string, _originTaskId: string): Promise<string> {
  throw new Error('TODO T5')
}

/** Resolves an asset to a displayable URL; null when missing. */
export function useAssetUrl(assetId: string | null | undefined): string | null {
  const asset = useCanvasStore((s) => (assetId ? s.doc.assets[assetId] : undefined))
  if (!asset) return null
  return asset.src.type === 'url' ? asset.src.url : null
}
