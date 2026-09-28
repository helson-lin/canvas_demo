// jsdom's Blob can't be structured-cloned by fake-indexeddb; Node's native Blob/File can (as in real browsers).
import { Blob as NodeBlob, File as NodeFile } from 'node:buffer'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listBlobKeys } from '@/persistence/db'
import { initPersistence, persistence } from '@/persistence/persist'
import { gcBlobs, importFile, persistRemote, useAssetUrl } from '@/services/assetStore'
import { useCanvasStore } from '@/store/canvasStore'
import { resetAll, simulateReload } from '@/persistence/__tests__/helpers'

vi.mock('@/services/taskRunner', () => ({ resumeTasks: vi.fn(async () => {}) }))
vi.mock('@/ui/toast', () => ({ toast: vi.fn() }))

const Blob = NodeBlob as unknown as typeof globalThis.Blob
const File = NodeFile as unknown as typeof globalThis.File
const S = () => useCanvasStore.getState()
let seq = 0

beforeEach(async () => {
  await resetAll()
  URL.createObjectURL = vi.fn(() => `blob:test/${++seq}`)
  URL.revokeObjectURL = vi.fn()
})
afterEach(() => vi.unstubAllGlobals())

describe('assetStore', () => {
  it('importFile stores the blob and an upload asset that survive reload', async () => {
    await initPersistence()
    const id = await importFile(new File(['hello'], 'a.png', { type: 'image/png' }))
    expect(S().doc.assets[id]).toMatchObject({ kind: 'upload', src: { type: 'blob' } })

    await simulateReload()
    await initPersistence()
    const asset = S().doc.assets[id]
    expect(asset?.src.type).toBe('blob')
    const blob = asset?.src.type === 'blob' ? await persistence.getBlob(asset.src.blobKey) : undefined
    expect(blob).toBeDefined()
    expect(blob?.size).toBe(5)

    const { result, unmount } = renderHook(() => useAssetUrl(id))
    expect(result.current).toBeNull()
    await waitFor(() => expect(result.current).toMatch(/^blob:test\//))
    unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith(result.current)
  })

  it('shares one objectURL between users and revokes after the last unmount', async () => {
    await initPersistence()
    const id = await importFile(new File(['x'], 'a.png'))
    const a = renderHook(() => useAssetUrl(id))
    const b = renderHook(() => useAssetUrl(id))
    await waitFor(() => expect(b.result.current).not.toBeNull())
    expect(a.result.current).toBe(b.result.current)
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    a.unmount()
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    b.unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
  })

  it('returns url sources directly and null for missing assets/blobs', async () => {
    await initPersistence()
    act(() => {
      S().upsertAsset({ id: 's', kind: 'sample', src: { type: 'url', url: '/s.png' }, createdAt: 1 })
      S().upsertAsset({ id: 'm', kind: 'upload', src: { type: 'blob', blobKey: 'nope' }, createdAt: 1 })
    })
    expect(renderHook(() => useAssetUrl('s')).result.current).toBe('/s.png')
    expect(renderHook(() => useAssetUrl('zzz')).result.current).toBeNull()
    const missing = renderHook(() => useAssetUrl('m'))
    await act(async () => {
      await persistence.getBlob('nope')
    })
    expect(missing.result.current).toBeNull()
  })

  it('persistRemote writes the blob first and registers a generated asset', async () => {
    await initPersistence()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, blob: async () => new Blob(['img']) })))
    const id = await persistRemote('/mock/result.png', 'task_1')
    const asset = S().doc.assets[id]
    expect(asset).toMatchObject({ kind: 'generated', origin: { taskId: 'task_1' } })
    const key = asset?.src.type === 'blob' ? asset.src.blobKey : ''
    expect(await persistence.getBlob(key)).toBeDefined()
  })

  it('persistRemote rejects on HTTP errors without creating an asset', async () => {
    await initPersistence()
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, blob: async () => new Blob([]) })))
    await expect(persistRemote('/x', 't')).rejects.toThrow()
    expect(Object.keys(S().doc.assets)).toHaveLength(0)
  })

  it('gcBlobs removes only unreferenced blobs', async () => {
    await initPersistence()
    const id = await importFile(new File(['keep'], 'k.png'))
    await persistence.putBlob('orphan', new Blob(['o']))
    expect(await gcBlobs()).toBe(1)
    const asset = S().doc.assets[id]
    expect(await listBlobKeys()).toEqual([asset?.src.type === 'blob' ? asset.src.blobKey : ''])
  })
})
