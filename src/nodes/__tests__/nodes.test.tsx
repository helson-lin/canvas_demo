import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createEmptyDocument,
  type CanvasDocument,
  type GeneratorNode as GenModel,
  type ImageNode as ImgModel,
  type Task,
  type TaskStatus,
} from '@/domain'
import { useCanvasStore } from '@/store/canvasStore'
import { GeneratorNode } from '../GeneratorNode'
import { ImageNode } from '../ImageNode'

// jsdom lacks ResizeObserver (used by beUI Tabs).
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

vi.mock('@/services/taskRunner', () => ({
  startGeneration: vi.fn(),
  retryTask: vi.fn(),
  cancelTask: vi.fn(),
  resumeTasks: vi.fn(),
}))
const toastMock = vi.hoisted(() => vi.fn())
vi.mock('@/ui/toast', () => ({ toast: toastMock }))

import { retryTask, startGeneration } from '@/services/taskRunner'

function makeTask(id: string, generatorNodeId: string, status: TaskStatus, extra: Partial<Task> = {}): Task {
  return {
    id,
    generatorNodeId,
    inputSnapshot: { imageAssetIds: [], prompts: [] },
    params: { aspectRatio: '1:1' },
    status,
    attempt: 1,
    idempotencyKey: id,
    queuedAt: 0,
    expectedDurationMs: 1000,
    createdAt: 0,
    updatedAt: 0,
    ...extra,
  }
}

const base = { position: { x: 0, y: 0 }, size: { w: 200, h: 200 }, createdAt: 0 }

function renderGen() {
  const node = useCanvasStore.getState().doc.nodes.gen as GenModel
  return render(<GeneratorNode node={node} />)
}

function renderImage(doc: CanvasDocument) {
  useCanvasStore.getState().replaceDoc(doc)
  return render(<ImageNode node={doc.nodes.img as ImgModel} />)
}

beforeEach(() => {
  vi.clearAllMocks()
  const doc = createEmptyDocument()
  doc.assets.a1 = { id: 'a1', kind: 'sample', src: { type: 'url', url: '/samples/square.svg' }, createdAt: 0 }
  doc.nodes.img = { ...base, id: 'img', type: 'image', data: { assetId: 'a1' } }
  doc.nodes.p = { ...base, id: 'p', type: 'prompt', data: { text: '一只猫' } }
  doc.nodes.gen = { ...base, id: 'gen', type: 'generator', data: { params: { aspectRatio: '1:1' }, activeTaskId: null } }
  useCanvasStore.getState().replaceDoc(doc)
})
afterEach(cleanup)

describe('GeneratorNode', () => {
  it('shows 1 image and 1 prompt after connecting two input edges', () => {
    renderGen()
    expect(screen.getByText('未连接图片')).toBeTruthy()
    act(() => {
      useCanvasStore.getState().addEdge('img', 'gen')
      useCanvasStore.getState().addEdge('p', 'gen')
    })
    expect(screen.getByText('参考图片（1）')).toBeTruthy()
    expect(screen.getByText('提示词（1）')).toBeTruthy()
    expect(screen.getByAltText('输入图片')).toBeTruthy()
    expect(screen.getByText('一只猫')).toBeTruthy()
  })

  it('calls startGeneration when idle', () => {
    renderGen()
    fireEvent.click(screen.getByRole('button', { name: /生成/ }))
    expect(startGeneration).toHaveBeenCalledWith('gen')
  })

  it('disables the button while a task is running and toasts on click', () => {
    act(() => {
      const s = useCanvasStore.getState()
      s.upsertTask(makeTask('t1', 'gen', 'running'))
      s.updateNodeData<GenModel>('gen', { activeTaskId: 't1' })
    })
    const { container } = renderGen()
    const btn = screen.getByRole('button', { name: /生成中/ }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    fireEvent.click(container.querySelector('.cursor-not-allowed')!)
    expect(toastMock).toHaveBeenCalled()
    expect(startGeneration).not.toHaveBeenCalled()
  })

  it('shows failed task error with retry', () => {
    act(() => {
      const s = useCanvasStore.getState()
      s.upsertTask(makeTask('t1', 'gen', 'failed', { error: { code: 'X', message: '模拟失败' } }))
      s.updateNodeData<GenModel>('gen', { activeTaskId: 't1' })
    })
    renderGen()
    expect(screen.getByText('模拟失败')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /重试/ }))
    expect(retryTask).toHaveBeenCalledWith('t1')
  })
})

