import { useEffect } from 'react'
import { Canvas } from '@/canvas/Canvas'
import { initPersistence } from '@/persistence/persist'
import { useCanvasStore } from '@/store/canvasStore'
import { DevPanel } from '@/ui/DevPanel'
import { SaveIndicator } from '@/ui/SaveIndicator'
import { Toaster } from '@/ui/Toaster'
import { Toolbar } from '@/ui/Toolbar'

export default function App() {
  const hydrated = useCanvasStore((s) => s.ui.hydrated)

  useEffect(() => {
    void initPersistence()
  }, [])

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background text-foreground">
      {hydrated ? (
        <>
          <Canvas />
          <Toolbar />
          <SaveIndicator />
          <DevPanel />
        </>
      ) : (
        <div className="grid h-full place-items-center text-sm text-muted-foreground">加载画布…</div>
      )}
      <Toaster />
    </div>
  )
}
