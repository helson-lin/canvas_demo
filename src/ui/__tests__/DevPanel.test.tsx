import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyDocument, type Task } from '@/domain'
import { getMockConfig, setMockConfig } from '@/services/mockConfig'
import { useCanvasStore } from '@/store/canvasStore'
import { DevPanel } from '@/ui/DevPanel'

function task(id: string, createdAt: number, extra: Partial<Task> = {}): Task {
  return {
    id, generatorNodeId: 'node_gen000', inputSnapshot: { imageAssetIds: [], prompts: ['p'] },
    params: { aspectRatio: '1:1' }, status: 'succeeded', attempt: 1, idempotencyKey: `k_${id}`,
    queuedAt: createdAt, expectedDurationMs: 1000, createdAt, updatedAt: createdAt, ...extra,
  }
}

beforeEach(() => {
  useCanvasStore.getState().replaceDoc(createEmptyDocument())
  setMockConfig({ failNext: false, failAll: false, queueMs: 800, runMs: 2500 })
})

describe('DevPanel', () => {
  it('toggles mock failure switches and clamps durations', () => {
    render(<DevPanel />)
    fireEvent.click(screen.getByText('Mock 控制台'))
    fireEvent.click(screen.getByRole('switch', { name: '下一次任务失败' }))
    expect(getMockConfig().failNext).toBe(true)
    fireEvent.click(screen.getByRole('switch', { name: '所有任务失败' }))
    expect(getMockConfig().failAll).toBe(true)
    fireEvent.change(screen.getByLabelText('生成时长'), { target: { value: '99999' } })
    expect(getMockConfig().runMs).toBe(10000)
  })

  it('lists tasks newest first with errors', () => {
    const doc = createEmptyDocument()
    doc.tasks.task_old001 = task('task_old001', 1)
    doc.tasks.task_new002 = task('task_new002', 2, {
      status: 'failed',
      attempt: 2,
      error: { code: 'MOCK_FORCED_FAILURE', message: 'Mock 强制失败' },
    })
    useCanvasStore.getState().replaceDoc(doc)
    render(<DevPanel />)
    fireEvent.click(screen.getByText('Mock 控制台'))
    const rows = screen.getAllByTestId('task-row')
    expect(within(rows[0]).getByText('new002')).toBeTruthy()
    expect(within(rows[0]).getByText('Mock 强制失败')).toBeTruthy()
    expect(within(rows[1]).getByText('old001')).toBeTruthy()
  })
})
