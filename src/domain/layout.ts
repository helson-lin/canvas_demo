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
// Node header + body padding + ImageGeneration status block + retry button.
const RESULT_NODE_CHROME = 37 + 24 + 108

/** Result placeholders reserve the output's aspect ratio so ImageGeneration never shifts layout. */
export function resultNodeSize(aspectRatio: AspectRatio): Size {
  const [w, h] = aspectRatio.split(':').map(Number)
  const mediaW = RESULT_NODE_WIDTH - 24
  return { w: RESULT_NODE_WIDTH, h: Math.round(RESULT_NODE_CHROME + (mediaW * h) / w) }
}
