import type { AspectRatio, CanvasNode, Vec2 } from './types'

export interface Size {
  w: number
  h: number
}

const GAP = 16
const MAX_TRIES = 200

function overlaps(pos: Vec2, size: Size, n: CanvasNode): boolean {
  return (
    pos.x < n.position.x + n.size.w + GAP &&
    pos.x + size.w + GAP > n.position.x &&
    pos.y < n.position.y + n.size.h + GAP &&
    pos.y + size.h + GAP > n.position.y
  )
}

/** First position along `step` from `desired` where a node of `size` doesn't overlap any existing node. */
export function findFreePosition(nodes: CanvasNode[], desired: Vec2, size: Size, step: Vec2): Vec2 {
  for (let i = 0; i < MAX_TRIES; i++) {
    const pos = { x: desired.x + step.x * i, y: desired.y + step.y * i }
    if (!nodes.some((n) => overlaps(pos, size, n))) return pos
  }
  return desired
}

const RESULT_NODE_WIDTH = 240
const RESULT_BODY_INSET = 6
// Node header + inset around the media + one caption row (status / prompt / retry).
const RESULT_NODE_CHROME = 37 + RESULT_BODY_INSET * 2 + 52

/** Result nodes are image-first: the media spans the card width at the output's aspect ratio. */
export function resultNodeSize(aspectRatio: AspectRatio): Size {
  const [w, h] = aspectRatio.split(':').map(Number)
  const mediaW = RESULT_NODE_WIDTH - 2 - RESULT_BODY_INSET * 2
  return { w: RESULT_NODE_WIDTH, h: Math.round(RESULT_NODE_CHROME + (mediaW * h) / w) }
}

export const RESULT_GRID_COLUMNS = 3
export const RESULT_GRID_GAP = 24

/**
 * Next free cell in a row-major grid to the right of the generator, top-aligned with it, so a generator's
 * results read as a set beside it instead of a column that runs off-screen.
 */
export function findResultSlot(
  nodes: CanvasNode[],
  generator: { position: Vec2; size: Size },
  size: Size,
  offsetX: number,
): Vec2 {
  const origin = { x: generator.position.x + generator.size.w + offsetX, y: generator.position.y }
  for (let i = 0; i < MAX_TRIES; i++) {
    const col = i % RESULT_GRID_COLUMNS
    const row = Math.floor(i / RESULT_GRID_COLUMNS)
    const pos = { x: origin.x + col * (size.w + RESULT_GRID_GAP), y: origin.y + row * (size.h + RESULT_GRID_GAP) }
    if (!nodes.some((n) => overlaps(pos, size, n))) return pos
  }
  return origin
}
