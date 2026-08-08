import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Superfícies. A profundidade do painel alterna entre dois valores:
 * `Panel` sobe (surface-raised) e `Well` afunda (surface-sunken). A separação
 * estrutural é sempre uma borda de 1px, nunca sombra — sombra fica reservada
 * a elementos que realmente flutuam (modais, sheets, popovers).
 */

export const Panel = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { inset?: boolean }
>(({ className, inset = false, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      'rounded-md border border-line bg-surface-raised',
      inset && 'p-4 sm:p-5',
      className,
    )}
    {...props}
  />
))
Panel.displayName = 'Panel'

export const Well = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('rounded border border-line bg-surface-sunken', className)}
    {...props}
  />
))
Well.displayName = 'Well'

/** Cabeçalho interno de card/painel. */
export function PanelHeader({
  title,
  description,
  icon: Icon,
  actions,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  icon?: React.ElementType
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        // Hairline laranja no topo do painel: marca o bloco sem pintar fundo.
        'flex items-start justify-between gap-3 border-b border-line bg-brand-softer px-4 py-3 sm:px-5 sm:py-4',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {Icon ? (
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
        ) : null}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-ink-strong">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-meta text-ink-muted">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}

/**
 * Rótulo de seção — a assinatura tipográfica do painel.
 * Renderiza um heading real para manter a hierarquia acessível.
 */
export function SectionTitle({
  eyebrow,
  title,
  meta,
  as: Heading = 'h2',
  className,
}: {
  eyebrow?: React.ReactNode
  title: React.ReactNode
  meta?: React.ReactNode
  as?: 'h2' | 'h3' | 'h4'
  className?: string
}) {
  return (
    <div className={cn('mb-3', className)}>
      {eyebrow ? <div className="mb-1 ds-eyebrow text-brand">{eyebrow}</div> : null}
      <div className="flex items-baseline justify-between gap-3">
        <Heading className="ds-accent-bar text-[0.9375rem] font-semibold tracking-tight text-ink-strong">
          {title}
        </Heading>
        {meta ? <div className="shrink-0 text-meta text-ink-muted">{meta}</div> : null}
      </div>
    </div>
  )
}

/** Divisor vertical de 1px usado entre grupos na topbar/toolbars. */
export function VDivider({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('h-5 w-px shrink-0 bg-line', className)} />
}
