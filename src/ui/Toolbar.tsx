// OWNER: C1 — create nodes at viewport center and load the sample graph.
import { ImagePlus, LayoutTemplate, Type, Workflow } from 'lucide-react'
import { Dock, DockItem, DockSeparator } from '@/components/motion/dock'
import { Tooltip } from '@/components/motion/tooltip'
import { createNode, loadSample } from './canvasActions'

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
