'use client'

import { CalendarCheck } from 'lucide-react'

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
} from '@/components/somma'
import { BlocoPanel, formatarNumero } from './bloco-panel'
import type { DashboardPresencaBloco, MembroPresenca } from './types'

/**
 * Bloco 2 — os 10 membros com maior cobertura de eventos.
 *
 * "Presente em todos os check-ins" na prática é uma cobertura: o denominador é
 * o número de eventos que já tiveram ao menos um check-in. Quando ninguém tem
 * 100% mostramos os melhores mesmo assim, com o critério escrito na tela.
 */
function cobertura(membro: MembroPresenca, total: number): number | null {
  if (total <= 0) return null
  return (membro.eventos / total) * 100
}

function rotuloCobertura(valor: number | null): string {
  return valor === null ? '—' : `${valor.toFixed(0)}%`
}

export function PresencaEventosPanel({
  bloco,
  loading,
}: {
  bloco: DashboardPresencaBloco | null
  loading: boolean
}) {
  const total = bloco?.totalEventos ?? 0
  const membros = bloco?.membros ?? []
  const completos = membros.filter((m) => total > 0 && m.eventos === total).length

  return (
    <BlocoPanel
      id="dashboard-presenca-eventos"
      icon={CalendarCheck}
      title="Top 10 em presença nos eventos"
      description={
        bloco
          ? `Critério: eventos distintos com check-in registrado, sobre os ${formatarNumero(total)} eventos que já tiveram check-in`
          : undefined
      }
      loading={loading}
      indisponivel={bloco === null}
      aviso={
        bloco?.parcial
          ? 'Amostra parcial: o volume de check-ins excedeu o limite de leitura, então a cobertura pode estar subestimada.'
          : undefined
      }
    >
      {membros.length === 0 ? (
        <EmptyState
          compact
          icon={CalendarCheck}
          title="Nenhum check-in registrado"
          description="A cobertura por membro aparece aqui depois do primeiro evento com check-in aberto."
        />
      ) : (
        <>
          {completos === 0 ? (
            <p className="mb-3 text-meta text-ink-muted">
              Ninguém esteve em todos os {formatarNumero(total)} eventos — a lista mostra a
              maior cobertura registrada.
            </p>
          ) : (
            <p className="mb-3 text-meta text-ink-muted">
              {completos === 1
                ? '1 membro esteve em todos os eventos.'
                : `${formatarNumero(completos)} membros estiveram em todos os eventos.`}
            </p>
          )}

          {/* Desktop: tabela. Celular: lista de cards. */}
          <div className="hidden overflow-x-auto lg:block">
            <Table
              className="min-w-[420px]"
              caption="Membros com maior número de eventos com check-in registrado, com a cobertura sobre o total de eventos."
            >
              <THead>
                <TH width="3rem">#</TH>
                <TH>Membro</TH>
                <TH align="right">Eventos</TH>
                <TH align="right">Cobertura</TH>
              </THead>
              <TBody>
                {membros.map((membro, index) => (
                  <TR key={membro.cpf}>
                    <TD className="ds-eyebrow text-ink-subtle whitespace-nowrap">{index + 1}º</TD>
                    {/* O nome pode quebrar; a contagem "X de Y" é que não pode. */}
                    <TD className="text-ink-strong">{membro.nome}</TD>
                    <TD align="right" className="font-mono tabular-nums whitespace-nowrap">
                      {formatarNumero(membro.eventos)} de {formatarNumero(total)}
                    </TD>
                    <TD align="right" className="font-mono tabular-nums whitespace-nowrap">
                      {rotuloCobertura(cobertura(membro, total))}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          <ul className="space-y-2.5 lg:hidden">
            {membros.map((membro, index) => (
              <li key={membro.cpf}>
                <MobileRecordCard
                  title={`${index + 1}º ${membro.nome}`}
                  status={
                    <StatusPill tone={membro.eventos === total ? 'success' : 'neutral'} dot={false}>
                      {rotuloCobertura(cobertura(membro, total))}
                    </StatusPill>
                  }
                  fields={[
                    {
                      label: 'Eventos',
                      value: `${formatarNumero(membro.eventos)} de ${formatarNumero(total)}`,
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
