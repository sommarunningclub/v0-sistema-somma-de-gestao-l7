import * as React from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * KPI. Um único formato para toda métrica do painel — antes cada módulo
 * inventava o seu, com tamanhos e pesos diferentes.
 *
 * O número usa `tabular-nums` + fonte mono para que valores não "dancem"
 * ao atualizar em tempo real.
 */

export interface StatTileProps {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: React.ElementType
  /** Variação percentual. Positiva/negativa define cor E ícone. */
  trend?: { value: number; label?: string; /** Para métricas onde cair é bom. */ inverted?: boolean }
  tone?: 'default' | 'brand'
  loading?: boolean
  onClick?: () => void
  className?: string
}

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  tone = 'default',
  loading = false,
  onClick,
  className,
}: StatTileProps) {
  const isUp = trend ? trend.value > 0 : false
  const isFlat = trend ? trend.value === 0 : false
  const good = trend ? (trend.inverted ? !isUp : isUp) : false
  const TrendIcon = isFlat ? Minus : isUp ? ArrowUpRight : ArrowDownRight

  const Root = (onClick ? 'button' : 'div') as React.ElementType

  return (
    <Root
      {...(onClick ? { type: 'button', onClick } : {})}
      className={cn(
        'group relative flex flex-col justify-between overflow-hidden rounded-md border p-4 text-left transition-colors duration-200',
        tone === 'brand'
          ? 'border-brand-border bg-brand-soft'
          : 'border-line bg-surface-raised',
        onClick && 'ds-tap hover:border-line-strong hover:bg-surface-hover focus-visible:border-brand',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="ds-eyebrow text-brand">{label}</span>
        {Icon ? (
          <Icon
            aria-hidden="true"
            className={cn(
              'h-4 w-4 shrink-0',
              tone === 'brand' ? 'text-brand' : 'text-ink-subtle',
            )}
          />
        ) : null}
      </div>

      {loading ? (
        <div className="ds-skeleton mt-3 h-7 w-24" />
      ) : (
        <div
          className={cn(
            'ds-num mt-2.5 text-2xl font-semibold tracking-tight',
            tone === 'brand' ? 'text-brand-strong' : 'text-ink-strong',
          )}
        >
          {value}
        </div>
      )}

      {(hint || trend) && !loading ? (
        <div className="mt-1.5 flex items-center gap-2 text-meta">
          {trend ? (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-semibold',
                isFlat ? 'text-ink-muted' : good ? 'text-success' : 'text-danger',
              )}
            >
              <TrendIcon aria-hidden="true" className="h-3.5 w-3.5" />
              {Math.abs(trend.value).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
              <span className="sr-only">
                {isFlat ? 'estável' : isUp ? 'de aumento' : 'de queda'}
              </span>
            </span>
          ) : null}
          {hint ? <span className="truncate text-ink-muted">{hint}</span> : null}
        </div>
      ) : null}
    </Root>
  )
}

/** Grade responsiva padrão de KPIs: 2 colunas no celular, até 4 no desktop. */
export function StatGrid({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4',
        className,
      )}
    >
      {children}
    </div>
  )
}
