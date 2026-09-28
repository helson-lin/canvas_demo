// Node-creation actions shared by the toolbar and the empty-canvas start card.
import { screenToWorld } from '@/canvas/coords'
import { DEFAULT_NODE_SIZE, findFreePosition, newId, SAMPLE_IMAGES, type NodeType, type Vec2, type Viewport } from '@/domain'
import { persistence } from '@/persistence/persist'
import { useCanvasStore } from '@/store/canvasStore'
import { toast } from '@/ui/toast'

function viewportCenter(viewport: Viewport): Vec2 {
  return screenToWorld({ x: window.innerWidth / 2, y: window.innerHeight / 2 }, viewport)
}

/** Centred in the viewport, then nudged diagonally until it doesn't overlap an existing node. */
function nextNodePosition(type: NodeType): Vec2 {
  const { doc } = useCanvasStore.getState()
  const center = viewportCenter(doc.viewport)
  const size = DEFAULT_NODE_SIZE[type]
  return findFreePosition(Object.values(doc.nodes), { x: center.x - size.w / 2, y: center.y - size.h / 2 }, size, {
    x: 24,
    y: 24,
  })
}

function saveDocument(): void {
  void persistence.saveNow().catch(() => toast('保存失败，请重试', { kind: 'error' }))
}

export function createNode(type: NodeType): void {
  const store = useCanvasStore.getState()
  const id = store.addNode(type, nextNodePosition(type))
  store.select({ nodeIds: [id] })
  saveDocument()
}

export function loadSample(): void {
  const store = useCanvasStore.getState()
  const center = viewportCenter(store.doc.viewport)
  const image = SAMPLE_IMAGES[0]
  const assetId = newId('asset')

  store.upsertAsset({
    id: assetId,
    kind: 'sample',
    src: { type: 'url', url: image.url },
    width: image.width,
    height: image.height,
    createdAt: Date.now(),
  })

  const left = center.x - 304
  const top = center.y - 222
  const imageId = store.addNode('image', { x: left, y: top }, { sample: true, data: { assetId } })
  const promptId = store.addNode(
    'prompt',
    { x: left, y: top + DEFAULT_NODE_SIZE.image.h + 24 },
    { sample: true, data: { text: '一只戴墨镜的柴犬，赛博朋克风' } },
  )
  const generatorId = store.addNode(
    'generator',
    { x: left + DEFAULT_NODE_SIZE.prompt.w + 48, y: center.y - DEFAULT_NODE_SIZE.generator.h / 2 },
    { sample: true },
  )
  store.addEdge(imageId, generatorId)
  store.addEdge(promptId, generatorId)
  store.select({ nodeIds: [generatorId] })
  saveDocument()
  toast('已载入示例数据', { kind: 'success' })
}
