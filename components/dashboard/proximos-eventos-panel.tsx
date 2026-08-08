'use client'

import { CalendarDays, MapPin, Users } from 'lucide-react'

import { EmptyState, StatusPill, type StatusTone } from '@/components/somma'
import { BlocoPanel, formatarData, formatarHorario, formatarNumero } from './bloco-panel'
import { CHECKIN_STATUS_LABEL, type DashboardProximosEventosBloco } from './types'

/** Bloco 4 — os próximos eventos por data, com o estado do check-in e inscritos. */
const TOM_CHECKIN: Record<string, StatusTone> = {
  aberto: 'success',
  bloqueado: 'warning',
  encerrado: 'neutral',
}

function rotuloCheckin(status: string | null): string {
  if (!status) return 'Check-in não configurado'
  return CHECKIN_STATUS_LABEL[status] ?? status
}

function tomCheckin(status: string | null): StatusTone {
  return status ? TOM_CHECKIN[status] ?? 'neutral' : 'neutral'
}

/** Inscritos ausentes são "não sei", não zero. */
function rotuloInscritos(inscritos: number | null): string {
  return inscritos === null ? '—' : formatarNumero(inscritos)
}

export function ProximosEventosPanel({
  bloco,
  loading,
}: {
  bloco: DashboardProximosEventosBloco | null
  loading: boolean
}) {
  const eventos = bloco?.eventos ?? []

  return (
    <BlocoPanel
      id="dashboard-proximos-eventos"
      icon={CalendarDays}
      title="Próximos eventos"
      description="Por data, com o estado do check-in e o total de inscritos"
      loading={loading}
      indisponivel={bloco === null}
    >
      {eventos.length === 0 ? (
        <EmptyState
          compact
          icon={CalendarDays}
          title="Nenhum evento futuro"
          description="Cadastre um evento com data de hoje em diante no módulo Eventos para que ele apareça aqui."
        />
      ) : (
        /*
         * Lista, não tabela — em todas as larguras.
         *
         * Este painel ocupa metade da grade no desktop (~520px). Uma tabela de
         * cinco colunas ali fazia o título quebrar em cinco linhas e cortava a
         * coluna de inscritos. Cada evento é uma unidade coesa (título + data +
         * local + estado), e lista comporta isso sem competir por largura — o
         * que também elimina a duplicação markup-desktop/markup-mobile.
         */
        <ul className="divide-y divide-line-soft">
          {eventos.map((evento) => {
            const horario = formatarHorario(evento.horarioInicio)
            return (
              <li
                key={evento.id}
                className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-strong">{evento.titulo}</p>

                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-ink-muted">
                    <span className="ds-num whitespace-nowrap text-ink">
                      {formatarData(evento.dataEvento)}
                      {horario ? ` · ${horario}` : ''}
                    </span>
                    {evento.local ? (
                      <span className="inline-flex min-w-0 items-center gap-1">
                        <MapPin aria-hidden="true" className="h-3 w-3 shrink-0" />
                        <span className="truncate">{evento.local}</span>
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 text-meta text-ink-muted">
                    <Users aria-hidden="true" className="h-3.5 w-3.5" />
                    <span className="ds-num text-ink">{rotuloInscritos(evento.inscritos)}</span>
                    <span className="sr-only">inscritos</span>
                  </span>
                  <StatusPill tone={tomCheckin(evento.checkinStatus)}>
                    {rotuloCheckin(evento.checkinStatus)}
                  </StatusPill>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </BlocoPanel>
  )
}
