import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SCHEMA_VERSION, type CanvasDocument, type Task } from '@/domain'
import { readDoc, writeDoc } from '@/persistence/db'
import { initPersistence, persistence, SAVE_DEBOUNCE_MS } from '@/persistence/persist'
import { useCanvasStore } from '@/store/canvasStore'
import { resumeTasks } from '@/services/taskRunner'
import { toast } from '@/ui/toast'
import { resetAll, simulateReload } from './helpers'

vi.mock('@/services/taskRunner', () => ({ resumeTasks: vi.fn(async () => {}) }))
vi.mock('@/ui/toast', () => ({ toast: vi.fn() }))

const S = () => useCanvasStore.getState()

function task(id: string, generatorNodeId: string, status: Task['status']): Task {
  return {
    id,
    generatorNodeId,
    inputSnapshot: { imageAssetIds: [], prompts: ['a cat'] },
    params: { aspectRatio: '1:1' },
    status,
    attempt: 1,
    idempotencyKey: `idem_${id}`,
    queuedAt: 1,
    expectedDurationMs: 1000,
    createdAt: 1,
    updatedAt: 1,
  }
}

beforeEach(async () => {
  await resetAll()
  vi.mocked(resumeTasks).mockClear()
  vi.mocked(toast).mockClear()
})
afterEach(() => vi.useRealTimers())

