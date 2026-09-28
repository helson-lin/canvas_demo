// OWNER: C1 — create nodes, load the sample graph, undo/redo, import/export workflow.
import { useRef } from 'react'
import { Download, ImagePlus, LayoutTemplate, Redo2, Type, Undo2, Upload, Workflow } from 'lucide-react'
import { Dock, DockItem, DockSeparator } from '@/components/motion/dock'
import { Tooltip } from '@/components/motion/tooltip'
import { cn } from '@/lib/utils'
import { exportWorkflow, importWorkflowFile } from '@/services/workflowIO'
import { redo, undo, useHistoryState } from '@/store/history'
import { createNode, loadSample } from './canvasActions'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = isMac ? '⌘' : 'Ctrl+'

export function Toolbar() {
  const { canUndo, canRedo } = useHistoryState()
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2" role="toolbar" aria-label="画布工具栏">
      <Dock>
        <span className="hidden self-center whitespace-nowrap px-1 text-xs font-medium text-muted-foreground lg:block">新建</span>
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
        <DockSeparator />
        <Tooltip content={`撤销（${MOD}Z）`} side="bottom">
          <DockItem onClick={() => undo()} aria-label="撤销" className={cn(!canUndo && 'pointer-events-none opacity-35')}>
            <Undo2 aria-hidden="true" size={20} />
          </DockItem>
        </Tooltip>
        <Tooltip content={`重做（${MOD}⇧Z）`} side="bottom">
          <DockItem onClick={() => redo()} aria-label="重做" className={cn(!canRedo && 'pointer-events-none opacity-35')}>
            <Redo2 aria-hidden="true" size={20} />
          </DockItem>
        </Tooltip>
        <DockSeparator />
        <Tooltip content="导入工作流 JSON" side="bottom">
          <DockItem onClick={() => fileRef.current?.click()} aria-label="导入工作流">
            <Upload aria-hidden="true" size={20} />
          </DockItem>
        </Tooltip>
        <Tooltip content="导出工作流 JSON" side="bottom">
          <DockItem onClick={() => void exportWorkflow()} aria-label="导出工作流">
            <Download aria-hidden="true" size={20} />
          </DockItem>
        </Tooltip>
      </Dock>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label="选择工作流文件"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void importWorkflowFile(file)
        }}
      />
    </div>
  )
}
