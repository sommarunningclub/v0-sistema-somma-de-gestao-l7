'use client'

import { Users } from 'lucide-react'

import {
  EmptyState,
  MobileRecordCard,
  StatusPill,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  type StatusTone,
} from '@/components/somma'
import { BlocoPanel, formatarData, formatarHorario, formatarNumero } from './bloco-panel'
import { ESCALA_STATUS_LABEL, type DashboardEscalaBloco, type EscalaStatus } from './types'

/**
 * Bloco 3 — a escalação do próximo evento (ou do mais recente com escala).
 *
 * O tom é decorativo: o status vai sempre escrito ("Corre", "Apoio",
 * "Não vai"), nunca comunicado só por cor.
 */
const TOM_STATUS: Record<EscalaStatus, StatusTone> = {
  corre: 'success',
  apoio: 'info',
  nao_vai: 'danger',
}

function ordemStatus(status: EscalaStatus): number {
  return status === 'corre' ? 0 : status === 'apoio' ? 1 : 2
}

export function EscalaInsidersPanel({
  bloco,
  loading,
}: {
  bloco: DashboardEscalaBloco | null
  loading: boolean
}) {
  const evento = bloco?.evento ?? null
  const insiders = [...(bloco?.insiders ?? [])].sort(
    (a, b) => ordemStatus(a.status) - ordemStatus(b.status) || a.nome.localeCompare(b.nome, 'pt-BR')
  )
  const horario = formatarHorario(evento?.horarioInicio ?? null)
  const corre = insiders.filter((i) => i.status === 'corre').length

  return (
    <BlocoPanel
      id="dashboard-escala-insiders"
      icon={Users}
      title="Escala dos Insiders"
      description={
        evento
          ? `${evento.titulo} — ${formatarData(evento.dataEvento)}${horario ? ` às ${horario}` : ''}${evento.local ? ` · ${evento.local}` : ''}`
          : undefined
      }
      loading={loading}
      indisponivel={bloco === null}
      aviso={
        evento?.passado
          ? 'Nenhum evento futuro tem escala montada — exibindo a escala do evento mais recente já realizado.'
          : undefined
      }
    >
      {!evento || insiders.length === 0 ? (
        <EmptyState
          compact
          icon={Users}
          title="Nenhuma escala montada"
          description="Monte a escalação de um evento no módulo Escala para que ela apareça aqui."
        />
      ) : (
        <>
          <p className="mb-3 text-meta text-ink-muted">
            {formatarNumero(insiders.length)}{' '}
            {insiders.length === 1 ? 'insider escalado' : 'insiders escalados'} ·{' '}
            {formatarNumero(corre)} {corre === 1 ? 'corre' : 'correm'}
          </p>

          {/* Desktop: tabela. Celular: lista de cards. */}
          <div className="hidden overflow-x-auto lg:block">
            <Table
              className="min-w-[480px]"
              caption="Insiders escalados para o evento, com status, pelotão e atividades atribuídas."
            >
              <THead>
                <TH>Insider</TH>
                <TH>Status</TH>
                <TH>Pelotão</TH>
                <TH>Atividades</TH>
              </THead>
              <TBody>
                {insiders.map((insider) => (
                  <TR key={insider.id}>
                    <TD className="text-ink-strong">{insider.nome}</TD>
                    <TD>
                      <StatusPill tone={TOM_STATUS[insider.status]}>
                        {ESCALA_STATUS_LABEL[insider.status]}
                      </StatusPill>
                    </TD>
                    <TD>{insider.pelotao ?? '—'}</TD>
                    <TD>{insider.atividades.length > 0 ? insider.atividades.join(', ') : '—'}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          <ul className="space-y-2.5 lg:hidden">
            {insiders.map((insider) => (
              <li key={insider.id}>
                <MobileRecordCard
                  title={insider.nome}
                  status={
                    <StatusPill tone={TOM_STATUS[insider.status]}>
                      {ESCALA_STATUS_LABEL[insider.status]}
                    </StatusPill>
                  }
                  fields={[
                    { label: 'Pelotão', value: insider.pelotao ?? '—' },
                    {
                      label: 'Atividades',
                      value:
                        insider.atividades.length > 0 ? insider.atividades.join(', ') : '—',
                    },
                  ]}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </BlocoPanel>
  )
}