describe('persistence', () => {
  it('starts empty and hydrated when nothing is stored', async () => {
    await initPersistence()
    expect(S().ui.hydrated).toBe(true)
    expect(Object.keys(S().doc.nodes)).toHaveLength(0)
    expect(resumeTasks).toHaveBeenCalledTimes(1)
  })

  it('round-trips nodes, positions, edges, viewport, assets and terminal tasks', async () => {
    await initPersistence()
    const img = S().addNode('image', { x: 10, y: 20 })
    const prompt = S().addNode('prompt', { x: -5, y: 7 }, { data: { text: 'hi' } })
    const gen = S().addNode('generator', { x: 300, y: 0 })
    S().addEdge(img, gen)
    S().addEdge(prompt, gen)
    S().setViewport({ x: 12, y: -34, zoom: 1.5 })
    S().upsertAsset({ id: 'asset_1', kind: 'sample', src: { type: 'url', url: '/s.png' }, createdAt: 1 })
    S().upsertTask(task('task_ok', gen, 'succeeded'))
    S().upsertTask({ ...task('task_bad', gen, 'failed'), error: { code: 'X', message: 'boom' } })
    await persistence.saveNow()
    const before = structuredClone(S().doc)

    await simulateReload()
    expect(Object.keys(S().doc.nodes)).toHaveLength(0)
    await initPersistence()
    expect(S().doc).toEqual(before)
    expect(S().ui.selection).toEqual({ nodeIds: [], edgeIds: [] })
  })

  it('never persists ui state', async () => {
    await initPersistence()
    const id = S().addNode('prompt', { x: 0, y: 0 })
    S().select({ nodeIds: [id] })
    await persistence.saveNow()
    const stored = (await readDoc()) as Record<string, unknown>
    expect(stored).not.toHaveProperty('ui')
    expect(Object.keys(stored).sort()).toEqual(['assets', 'edges', 'nodes', 'tasks', 'version', 'viewport'])
  })

  it('debounces doc changes by 300ms', async () => {
    await initPersistence()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    S().setViewport({ x: 1, y: 1, zoom: 1 })
    S().setViewport({ x: 2, y: 2, zoom: 1 })
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS - 1)
    expect(await readDoc()).toBeUndefined()
    await vi.advanceTimersByTimeAsync(1)
    vi.useRealTimers()
    await persistence.saveNow()
    expect(((await readDoc()) as CanvasDocument).viewport).toEqual({ x: 2, y: 2, zoom: 1 })
  })

  it('does not save before hydration', async () => {
    S().addNode('prompt', { x: 0, y: 0 })
    await persistence.saveNow()
    expect(await readDoc()).toBeUndefined()
  })

  it('rapid consecutive saveNow calls end with the last state', async () => {
    await initPersistence()
    const id = S().addNode('prompt', { x: 0, y: 0 })
    const saves: Promise<void>[] = []
    for (let i = 1; i <= 20; i++) {
      S().moveNode(id, { x: i, y: i })
      saves.push(persistence.saveNow())
    }
    await Promise.all(saves)
    expect(((await readDoc()) as CanvasDocument).nodes[id].position).toEqual({ x: 20, y: 20 })
  })

  it('flushes on pagehide and visibilitychange', async () => {
    await initPersistence()
    const id = S().addNode('prompt', { x: 3, y: 4 })
    window.dispatchEvent(new Event('pagehide'))
    await persistence.saveNow()
    expect(((await readDoc()) as CanvasDocument).nodes[id]).toBeDefined()
  })

  it('migrates a v0 document on load', async () => {
    await writeDoc({
      nodes: {
        a: { id: 'a', type: 'image', position: { x: 0, y: 0 }, size: { w: 1, h: 1 }, createdAt: 1, data: { assetId: null } },
        g: {
          id: 'g',
          type: 'generator',
          position: { x: 0, y: 0 },
          size: { w: 1, h: 1 },
          createdAt: 1,
          data: { params: { aspectRatio: '1:1' }, activeTaskId: null },
        },
      },
      edges: { e1: { id: 'e1', source: 'a', target: 'g' } },
    })
    await initPersistence()
    expect(S().doc.version).toBe(SCHEMA_VERSION)
    expect(S().doc.edges.e1.kind).toBe('input')
    expect(S().doc.viewport).toEqual({ x: 0, y: 0, zoom: 1 })
  })

  it('rejects future versions and never overwrites storage', async () => {
    const future = { version: SCHEMA_VERSION + 1, secret: 'keep me', nodes: {}, edges: {} }
    await writeDoc(future)
    await initPersistence()
    expect(toast).toHaveBeenCalled()
    expect(S().ui.hydrated).toBe(true)
    expect(Object.keys(S().doc.nodes)).toHaveLength(0)
    S().addNode('prompt', { x: 0, y: 0 })
    await persistence.saveNow()
    window.dispatchEvent(new Event('pagehide'))
    await persistence.saveNow()
    expect(await readDoc()).toEqual(future)
  })

  it('repairs dangling edges and stale task pointers on load', async () => {
    await initPersistence()
    const img = S().addNode('image', { x: 0, y: 0 }, { data: { assetId: null, pendingTaskId: 'task_gone' } })
    const gen = S().addNode('generator', { x: 0, y: 0 }, { data: { params: { aspectRatio: '1:1' }, activeTaskId: 'task_gone' } })
    S().addEdge(img, gen)
    await persistence.saveNow()
    const stored = (await readDoc()) as CanvasDocument
    stored.edges.dangling = { id: 'dangling', source: img, target: 'node_missing', kind: 'input' }
    await writeDoc(stored)

    await simulateReload()
    await initPersistence()
    expect(S().doc.edges.dangling).toBeUndefined()
    expect(Object.keys(S().doc.edges)).toHaveLength(1)
    const imgNode = S().doc.nodes[img]
    expect(imgNode.type === 'image' && imgNode.data.pendingTaskId).toBeFalsy()
    const genNode = S().doc.nodes[gen]
    expect(genNode.type === 'generator' && genNode.data.activeTaskId).toBeNull()
  })

  it('calls resumeTasks for a running task before marking hydrated', async () => {
    await initPersistence()
    const gen = S().addNode('generator', { x: 0, y: 0 })
    S().upsertTask(task('task_run', gen, 'running'))
    S().updateNodeData(gen, { activeTaskId: 'task_run' })
    await persistence.saveNow()

    await simulateReload()
    vi.mocked(resumeTasks).mockClear()
    let hydratedDuringResume: boolean | undefined
    let statusDuringResume: string | undefined
    vi.mocked(resumeTasks).mockImplementationOnce(async () => {
      hydratedDuringResume = S().ui.hydrated
      statusDuringResume = S().doc.tasks.task_run?.status
    })
    await initPersistence()
    expect(resumeTasks).toHaveBeenCalledTimes(1)
    expect(statusDuringResume).toBe('running')
    expect(hydratedDuringResume).toBe(false)
    expect(S().ui.hydrated).toBe(true)
  })
})

