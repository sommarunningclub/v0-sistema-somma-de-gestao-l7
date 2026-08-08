import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Esqueletos de carregamento.
 *
 * Preferimos esqueletos a spinners nas listagens: eles preservam o layout,
 * evitam o "salto" de conteúdo quando os dados chegam e dão uma percepção de
 * velocidade melhor. Todos são `aria-hidden` — o anúncio para leitores de tela
 * fica a cargo do container com `aria-busy`.
 */

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('ds-skeleton', className)} />
}

export function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-xl border border-line">
      <div className="flex gap-4 border-b border-line bg-surface-sunken px-4 py-3">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-line-soft px-4 py-3.5 last:border-b-0">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton key={c} className={cn('h-3.5 flex-1', c === 0 && 'max-w-[40%]')} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-line bg-surface-raised p-4">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="mt-3 h-3 w-3/5" />
          <Skeleton className="mt-2 h-3 w-1/3" />
        </div>
      ))}
    </div>
  )
}

export function StatGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-line bg-surface-raised p-4">
          <Skeleton className="h-2.5 w-20" />
          <Skeleton className="mt-3.5 h-7 w-24" />
          <Skeleton className="mt-2 h-2.5 w-16" />
        </div>
      ))}
    </div>
  )
}
