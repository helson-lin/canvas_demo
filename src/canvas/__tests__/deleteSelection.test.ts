import { beforeEach, describe, expect, it } from 'vitest'
import { deleteSelection } from '@/canvas/usePanZoom'
import { createEmptyDocument } from '@/domain'
import { useCanvasStore } from '@/store/canvasStore'
import { isConfirmOpen, settleConfirm } from '@/ui/confirm'

const s = () => useCanvasStore.getState()

function graph() {
  const img = s().addNode('image', { x: 0, y: 0 })
  const gen = s().addNode('generator', { x: 400, y: 0 })
  const edge = s().addEdge(img, gen)!
  return { img, gen, edge }
}

beforeEach(() => {
  settleConfirm(false)
  s().replaceDoc(createEmptyDocument())
})

describe('deleteSelection', () => {
  it('asks before deleting nodes and keeps everything on cancel', async () => {
    const { img } = graph()
    const result = deleteSelection([img], [])
    expect(isConfirmOpen()).toBe(true)
    expect(s().doc.nodes[img]).toBeDefined()
    settleConfirm(false)
    expect(await result).toBe(false)
    expect(s().doc.nodes[img]).toBeDefined()
    expect(Object.keys(s().doc.edges)).toHaveLength(1)
  })

  it('deletes nodes and their edges after confirmation', async () => {
    const { img } = graph()
    const result = deleteSelection([img], [])
    settleConfirm(true)
    expect(await result).toBe(true)
    expect(s().doc.nodes[img]).toBeUndefined()
    expect(Object.keys(s().doc.edges)).toHaveLength(0)
  })

  it('deletes edges alone without asking', async () => {
    const { edge } = graph()
    expect(await deleteSelection([], [edge])).toBe(true)
    expect(isConfirmOpen()).toBe(false)
    expect(s().doc.edges[edge]).toBeUndefined()
  })
})
