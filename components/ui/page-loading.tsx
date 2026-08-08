import { cn } from '@/lib/utils'

interface PageLoadingProps {
  label?: string
  className?: string
  fullScreen?: boolean
}

/**
 * Estado de carregamento de página. Mesmo vocabulário visual do
 * `DashboardLoading` do painel: spinner de marca sobre o canvas e um rótulo
 * discreto anunciado por leitores de tela.
 */
export function PageLoading({
  label = 'Carregando...',
  className = '',
  fullScreen = false,
}: PageLoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'flex items-center justify-center',
        fullScreen ? 'min-h-[100dvh] w-full bg-canvas' : 'h-48',
        className,
      )}
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent"
          aria-hidden="true"
        />
        <span className="text-meta text-ink-muted">{label}</span>
      </div>
    </div>
  )
}
