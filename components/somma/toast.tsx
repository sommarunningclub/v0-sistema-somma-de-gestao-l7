'use client'

/**
 * Feedback transitório do painel.
 *
 * Antes o sistema usava `alert()` nativo (23 chamadas) e modais de sucesso
 * artesanais. Aqui há um único canal, com posição adaptada ao dispositivo:
 * topo no mobile (fora do alcance do polegar e do teclado virtual), canto
 * inferior direito no desktop.
 */

import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner'
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { useIsMobile } from '@/components/ui/use-mobile'

export function Toaster() {
  const isMobile = useIsMobile()

  return (
    <SonnerToaster
      position={isMobile ? 'top-center' : 'bottom-right'}
      offset={isMobile ? 12 : 24}
      duration={4500}
      gap={8}
      visibleToasts={4}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            'group pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-line bg-surface-raised/95 p-3.5 shadow-overlay backdrop-blur-md',
          title: 'text-sm font-semibold text-ink-strong leading-snug',
          description: 'text-meta text-ink-muted leading-snug mt-0.5',
          actionButton:
            'ml-auto shrink-0 rounded-lg bg-brand px-2.5 py-1.5 text-xs font-semibold text-white',
          cancelButton:
            'ml-auto shrink-0 rounded-lg bg-surface-hover px-2.5 py-1.5 text-xs font-semibold text-ink',
          closeButton: 'text-ink-muted',
        },
      }}
      icons={{
        success: <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-success" />,
        error: <XCircle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-danger" />,
        warning: <AlertTriangle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-warning" />,
        info: <Info className="mt-0.5 h-[18px] w-[18px] shrink-0 text-info" />,
      }}
    />
  )
}

type NotifyOptions = {
  description?: string
  action?: { label: string; onClick: () => void }
}

/** Canal único de feedback. Substitui `alert()` em todo o painel. */
export const notify = {
  success: (message: string, options?: NotifyOptions) =>
    sonnerToast.success(message, options),
  error: (message: string, options?: NotifyOptions) =>
    sonnerToast.error(message, options),
  warning: (message: string, options?: NotifyOptions) =>
    sonnerToast.warning(message, options),
  info: (message: string, options?: NotifyOptions) =>
    sonnerToast.info(message, options),
  loading: (message: string) => sonnerToast.loading(message),
  dismiss: (id?: string | number) => sonnerToast.dismiss(id),
  /** Envolve uma promise e reporta as três fases de uma vez. */
  promise: <T,>(
    promise: Promise<T>,
    messages: { loading: string; success: string | ((data: T) => string); error: string | ((err: unknown) => string) },
  ) => sonnerToast.promise(promise, messages),
}
