import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SubmitTaskRequest } from '@/domain'
import { getMockConfig, setMockConfig } from '@/services/mockConfig'
import { createMockTaskService } from '@/services/mockTaskService'

const req = (over: Partial<SubmitTaskRequest> = {}): SubmitTaskRequest => ({
  idempotencyKey: 'k',
  generatorNodeId: 'g',
  inputs: { imageAssetIds: ['a'], prompts: [] },
  params: { aspectRatio: '16:9' },
  ...over,
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
  setMockConfig({ failNext: false, failAll: false, queueMs: 800, runMs: 2500 })
})
afterEach(() => vi.useRealTimers())

describe('MockTaskService', () => {
  it('dedupes by idempotencyKey', async () => {
    const s = createMockTaskService()
    const a = await s.submit(req())
    const b = await s.submit(req())
    expect(a.taskId).toBe(b.taskId)
    expect((await s.submit(req({ idempotencyKey: 'other' }))).taskId).not.toBe(a.taskId)
  })

  it('runs queued -> running -> succeeded with aspect-matched output', async () => {
    const s = createMockTaskService()
    const { taskId } = await s.submit(req())
    expect((await s.get(taskId)).status).toBe('queued')
    await vi.advanceTimersByTimeAsync(800)
    expect((await s.get(taskId)).status).toBe('running')
    await vi.advanceTimersByTimeAsync(2500)
    const res = await s.get(taskId)
    expect(res.status).toBe('succeeded')
    expect(res.result?.url).toBe('/samples/result-wide.svg')
  })

  it('failNext is consumed once; failAll persists', async () => {
    const s = createMockTaskService()
    setMockConfig({ failNext: true })
    const a = await s.submit(req({ idempotencyKey: '1' }))
    expect(getMockConfig().failNext).toBe(false)
    const b = await s.submit(req({ idempotencyKey: '2' }))
    setMockConfig({ failAll: true })
    const c = await s.submit(req({ idempotencyKey: '3' }))
    await vi.advanceTimersByTimeAsync(4000)
    expect((await s.get(a.taskId)).error?.code).toBe('MOCK_FORCED_FAILURE')
    expect((await s.get(b.taskId)).status).toBe('succeeded')
    expect((await s.get(c.taskId)).error?.code).toBe('MOCK_FORCED_FAILURE')
  })

  it('rejects empty input', async () => {
    const s = createMockTaskService()
    await expect(s.submit(req({ inputs: { imageAssetIds: [], prompts: [' '] } }))).rejects.toMatchObject({ code: 'EMPTY_INPUT' })
  })

  it('resume: finishes near original schedule; too old is not resumable', async () => {
    vi.setSystemTime(10_000)
    const s = createMockTaskService()
    const base = { ...req(), expectedDurationMs: 3300 }
    expect(await s.resume({ ...base, taskId: 't1', queuedAt: 10_000 - 500 })).toEqual({ resumable: true })
    await vi.advanceTimersByTimeAsync(299)
    expect((await s.get('t1')).status).toBe('queued')
    await vi.advanceTimersByTimeAsync(1)
    expect((await s.get('t1')).status).toBe('running')
    await vi.advanceTimersByTimeAsync(2500)
    expect((await s.get('t1')).status).toBe('succeeded')
    const old = await s.resume({ ...base, idempotencyKey: 'x', taskId: 't2', queuedAt: 10_000 - 3300 - 10_001 })
    expect(old.resumable).toBe(false)
  })
})
