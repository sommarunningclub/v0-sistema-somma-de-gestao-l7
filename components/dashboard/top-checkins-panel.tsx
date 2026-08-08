'use client'

import { Trophy } from 'lucide-react'

import { EmptyState, Well } from '@/components/somma'
import { BlocoPanel, formatarNumero } from './bloco-panel'
import type { DashboardTopCheckinsBloco } from './types'

/**
 * Bloco 1 — o membro com mais check-ins validados, em destaque, seguido de um
 * ranking curto. "Validado" é o campo `validacao_do_checkin`, o mesmo que o
 * módulo de Check-in exibe.
 */
export function TopCheckinsPanel({
  bloco,
  loading,
}: {
  bloco: DashboardTopCheckinsBloco | null
  loading: boolean
}) {
  const destaque = bloco?.destaque ?? null

  return (
    <BlocoPanel
      id="dashboard-top-checkins"
      icon={Trophy}
      title="Membro com mais check-ins validados"
      description="Agrupado por CPF; conta apenas check-ins validados"
      loading={loading}
      indisponivel={bloco === null}
      aviso={
        bloco?.parcial
          ? 'Amostra parcial: o volume de check-ins excedeu o limite de leitura, então o ranking pode não refletir toda a base.'
          : undefined
      }
    >
      {destaque === null ? (
        <EmptyState
          compact
          icon={Trophy}
          title="Nenhum check-in validado ainda"
          description="O ranking aparece assim que os check-ins começarem a ser validados no módulo de Check-in."
        />
      ) : (
        <div className="space-y-4">
          <Well className="border-brand-border bg-brand-soft p-4">
            <p className="ds-eyebrow text-brand">1º lugar</p>
            <p className="mt-1 break-words text-base font-semibold text-ink-strong">
              {destaque.nome}
            </p>
            <p className="mt-2 font-mono text-3xl font-semibold tabular-nums tracking-tight text-ink-strong">
              {formatarNumero(destaque.validados)}
            </p>
            <p className="mt-0.5 text-meta text-ink-muted">
              {destaque.validados === 1 ? 'check-in validado' : 'check-ins validados'}
            </p>
          </Well>

          {bloco && bloco.seguintes.length > 0 ? (
            <ol className="space-y-2">
              {bloco.seguintes.map((membro, index) => (
                <li key={membro.cpf}>
                  <Well className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="ds-eyebrow shrink-0 text-ink-subtle">{index + 2}º</span>
                      <span className="truncate text-sm text-ink-strong">{membro.nome}</span>
                    </span>
                    <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-ink-strong">
                      {formatarNumero(membro.validados)}
                    </span>
                  </Well>
                </li>
              ))}
            </ol>
          ) : null}
        </div>
      )}
    </BlocoPanel>
  )
}
