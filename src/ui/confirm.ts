// Promise-based confirmation so non-React code (canvas keyboard handlers) can ask before destructive actions.
import { useSyncExternalStore } from 'react'

export interface ConfirmRequest {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

interface Pending extends ConfirmRequest {
  id: number
  resolve: (ok: boolean) => void
}

let pending: Pending | null = null
let seq = 0
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/** Resolves true on confirm, false on cancel/dismiss. A new request cancels any open one. */
export function confirm(req: ConfirmRequest): Promise<boolean> {
  pending?.resolve(false)
  return new Promise((resolve) => {
    pending = { ...req, id: ++seq, resolve }
    emit()
  })
}

export function settleConfirm(ok: boolean): void {
  const p = pending
  if (!p) return
  pending = null
  emit()
  p.resolve(ok)
}

export function isConfirmOpen(): boolean {
  return pending !== null
}

export function usePendingConfirm(): Pending | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => pending,
  )
}
