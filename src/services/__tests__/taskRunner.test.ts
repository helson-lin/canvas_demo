import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyDocument, type ImageNode, type Task, type TaskService } from '@/domain'
import { createMockTaskService } from '@/services/mockTaskService'
import { setMockConfig } from '@/services/mockConfig'
import {
  cancelTask,
  configureTaskRunner,
  resetTaskRunner,
  resumeTasks,
  retryTask,
  startGeneration,
} from '@/services/taskRunner'
import { useCanvasStore } from '@/store/canvasStore'
import { subscribeToasts, type ToastMessage } from '@/ui/toast'

const store = () => useCanvasStore.getState()
const doc = () => store().doc

let persistRemote: ReturnType<typeof vi.fn<(url: string, taskId: string) => Promise<string>>>
let saveNow: ReturnType<typeof vi.fn<() => Promise<void>>>
let toasts: ToastMessage[]
let unsub: () => void

function setup(opts: { prompt?: string; withImage?: boolean } = {}) {
  store().replaceDoc(createEmptyDocument())
  const genId = store().addNode('generator', { x: 100, y: 50 })
  let imageId: string | undefined
  if (opts.withImage !== false) {
    store().upsertAsset({ id: 'asset_orig', kind: 'sample', src: { type: 'url', url: '/samples/square.svg' }, createdAt: 0 })
    imageId = store().addNode('image', { x: -300, y: 0 }, { data: { assetId: 'asset_orig' } })
    store().addEdge(imageId, genId, 'input')
  }
  if (opts.prompt !== undefined) {
    const p = store().addNode('prompt', { x: -300, y: 300 }, { data: { text: opts.prompt } })
    store().addEdge(p, genId, 'input')
  }
  return { genId, imageId }
}

function useService(service: TaskService) {
  configureTaskRunner({ service, persistRemote, persistence: { saveNow }, now: () => Date.now(), reveal })
}

const reveal = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(1_000_000)
  setMockConfig({ failNext: false, failAll: false, queueMs: 800, runMs: 2500 })
  persistRemote = vi.fn(async (url: string, taskId: string) => {
    const id = `asset_gen_${taskId}`
    store().upsertAsset({ id, kind: 'generated', src: { type: 'url', url }, origin: { taskId }, createdAt: Date.now() })
    return id
  })
  saveNow = vi.fn(async () => {})
  useService(createMockTaskService())
  toasts = []
  unsub = subscribeToasts((t) => toasts.push(t))
})

afterEach(() => {
  unsub()
  resetTaskRunner()
  vi.useRealTimers()
})

const task = (id: string): Task => doc().tasks[id]!
const node = (id: string) => doc().nodes[id] as ImageNode

