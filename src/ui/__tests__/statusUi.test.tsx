import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain'
import { setSaveStatus } from '@/persistence/persist'
import { useCanvasStore } from '@/store/canvasStore'
import { SaveIndicator } from '@/ui/SaveIndicator'
import { ZoomControls } from '@/ui/ZoomControls'

beforeEach(() => {
  useCanvasStore.getState().replaceDoc(createEmptyDocument())
  act(() => setSaveStatus({ status: 'idle' }))
})

describe('SaveIndicator', () => {
  it('renders nothing when idle and the right text for each status', () => {
    const { container } = render(<SaveIndicator />)
    expect(container.textContent).toBe('')
    act(() => setSaveStatus({ status: 'saving' }))
    expect(screen.getByText('保存中…')).toBeTruthy()
    act(() => setSaveStatus({ status: 'saved', savedAt: Date.now() }))
    expect(screen.getByText(/已保存/)).toBeTruthy()
    act(() => setSaveStatus({ status: 'error', error: 'quota' }))
    expect(screen.getByText('保存失败：quota')).toBeTruthy()
  })
})

describe('ZoomControls', () => {
  it('shows the zoom percentage and zooms by 1.2 around the centre', () => {
    render(<ZoomControls />)
    expect(screen.getByTestId('zoom-percent').textContent).toBe('100%')
    fireEvent.click(screen.getByLabelText('放大'))
    expect(useCanvasStore.getState().doc.viewport.zoom).toBeCloseTo(1.2)
    expect(screen.getByTestId('zoom-percent').textContent).toBe('120%')
    fireEvent.click(screen.getByLabelText('重置为 100%'))
    expect(useCanvasStore.getState().doc.viewport.zoom).toBeCloseTo(1)
  })

  it('fit-all centres existing nodes', () => {
    useCanvasStore.getState().addNode('prompt', { x: 5000, y: 5000 })
    render(<ZoomControls />)
    fireEvent.click(screen.getByLabelText('适配全部'))
    const vp = useCanvasStore.getState().doc.viewport
    expect(vp.x).toBeLessThan(0)
    expect(vp.y).toBeLessThan(0)
  })
})
