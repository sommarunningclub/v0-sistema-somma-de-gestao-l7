'use client'

import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ErrorBannerProps {
  message: string
  onRetry?: () => void
  className?: string
}

/**
 * Aviso de falha em linha. Usa o tom `danger` do design system e anuncia-se
 * imediatamente (`role="alert"`), porque quase sempre aparece depois de uma
 * ação do usuário que não deu certo.
 */
export function ErrorBanner({ message, onRetry, className = '' }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-danger-border bg-danger-soft p-3',
        'sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2">
        <AlertCircle className="mt-px h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
        <p className="min-w-0 text-sm leading-snug text-danger">{message}</p>
      </div>
      {onRetry && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={onRetry}
          className="shrink-0 self-start sm:self-auto"
        >
          <RefreshCw aria-hidden="true" />
          Tentar novamente
        </Button>
      )}
    </div>
  )
}