describe('taskRunner', () => {
  it('happy path: queued -> running -> succeeded with a new asset; original untouched', async () => {
    const { genId, imageId } = setup({ prompt: 'a cat' })
    const origBefore = structuredClone(doc().nodes[imageId!])
    const taskId = (await startGeneration(genId))!
    const t = task(taskId)
    expect(t.status).toBe('queued')
    expect(t.expectedDurationMs).toBe(3300)
    // The service-side id is persisted so a reload can re-attach to the same remote task.
    expect(t.remoteTaskId).toMatch(/.+/)
    expect(t.inputSnapshot).toEqual({ imageAssetIds: ['asset_orig'], prompts: ['a cat'] })
    const ph = node(t.resultNodeId!)
    expect(ph.data).toEqual({ assetId: null, pendingTaskId: taskId })
    expect(ph.position).toEqual({ x: 100 + 300 + 40, y: 50 })
    expect(Object.values(doc().edges).some((e) => e.kind === 'result' && e.source === genId && e.target === ph.id)).toBe(true)
    expect(doc().nodes[genId]!.type === 'generator' && (doc().nodes[genId] as { data: { activeTaskId: string } }).data.activeTaskId).toBe(taskId)
    expect(saveNow).toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1000)
    expect(task(taskId).status).toBe('running')
    await vi.advanceTimersByTimeAsync(3000)
    expect(task(taskId).status).toBe('succeeded')
    expect(persistRemote).toHaveBeenCalledWith('/samples/result-square.svg', taskId)
    const done = node(t.resultNodeId!)
    expect(done.data.assetId).toBe(`asset_gen_${taskId}`)
    expect(done.data.pendingTaskId).toBeUndefined()
    expect(task(taskId).resultAssetId).toBe(`asset_gen_${taskId}`)
    expect(doc().nodes[imageId!]).toEqual(origBefore)
    expect(doc().assets.asset_orig!.kind).toBe('sample')
  })

  it('reveals the placeholder on submit and offers 定位 on success', async () => {
    reveal.mockClear()
    const toasts: ToastMessage[] = []
    const off = subscribeToasts((t) => toasts.push(t))
    const { genId } = setup({ prompt: 'a cat' })
    const taskId = (await startGeneration(genId))!
    const placeholderId = task(taskId).resultNodeId!
    expect(reveal).toHaveBeenCalledWith(placeholderId)
    await vi.advanceTimersByTimeAsync(4000)
    const done = toasts.find((t) => t.title === '生成完成')!
    expect(done.action?.label).toBe('定位')
    done.action!.onClick()
    expect(reveal).toHaveBeenLastCalledWith(placeholderId, { select: true })
    off()
  })

  it('cancel records a reason, and a cancelled task can be retried to success', async () => {
    const { genId } = setup({ prompt: 'a cat' })
    const taskId = (await startGeneration(genId))!
    await cancelTask(taskId)
    expect(task(taskId).status).toBe('cancelled')
    expect(task(taskId).error).toEqual({ code: 'CANCELLED', message: '已取消' })
    const retryId = (await retryTask(taskId))!
    await vi.advanceTimersByTimeAsync(4000)
    expect(task(retryId).status).toBe('succeeded')
    expect(task(retryId).resultNodeId).toBe(task(taskId).resultNodeId)
  })

  it('blocks duplicate submit while active', async () => {
    const { genId } = setup({ prompt: 'x' })
    await startGeneration(genId)
    const again = await startGeneration(genId)
    expect(again).toBeNull()
    expect(Object.keys(doc().tasks)).toHaveLength(1)
    expect(toasts.some((t) => t.title === '任务进行中')).toBe(true)
  })

  it('failNext -> failed, retry -> succeeded reusing placeholder and snapshot', async () => {
    setMockConfig({ failNext: true })
    const { genId } = setup({ prompt: 'p' })
    const first = (await startGeneration(genId))!
    await vi.advanceTimersByTimeAsync(4000)
    expect(task(first).status).toBe('failed')
    expect(task(first).error?.code).toBe('MOCK_FORCED_FAILURE')
    const second = (await retryTask(first))!
    const t2 = task(second)
    expect(t2.attempt).toBe(2)
    expect(t2.retryOf).toBe(first)
    expect(t2.idempotencyKey).not.toBe(task(first).idempotencyKey)
    expect(t2.inputSnapshot).toEqual(task(first).inputSnapshot)
    expect(t2.params).toEqual(task(first).params)
    expect(t2.resultNodeId).toBe(task(first).resultNodeId)
    expect(node(t2.resultNodeId!).data.pendingTaskId).toBe(second)
    await vi.advanceTimersByTimeAsync(4000)
    expect(task(second).status).toBe('succeeded')
    expect(task(first).status).toBe('failed')
    expect(Object.values(doc().nodes).filter((n) => n.type === 'image')).toHaveLength(2)
  })

  it('#fail prompt -> CONTENT_REJECTED', async () => {
    const { genId } = setup({ prompt: 'bad #fail' })
    const id = (await startGeneration(genId))!
    await vi.advanceTimersByTimeAsync(4000)
    expect(task(id).error?.code).toBe('CONTENT_REJECTED')
  })

  it('empty input is rejected before creating a task', async () => {
    const { genId } = setup({ withImage: false, prompt: '   ' })
    expect(await startGeneration(genId)).toBeNull()
    expect(Object.keys(doc().tasks)).toHaveLength(0)
    expect(toasts.some((t) => t.description?.includes('EMPTY_INPUT'))).toBe(true)
  })

  it('placeholder deleted mid-run -> no asset created', async () => {
    const { genId } = setup({ prompt: 'x' })
    const id = (await startGeneration(genId))!
    await vi.advanceTimersByTimeAsync(1000)
    store().removeNodes([task(id).resultNodeId!])
    await vi.advanceTimersByTimeAsync(4000)
    expect(task(id).status).toBe('cancelled')
    expect(persistRemote).not.toHaveBeenCalled()
    expect(Object.values(doc().assets).filter((a) => a.kind === 'generated')).toHaveLength(0)
  })

  it('drops result if cancelled while persisting the asset', async () => {
    const { genId } = setup({ prompt: 'x' })
    const id = (await startGeneration(genId))!
    persistRemote.mockImplementationOnce(async (url, taskId) => {
      await cancelTask(taskId)
      store().upsertAsset({ id: 'asset_late', kind: 'generated', src: { type: 'url', url }, origin: { taskId }, createdAt: 0 })
      return 'asset_late'
    })
    await vi.advanceTimersByTimeAsync(4000)
    expect(task(id).status).toBe('cancelled')
    expect(doc().assets.asset_late).toBeUndefined()
    expect(node(task(id).resultNodeId!).data.assetId).toBeNull()
  })

  it('resume within window succeeds; beyond window -> interrupted', async () => {
    const { genId } = setup({ prompt: 'x' })
    const now = Date.now()
    const base = { generatorNodeId: genId, inputSnapshot: { imageAssetIds: [], prompts: ['x'] }, params: { aspectRatio: '1:1' as const }, attempt: 1, expectedDurationMs: 3300, createdAt: now, updatedAt: now }
    store().transact((d) => {
      d.tasks.t_ok = { ...base, id: 't_ok', status: 'running', idempotencyKey: 'k1', queuedAt: now - 2000, startedAt: now - 1200 }
      d.tasks.t_old = { ...base, id: 't_old', status: 'queued', idempotencyKey: 'k2', queuedAt: now - 60_000 }
      d.nodes.ph = { id: 'ph', type: 'image', position: { x: 0, y: 0 }, size: { w: 1, h: 1 }, createdAt: now, data: { assetId: null, pendingTaskId: 't_ok' } }
      d.tasks.t_ok.resultNodeId = 'ph'
    })
    // Fresh service simulates a page reload (in-memory state lost).
    useService(createMockTaskService())
    await resumeTasks()
    expect(task('t_old').status).toBe('interrupted')
    expect(task('t_old').error).toEqual({ code: 'INTERRUPTED', message: '页面刷新导致任务中断' })
    expect(task('t_ok').status).toBe('running')
    // Remaining run time = 2500 - 1200 = 1300ms, plus one poll tick.
    await vi.advanceTimersByTimeAsync(1300 + 500)
    expect(task('t_ok').status).toBe('succeeded')
    expect(node('ph').data.assetId).toBe('asset_gen_t_ok')
  })

  it('timeout guard fails tasks stuck past expected x3', async () => {
    const stuck: TaskService = {
      submit: async () => ({ taskId: 'remote', expectedDurationMs: 3300 }),
      get: async (taskId) => ({ taskId, status: 'queued' }),
      cancel: async () => {},
      resume: async () => ({ resumable: true, taskId: 'remote' }),
    }
    useService(stuck)
    const { genId } = setup({ prompt: 'x' })
    const id = (await startGeneration(genId))!
    await vi.advanceTimersByTimeAsync(3300 * 3 - 100)
    expect(task(id).status).toBe('queued')
    await vi.advanceTimersByTimeAsync(200)
    expect(task(id).status).toBe('failed')
    expect(task(id).error?.code).toBe('TIMEOUT')
  })
})
