'use client'

import * as React from 'react'
import { SearchX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRegistrarAcaoDeEstadoVazio } from './primary-action'

/**
 * Estado vazio.
 *
 * Um estado vazio útil responde três coisas: o que deveria estar aqui, por que
 * não está, e qual é a próxima ação. Por isso `action` é fortemente
 * recomendado — e existe uma variante dedicada a "busca sem resultado", que é
 * um problema diferente de "ainda não há nada".
 */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
  className,
}: {
  icon?: React.ElementType
  title: string
  description?: React.ReactNode
  action?: React.ReactNode
  secondaryAction?: React.ReactNode
  compact?: boolean
  className?: string
}) {
  // Enquanto este estado vazio oferece a ação principal, o FAB se recolhe.
  useRegistrarAcaoDeEstadoVazio(Boolean(action))

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 text-center',
        // Menos ar no celular: a caixa de 14 unidades de padding sobrava
        // metade de tela vazia num iPhone.
        compact ? 'py-8' : 'py-10 lg:py-14',
        className,
      )}
    >
      {Icon ? (
        <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-surface-sunken">
          <Icon aria-hidden="true" className="h-5 w-5 text-ink-subtle" />
        </div>
      ) : null}
      <h3 className="text-sm font-semibold text-ink-strong">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-meta leading-relaxed text-ink-muted">
          {description}
        </p>
      ) : null}
      {action || secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  )
}

/** Busca sem resultado — distinta de "nada cadastrado ainda". */
export function NoResultsState({
  query,
  onClear,
  className,
}: {
  query: string
  onClear: () => void
  className?: string
}) {
  return (
    <EmptyState
      className={className}
      icon={SearchX}
      title="Nenhum resultado encontrado"
      description={
        <>
          Nada corresponde a <span className="font-medium text-ink">“{query}”</span>. Revise
          os termos ou remova os filtros aplicados.
        </>
      }
      action={
        <button
          type="button"
          onClick={onClear}
          className="ds-tap inline-flex items-center rounded-lg border border-line bg-surface-hover px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:border-line-strong hover:text-ink-strong"
        >
          Limpar busca e filtros
        </button>
      }
    />
  )
}
