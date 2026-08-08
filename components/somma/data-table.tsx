'use client'

import * as React from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Casca de tabela do painel.
 *
 * Não é um data-grid genérico: os módulos continuam desenhando suas próprias
 * células e mantendo suas regras. O que se padroniza aqui é a moldura —
 * cabeçalho fixo, ordenação acessível, zebra sutil, seleção e o rodapé de
 * paginação — para que Membros, Parceiros, Eventos e Admin parem de ter
 * tabelas visualmente diferentes fazendo a mesma coisa.
 *
 * No celular estas tabelas não devem ser usadas: cada módulo troca para uma
 * lista de cards. `TableFrame` só rola horizontalmente como último recurso.
 */

export function TableFrame({
  children,
  className,
  busy = false,
}: {
  children: React.ReactNode
  className?: string
  busy?: boolean
}) {
  return (
    <div
      aria-busy={busy || undefined}
      className={cn('overflow-hidden rounded-md border border-line bg-surface-raised', className)}
    >
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

export function Table({
  children,
  caption,
  className,
}: {
  children: React.ReactNode
  /** Descrição da tabela para leitores de tela. */
  caption: string
  className?: string
}) {
  return (
    <table className={cn('w-full min-w-[720px] border-collapse text-left', className)}>
      <caption className="sr-only">{caption}</caption>
      {children}
    </table>
  )
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 border-b border-brand-line bg-surface-sunken">
      <tr className="border-b border-line">{children}</tr>
    </thead>
  )
}

export type SortDirection = 'asc' | 'desc' | null

export function TH({
  children,
  sortable = false,
  direction = null,
  onSort,
  align = 'left',
  width,
  className,
}: {
  children: React.ReactNode
  sortable?: boolean
  direction?: SortDirection
  onSort?: () => void
  align?: 'left' | 'right' | 'center'
  width?: string
  className?: string
}) {
  const ariaSort: React.AriaAttributes['aria-sort'] = !sortable
    ? undefined
    : direction === 'asc'
      ? 'ascending'
      : direction === 'desc'
        ? 'descending'
        : 'none'

  const Icon = direction === 'asc' ? ArrowUp : direction === 'desc' ? ArrowDown : ChevronsUpDown

  return (
    <th
      scope="col"
      aria-sort={ariaSort}
      style={width ? { width } : undefined}
      className={cn(
        'px-4 py-3 ds-eyebrow font-semibold text-brand',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
    >
      {sortable ? (
        <button
          type="button"
          onClick={onSort}
          className={cn(
            'inline-flex items-center gap-1.5 rounded transition-colors hover:text-ink-strong',
            align === 'right' && 'flex-row-reverse',
            direction && 'text-ink-strong',
          )}
        >
          {children}
          <Icon aria-hidden="true" className={cn('h-3 w-3', !direction && 'opacity-40')} />
        </button>
      ) : (
        children
      )}
    </th>
  )
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>
}

export function TR({
  children,
  selected = false,
  onClick,
  className,
}: {
  children: React.ReactNode
  selected?: boolean
  onClick?: () => void
  className?: string
}) {
  return (
    <tr
      onClick={onClick}
      aria-selected={onClick ? selected : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      className={cn(
        'border-b border-line-soft transition-colors last:border-b-0',
        onClick && 'cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-brand',
        selected ? 'bg-brand-soft shadow-inset-brand' : onClick && 'hover:bg-surface-hover',
        className,
      )}
    >
      {children}
    </tr>
  )
}

export function TD({
  children,
  align = 'left',
  className,
  ...props
}: Omit<React.TdHTMLAttributes<HTMLTableCellElement>, 'align'> & {
  children: React.ReactNode
  align?: 'left' | 'right' | 'center'
}) {
  return (
    <td
      className={cn(
        'px-4 py-3 text-sm text-ink',
        align === 'right' && 'text-right',
        align === 'center' && 'text-center',
        className,
      )}
      {...props}
    >
      {children}
    </td>
  )
}

/**
 * Rodapé de paginação. Mostra o intervalo em texto ("41–60 de 312") porque só
 * o número da página não diz ao usuário onde ele está no conjunto.
 */
export function TablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  className,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  className?: string
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  if (total <= pageSize) return null

  return (
    <nav
      aria-label="Paginação"
      className={cn(
        'flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3',
        className,
      )}
    >
      <p className="text-meta text-ink-muted" aria-live="polite">
        <span className="font-mono tabular-nums text-ink">{from}</span>–
        <span className="font-mono tabular-nums text-ink">{to}</span> de{' '}
        <span className="font-mono tabular-nums text-ink">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="ds-tap rounded-lg border border-line px-3 text-sm font-medium text-ink transition-colors hover:border-line-strong disabled:opacity-40 lg:min-h-0 lg:py-2"
        >
          Anterior
        </button>
        <span className="px-1 text-meta text-ink-muted">
          {page} / {pageCount}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          className="ds-tap rounded-lg border border-line px-3 text-sm font-medium text-ink transition-colors hover:border-line-strong disabled:opacity-40 lg:min-h-0 lg:py-2"
        >
          Próxima
        </button>
      </div>
    </nav>
  )
}

/**
 * Item de lista para o mobile — o substituto da linha de tabela.
 * Título, metadados e status, com a linha inteira sendo o alvo de toque.
 */
export function MobileRecordCard({
  title,
  subtitle,
  status,
  fields,
  actions,
  onClick,
  className,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  status?: React.ReactNode
  fields?: Array<{ label: string; value: React.ReactNode }>
  actions?: React.ReactNode
  onClick?: () => void
  className?: string
}) {
  const Root = (onClick ? 'button' : 'div') as React.ElementType

  return (
    <Root
      {...(onClick ? { type: 'button', onClick } : {})}
      className={cn(
        'w-full rounded-xl border border-line bg-surface-raised p-4 text-left transition-colors',
        onClick && 'active:bg-surface-hover',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-strong">{title}</p>
          {subtitle ? <p className="mt-0.5 truncate text-meta text-ink-muted">{subtitle}</p> : null}
        </div>
        {status ? <div className="shrink-0">{status}</div> : null}
      </div>

      {fields?.length ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
          {fields.map((field) => (
            <div key={field.label} className="min-w-0">
              <dt className="ds-eyebrow">{field.label}</dt>
              <dd className="mt-0.5 truncate text-[0.8125rem] text-ink">{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {actions ? (
        <div className="mt-3 flex items-center gap-2 border-t border-line-soft pt-3">{actions}</div>
      ) : null}
    </Root>
  )
}
