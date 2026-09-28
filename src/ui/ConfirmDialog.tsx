// Renders the pending confirm() request with beUI CenterMorphModal.
import { useEffect, useRef } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/motion/button/base'
import { CenterMorphModal, CenterMorphModalContent } from '@/components/motion/center-morph-modal'
import { settleConfirm, usePendingConfirm } from './confirm'

export function ConfirmDialog() {
  const req = usePendingConfirm()
  const cancelRef = useRef<HTMLButtonElement>(null)

  // The safe choice gets focus, so Enter never deletes by accident.
  useEffect(() => {
    if (!req) return
    const t = setTimeout(() => cancelRef.current?.focus(), 60)
    return () => clearTimeout(t)
  }, [req])

  return (
    <CenterMorphModal open={!!req} onOpenChange={(open) => !open && settleConfirm(false)}>
      <CenterMorphModalContent
        ariaLabel={req?.title ?? '确认'}
        ariaDescribedBy="confirm-dialog-description"
        showCloseButton={false}
        className="max-w-[22rem]"
      >
        {req && (
          <div className="flex flex-col gap-5 p-6" data-no-drag data-testid="confirm-dialog">
            <div className="flex gap-3">
              {req.destructive && (
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
                  <TriangleAlert className="size-4" aria-hidden />
                </span>
              )}
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-foreground">{req.title}</h2>
                {req.description && (
                  <p id="confirm-dialog-description" className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {req.description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button ref={cancelRef} size="sm" variant="ghost" onClick={() => settleConfirm(false)}>
                {req.cancelLabel ?? '取消'}
              </Button>
              <Button
                size="sm"
                className={req.destructive ? 'bg-destructive text-white hover:bg-destructive/90' : undefined}
                onClick={() => settleConfirm(true)}
              >
                {req.confirmLabel ?? '确认'}
              </Button>
            </div>
          </div>
        )}
      </CenterMorphModalContent>
    </CenterMorphModal>
  )
}
