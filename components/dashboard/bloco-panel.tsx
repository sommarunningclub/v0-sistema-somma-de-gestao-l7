'use client'

import * as React from 'react'
import { AlertTriangle } from 'lucide-react'

import { CardListSkeleton, EmptyState, Panel, PanelHeader } from '@/components/somma'

/**
 * Casca comum dos blocos do Dashboard.
 *
 * Os três estados que todo bloco precisa ter — carregando, indisponível e com
 * dado — ficam num lugar só, para que "não sei" nunca seja renderizado como
 * zero por esquecimento de um bloco.
 */
export function BlocoPanel({
  id,
  title,
  description,
  icon,
  loading,
  indisponivel,
  motivoIndisponivel,
  aviso,
  children,
}: {
  id: string
  title: string
  description?: React.ReactNode
  icon?: React.ElementType
  loading: boolean
  /** `true` quando o endpoint devolveu `null` para este bloco. */
  indisponivel: boolean
  motivoIndisponivel?: string
  /** Aviso exibido acima do conteúdo (ex.: resultado parcial). */
  aviso?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Panel role="region" aria-labelledby={id}>
      <PanelHeader icon={icon} title={<span id={id}>{title}</span>} description={description} />
      <div className="p-4 sm:p-5" aria-busy={loading || undefined}>
        {loading ? (
          <CardListSkeleton count={3} />
        ) : indisponivel ? (
          <EmptyState
            compact
            icon={AlertTriangle}
            title="Dados indisponíveis"
            description={
              motivoIndisponivel ??
              'Não foi possível apurar este bloco agora. Isso não significa zero — tente atualizar o dashboard em instantes.'
            }
          />
        ) : (
          <>
            {aviso ? (
              <p role="status" className="mb-3 text-meta text-warning">
                {aviso}
              </p>
            ) : null}
            {children}
          </>
        )}
      </div>
    </Panel>
  )
}

const numeroBR = new Intl.NumberFormat('pt-BR')

export function formatarNumero(value: number): string {
  return numeroBR.format(value)
}

/**
 * `data_evento` chega como 'YYYY-MM-DD'. `new Date('2026-08-10')` é meia-noite
 * UTC e, no fuso de São Paulo, volta um dia — por isso montamos a data local
 * componente por componente.
 */
export function formatarData(value: string | null): string {
  if (!value) return '—'
  const [ano, mes, dia] = value.slice(0, 10).split('-').map(Number)
  if (!ano || !mes || !dia) return value
  return new Date(ano, mes - 1, dia).toLocaleDateString('pt-BR')
}

/** `horario_inicio` chega como 'HH:MM:SS'. */
export function formatarHorario(value: string | null): string | null {
  if (!value) return null
  return value.slice(0, 5)
}
