import { useEffect } from 'react'
import { AnimatedToastStack, useAnimatedToastStack } from '@/components/motion/animated-toast-stack'
import { subscribeToasts } from './toast'

export function Toaster() {
  const { toasts, showToast, dismissToast } = useAnimatedToastStack({ limit: 4 })
  useEffect(
    () =>
      subscribeToasts((t) =>
        showToast({ title: t.title, description: t.description, status: t.kind === 'info' ? 'info' : t.kind }),
      ),
    [showToast],
  )
  return <AnimatedToastStack toasts={toasts} onDismiss={dismissToast} position="bottom-center" placement="fixed" />
}
