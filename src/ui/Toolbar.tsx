// OWNER: C1 — create nodes at viewport center and load the sample graph.
import { ImagePlus, LayoutTemplate, Type, Workflow } from 'lucide-react'
import { screenToWorld } from '@/canvas/coords'
import { Dock, DockItem, DockSeparator } from '@/components/motion/dock'
import { Tooltip } from '@/components/motion/tooltip'
import { DEFAULT_NODE_SIZE, newId, SAMPLE_IMAGES, type NodeType, type Vec2, type Viewport } from '@/domain'
import { persistence } from '@/persistence/persist'
import { useCanvasStore } from '@/store/canvasStore'
import { toast } from '@/ui/toast'

let lastViewport: Viewport | null = null
let creationCount = 0

function viewportCenter(viewport: Viewport): Vec2 {
  return screenToWorld({ x: window.innerWidth / 2, y: window.innerHeight / 2 }, viewport)
}

function nextNodePosition(type: NodeType, viewport: Viewport): Vec2 {
  if (
    !lastViewport ||
    lastViewport.x !== viewport.x ||
    lastViewport.y !== viewport.y ||
    lastViewport.zoom !== viewport.zoom
  ) {
    creationCount = 0
    lastViewport = { ...viewport }
  }

  const offset = (creationCount * 24) / viewport.zoom
  creationCount += 1
  const center = viewportCenter(viewport)
  const size = DEFAULT_NODE_SIZE[type]
  return { x: center.x - size.w / 2 + offset, y: center.y - size.h / 2 + offset }
}

function saveDocument(): void {
  void persistence.saveNow().catch(() => toast('保存失败，请重试', { kind: 'error' }))
}

function createNode(type: NodeType): void {
  const store = useCanvasStore.getState()
  const id = store.addNode(type, nextNodePosition(type, store.doc.viewport))
  store.select({ nodeIds: [id] })
  saveDocument()
}

function loadSample(): void {
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

export function Toolbar() {
  return (
    <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2" role="toolbar" aria-label="画布工具栏">
      <Dock>
        <span className="self-center px-1 text-xs font-medium text-muted-foreground">新建</span>
        <Tooltip content="新建图片节点" side="bottom">
          <DockItem onClick={() => createNode('image')} aria-label="新建图片节点">
            <ImagePlus aria-hidden="true" size={20} />
          </DockItem>
        </Tooltip>
        <Tooltip content="新建提示词节点" side="bottom">
          <DockItem onClick={() => createNode('prompt')} aria-label="新建提示词节点">
            <Type aria-hidden="true" size={20} />
          </DockItem>
        </Tooltip>
        <Tooltip content="新建生成节点" side="bottom">
          <DockItem onClick={() => createNode('generator')} aria-label="新建生成节点">
            <Workflow aria-hidden="true" size={20} />
          </DockItem>
        </Tooltip>
        <DockSeparator />
        <Tooltip content="载入示例" side="bottom">
          <DockItem onClick={loadSample} aria-label="载入示例">
            <LayoutTemplate aria-hidden="true" size={20} />
          </DockItem>
        </Tooltip>
      </Dock>
    </div>
  )
}
