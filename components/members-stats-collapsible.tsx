'use client'

import { useState } from 'react'
import { BarChart3, ChevronDown, Download, SearchCheck, Users } from 'lucide-react'
import { StatGrid, StatTile } from '@/components/somma'
import { cn } from '@/lib/utils'

interface MembersStatsCollapsibleProps {
  totalMembers: number
  activeMembers: number
  foundMembers: number
  loading?: boolean
}

/**
 * KPIs de membros no celular.
 *
 * No desktop os mesmos números ficam sempre visíveis (ver `StatGrid` na
 * página); aqui eles continuam colapsáveis para não empurrar a lista para
 * fora da primeira dobra.
 */
export function MembersStatsCollapsible({
  totalMembers,
  activeMembers,
  foundMembers,
  loading = false,
}: MembersStatsCollapsibleProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const percent = totalMembers > 0 ? Math.min(100, (foundMembers / totalMembers) * 100) : 0

  return (
    <section
      aria-label="Estatísticas de membros"
      className="overflow-hidden rounded-xl border border-line bg-surface-raised lg:hidden"
    >
      <button
        type="button"
        onClick={() => setIsExpanded((value) => !value)}
        aria-expanded={isExpanded}
        className="ds-tap flex w-full items-center justify-between gap-3 px-4 text-left transition-colors hover:bg-surface-hover"
      >
        <span className="flex min-w-0 flex-1 items-center gap-3">
          <BarChart3 aria-hidden="true" className="h-4 w-4 shrink-0 text-brand" />
          <span className="min-w-0">
            <span className="ds-eyebrow block">Estatísticas</span>
            <span className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="rounded-md bg-surface-sunken px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-ink-strong">
                {totalMembers} total
              </span>
              <span className="rounded-md bg-success-soft px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-success">
                {activeMembers} ativos
              </span>
              <span className="rounded-md bg-brand-soft px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-brand-strong">
                {foundMembers} na tela
              </span>
            </span>
          </span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'h-4 w-4 shrink-0 text-ink-muted transition-transform',
            isExpanded && 'rotate-180',
          )}
        />
      </button>

      {isExpanded ? (
        <div className="animate-rise-in space-y-3 border-t border-line bg-surface-sunken/60 p-3">
          <StatGrid>
            <StatTile
              label="Total de membros"
              value={totalMembers.toLocaleString('pt-BR')}
              icon={Users}
              loading={loading}
            />
            <StatTile
              label="Ativos"
              value={activeMembers.toLocaleString('pt-BR')}
              icon={SearchCheck}
              loading={loading}
            />
            <StatTile
              label="Carregados"
              value={foundMembers.toLocaleString('pt-BR')}
              hint="nesta sessão"
              icon={Download}
              tone="brand"
              loading={loading}
              className="col-span-2"
            />
          </StatGrid>

          <div className="ds-well p-3">
            <p className="ds-eyebrow">Cobertura da base</p>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(percent)}
              aria-label="Percentual da base carregado"
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-active"
            >
              <div
                className="h-full rounded-full bg-brand transition-all duration-300"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="mt-2 text-meta text-ink-muted">
              {percent.toFixed(0)}% da base carregada ({foundMembers} de {totalMembers})
            </p>
          </div>
        </div>
      ) : null}
    </section>
  )
}