describe('ImageNode view states', () => {
  function docWith(data: ImgModel['data'], task?: Task): CanvasDocument {
    const doc = createEmptyDocument()
    doc.assets.a1 = { id: 'a1', kind: 'sample', src: { type: 'url', url: '/samples/square.svg' }, createdAt: 0 }
    doc.nodes.img = { ...base, id: 'img', type: 'image', sample: true, data }
    if (task) doc.tasks[task.id] = task
    return doc
  }

  it('ready renders the image and the sample tag', () => {
    renderImage(docWith({ assetId: 'a1' }))
    expect((screen.getByAltText('图片') as HTMLImageElement).src).toContain('/samples/square.svg')
    expect(screen.getByText('示例')).toBeTruthy()
  })

  it('queued / running render ImageGeneration states', () => {
    renderImage(docWith({ assetId: null, pendingTaskId: 't1' }, makeTask('t1', 'gen', 'queued')))
    expect(screen.getByTestId('image-pending').dataset.status).toBe('queued')
    expect(screen.getByText('排队中')).toBeTruthy()
    cleanup()
    renderImage(docWith({ assetId: null, pendingTaskId: 't1' }, makeTask('t1', 'gen', 'running')))
    expect(screen.getByTestId('image-pending').dataset.status).toMatch(/generating|refining/)
  })

  it('running switches from generating to refining at 70% of the expected duration', () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(10_000)
      const task = makeTask('t1', 'gen', 'running', { queuedAt: 10_000, expectedDurationMs: 1000 })
      renderImage(docWith({ assetId: null, pendingTaskId: 't1' }, task))
      expect(screen.getByTestId('image-pending').dataset.status).toBe('generating')
      act(() => {
        vi.advanceTimersByTime(700)
      })
      expect(screen.getByTestId('image-pending').dataset.status).toBe('refining')
    } finally {
      vi.useRealTimers()
    }
  })

  it('a generated result renders the completed ImageGeneration with the image', () => {
    const task = makeTask('t1', 'gen', 'succeeded', { inputSnapshot: { imageAssetIds: [], prompts: ['柴犬'] } })
    const doc = docWith({ assetId: 'gen1' }, task)
    doc.assets.gen1 = { id: 'gen1', kind: 'generated', src: { type: 'url', url: '/samples/result-square.svg' }, origin: { taskId: 't1' }, createdAt: 0 }
    renderImage(doc)
    expect(screen.getByTestId('image-result').dataset.status).toBe('complete')
    expect((screen.getByAltText('柴犬') as HTMLImageElement).src).toContain('/samples/result-square.svg')
  })

  it('cancelled result reads as cancelled, not failed, and can be retried', () => {
    renderImage(
      docWith({ assetId: null, pendingTaskId: 't1' }, makeTask('t1', 'gen', 'cancelled', { error: { code: 'CANCELLED', message: '已取消' } })),
    )
    expect(screen.getByText('已取消')).toBeTruthy()
    expect(screen.queryByText('生成失败')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /重试/ }))
    expect(retryTask).toHaveBeenCalledWith('t1')
  })

  it('failed renders error and retry', () => {
    renderImage(
      docWith({ assetId: null, pendingTaskId: 't1' }, makeTask('t1', 'gen', 'failed', { error: { code: 'E', message: '出错了' } })),
    )
    expect(screen.getByText('出错了')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /重试/ }))
    expect(retryTask).toHaveBeenCalledWith('t1')
  })

  it('missing renders placeholder; picking a sample makes it ready', () => {
    renderImage(docWith({ assetId: 'gone' }))
    expect(screen.getByText('图片缺失')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '示例 16:9' }))
    const doc = useCanvasStore.getState().doc
    const img = doc.nodes.img as ImgModel
    expect(img.data.assetId).not.toBe('gone')
    expect(doc.assets[img.data.assetId!].kind).toBe('sample')
  })
})
