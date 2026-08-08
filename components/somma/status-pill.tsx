import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Indicador de estado.
 *
 * Regra de acessibilidade do design system: status nunca é comunicado só por
 * cor. Toda pill carrega texto e, opcionalmente, um marcador de forma (`dot`),
 * de modo que a informação sobreviva a daltonismo e a impressão em tons de
 * cinza.
 */

const pillVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border font-semibold leading-none',
  {
    variants: {
      tone: {
        neutral: 'border-line bg-surface-hover text-ink',
        brand: 'border-brand-border bg-brand-soft text-brand-strong',
        success: 'border-success-border bg-success-soft text-success',
        warning: 'border-warning-border bg-warning-soft text-warning',
        danger: 'border-danger-border bg-danger-soft text-danger',
        info: 'border-info-border bg-info-soft text-info',
      },
      size: {
        sm: 'px-2 py-0.5 text-[0.6875rem]',
        md: 'px-2.5 py-1 text-xs',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'sm' },
  },
)

export type StatusTone = NonNullable<VariantProps<typeof pillVariants>['tone']>

const DOT_TONE: Record<StatusTone, string> = {
  neutral: 'bg-ink-muted',
  brand: 'bg-brand',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
}

export interface StatusPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof pillVariants> {
  /** Marcador de forma, para não depender apenas do matiz. */
  dot?: boolean
  pulse?: boolean
}

export function StatusPill({
  className,
  tone = 'neutral',
  size,
  dot = true,
  pulse = false,
  children,
  ...props
}: StatusPillProps) {
  return (
    <span className={cn(pillVariants({ tone, size }), className)} {...props}>
      {dot ? (
        <span
          aria-hidden="true"
          className={cn(
            'h-1.5 w-1.5 shrink-0 rounded-full',
            DOT_TONE[(tone ?? 'neutral') as StatusTone],
            pulse && 'animate-brand-pulse',
          )}
        />
      ) : null}
      {children}
    </span>
  )
}

/**
 * Mapeia rótulos de status vindos do banco para um tom visual.
 * Centralizado aqui para que "ATIVO" tenha a mesma cor em todos os módulos.
 */
export function toneForStatus(status: string | null | undefined): StatusTone {
  const value = (status ?? '').toString().trim().toLowerCase()

  if (['ativo', 'active', 'pago', 'paid', 'confirmado', 'concluido', 'concluído', 'received', 'aprovado', 'sucesso', 'ganho', 'publicado', 'presente'].includes(value)) {
    return 'success'
  }
  if (['pendente', 'pending', 'aguardando', 'awaiting_risk_analysis', 'em_analise', 'em análise', 'agendado', 'rascunho', 'draft'].includes(value)) {
    return 'warning'
  }
  if (['inativo', 'inactive', 'cancelado', 'canceled', 'cancelled', 'vencido', 'overdue', 'erro', 'error', 'falhou', 'failed', 'perdido', 'expirado', 'ausente'].includes(value)) {
    return 'danger'
  }
  if (['em_andamento', 'em andamento', 'processando', 'processing', 'novo', 'new', 'contato', 'proposta'].includes(value)) {
    return 'info'
  }
  return 'neutral'
}
