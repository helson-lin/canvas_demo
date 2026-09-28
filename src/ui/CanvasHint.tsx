// Makes the canvas gestures discoverable (需求：平移方式须清晰可发现). Empty canvas: a start card.
// With content: one quiet line of gestures at the bottom edge.
import { LayoutTemplate } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/motion/button/base'
import { useCanvasStore } from '@/store/canvasStore'
import { loadSample } from '@/ui/canvasActions'

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-background px-1 py-px font-sans text-[11px] font-medium text-foreground">
      {children}
    </kbd>
  )
}

const GESTURES: { keys: ReactNode; label: string }[] = [
  { keys: <Key>拖动空白</Key>, label: '平移' },
  {
    keys: (
      <>
        <Key>Ctrl/⌘</Key>+<Key>滚轮</Key>
      </>
    ),
    label: '缩放',
  },
  { keys: <Key>拖动圆点</Key>, label: '连线' },
  { keys: <Key>Delete</Key>, label: '删除' },
]

export function CanvasHint() {
  const empty = useCanvasStore((s) => Object.keys(s.doc.nodes).length === 0)

  if (empty) {
    return (
      <div className="pointer-events-none absolute inset-0 z-[5] grid place-items-center">
        <div className="pointer-events-auto flex max-w-md flex-col items-center gap-4 text-center" data-no-drag>
          <div>
            <h2 className="text-base font-semibold text-foreground">从一张空白画布开始</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              用顶部工具栏新建图片、提示词和生成节点，把图片与提示词连到生成节点后点击「生成」。
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={loadSample}>
            <LayoutTemplate className="size-4" aria-hidden />
            载入示例
          </Button>
          <GestureList />
        </div>
      </div>
    )
  }

  return (
    <div className="pointer-events-none absolute bottom-3 left-1/2 z-[5] hidden -translate-x-1/2 md:block">
      <div className="rounded-full border border-border bg-card/90 px-3 py-1.5 shadow-sm backdrop-blur-sm">
        <GestureList />
      </div>
    </div>
  )
}

function GestureList() {
  return (
    <ul className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label="画布操作">
      {GESTURES.map((g) => (
        <li key={g.label} className="flex items-center gap-1">
          {g.keys}
          <span>{g.label}</span>
        </li>
      ))}
    </ul>
  )
}
