import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@/domain'
import { useCanvasStore } from '@/store/canvasStore'
import { CanvasHint } from '@/ui/CanvasHint'

beforeEach(() => useCanvasStore.getState().replaceDoc(createEmptyDocument()))

describe('CanvasHint', () => {
  it('empty canvas offers a start card whose 载入示例 adds the sample graph', () => {
    render(<CanvasHint />)
    expect(screen.getByText('从一张空白画布开始')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '载入示例' }))
    const doc = useCanvasStore.getState().doc
    expect(Object.keys(doc.nodes)).toHaveLength(3)
    expect(Object.keys(doc.edges)).toHaveLength(2)
  })

  it('with content, shows the gesture hints instead', () => {
    useCanvasStore.getState().addNode('prompt', { x: 0, y: 0 })
    render(<CanvasHint />)
    expect(screen.queryByText('从一张空白画布开始')).toBeNull()
    const list = screen.getByRole('list', { name: '画布操作' })
    for (const label of ['平移', '缩放', '连线', '框选', '撤销', '删除']) expect(list.textContent).toContain(label)
  })
})
