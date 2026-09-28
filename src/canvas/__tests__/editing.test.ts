import { beforeEach, describe, expect, it } from 'vitest'
import { copySelection, duplicateSelection, nudgeSelection, pasteClipboard, resetClipboardForTests, selectAll } from '@/canvas/editing'
import { nodesInRect, rectFromPoints } from '@/canvas/marquee'
import { createEmptyDocument } from '@/domain'
import { useCanvasStore } from '@/store/canvasStore'
import { clearHistory, undo } from '@/store/history'

const s = () => useCanvasStore.getState()

beforeEach(() => {
  s().replaceDoc(createEmptyDocument())
  clearHistory()
  resetClipboardForTests()
})

describe('editing commands', () => {
  it('copy + repeated paste lands each copy one step further and is undoable', () => {
    const a = s().addNode('prompt', { x: 0, y: 0 })
    s().select({ nodeIds: [a] })
    expect(copySelection()).toBe(true)
    const [p1] = pasteClipboard()
    const [p2] = pasteClipboard()
    expect(s().doc.nodes[p1!]?.position).toEqual({ x: 32, y: 32 })
    expect(s().doc.nodes[p2!]?.position).toEqual({ x: 64, y: 64 })
    expect(s().ui.selection.nodeIds).toEqual([p2])
    undo()
    expect(s().doc.nodes[p2!]).toBeUndefined()
    expect(s().doc.nodes[p1!]).toBeDefined()
  })

  it('duplicate keeps the input edge between duplicated nodes', () => {
    const img = s().addNode('image', { x: 0, y: 0 })
    const gen = s().addNode('generator', { x: 300, y: 0 })
    s().addEdge(img, gen)
    s().select({ nodeIds: [img, gen] })
    const ids = duplicateSelection()
    expect(ids).toHaveLength(2)
    expect(Object.values(s().doc.edges).filter((e) => ids.includes(e.source) && ids.includes(e.target))).toHaveLength(1)
  })

  it('select all, then a burst of nudges undoes as one step', () => {
    const a = s().addNode('prompt', { x: 0, y: 0 })
    const b = s().addNode('prompt', { x: 100, y: 0 })
    selectAll()
    expect([...s().ui.selection.nodeIds].sort()).toEqual([a, b].sort())
    nudgeSelection(1, 0)
    nudgeSelection(10, 0)
    expect(s().doc.nodes[a]?.position).toEqual({ x: 11, y: 0 })
    undo()
    expect(s().doc.nodes[a]?.position).toEqual({ x: 0, y: 0 })
    expect(s().doc.nodes[b]?.position).toEqual({ x: 100, y: 0 })
  })
})

describe('box selection hit test', () => {
  it('normalises the drag rectangle and selects intersecting nodes', () => {
    expect(rectFromPoints({ x: 50, y: 40 }, { x: 10, y: 0 })).toEqual({ x: 10, y: 0, w: 40, h: 40 })
    const inside = s().addNode('prompt', { x: 0, y: 0 })
    s().addNode('prompt', { x: 1000, y: 1000 })
    expect(nodesInRect(Object.values(s().doc.nodes), { x: -10, y: -10, w: 50, h: 50 })).toEqual([inside])
  })
})
