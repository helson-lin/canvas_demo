import { useEffect } from 'react'
import { Canvas } from '@/canvas/Canvas'
import { gcBlobs } from '@/services/assetStore'
import { clearHistory } from '@/store/history'
import { initPersistence } from '@/persistence/persist'
import { useCanvasStore } from '@/store/canvasStore'
import { CanvasHint } from '@/ui/CanvasHint'
import { ConfirmDialog } from '@/ui/ConfirmDialog'
import { DevPanel } from '@/ui/DevPanel'
import { SaveIndicator } from '@/ui/SaveIndicator'
import { Toaster } from '@/ui/Toaster'
import { Toolbar } from '@/ui/Toolbar'
import { ZoomControls } from '@/ui/ZoomControls'

export default function App() {
  const hydrated = useCanvasStore((s) => s.ui.hydrated)

  useEffect(() => {
    void initPersistence().then(() => {
      clearHistory()
      // Reclaim blobs no asset references (e.g. a result dropped mid-write) once the canvas is idle.
      const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 2000))
      idle(() => void gcBlobs().catch(() => undefined))
    })
  }, [])

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-background text-foreground">
      {hydrated ? (
        <>
          <Canvas />
          <CanvasHint />
          <Toolbar />
          <SaveIndicator />
          <ZoomControls />
          <DevPanel />
        </>
      ) : (
        <div className="grid h-full place-items-center text-sm text-muted-foreground">加载画布…</div>
      )}
      <Toaster />
      <ConfirmDialog />
    </div>
  )
}
