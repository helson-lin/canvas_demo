// Tiny toast bus so non-React code (services) can notify. UI rendering: src/ui/Toaster.tsx.
export type ToastKind = 'info' | 'success' | 'error'
export interface ToastMessage {
  id: number
  kind: ToastKind
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

type Listener = (t: ToastMessage) => void
const listeners = new Set<Listener>()
let seq = 0

export function toast(
  title: string,
  opts: { kind?: ToastKind; description?: string; action?: ToastMessage['action'] } = {},
): void {
  const msg: ToastMessage = { id: ++seq, kind: opts.kind ?? 'info', title, description: opts.description, action: opts.action }
  listeners.forEach((l) => l(msg))
}

export function subscribeToasts(l: Listener): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}
