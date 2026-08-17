'use client'

import { Medal } from 'lucide-react'

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
import type { DashboardPresencaInsidersBloco, InsiderPresenca } from './types'

function cobertura(insider: InsiderPresenca, total: number): number | null {
  if (total <= 0) return null
  return (insider.eventos / total) * 100
}

function rotuloCobertura(valor: number | null): string {
  return valor === null ? '—' : `${valor.toFixed(0)}%`
}

export function PresencaInsidersPanel({
  bloco,
  loading,
}: {
  bloco: DashboardPresencaInsidersBloco | null
  loading: boolean
}) {
  const total = bloco?.totalEventos ?? 0
  const insiders = bloco?.insiders ?? []
  const completos = insiders.filter((i) => total > 0 && i.eventos === total).length

  return (
    <BlocoPanel
      id="dashboard-presenca-insiders"
      icon={Medal}
      title="Top 10 insiders em presença nos sommas"
      description={
        bloco
          ? `Critério: eventos distintos com check-in do insider (CPF do cadastro), sobre os ${formatarNumero(total)} eventos que já tiveram check-in`
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
      {insiders.length === 0 ? (
        <EmptyState
          compact
          icon={Medal}
          title="Nenhum insider com presença ainda"
          description="O ranking aparece quando um insider cadastrado tiver check-in em algum somma."
        />
      ) : (
        <>
          {completos === 0 ? (
            <p className="mb-3 text-meta text-ink-muted">
              Nenhum insider esteve em todos os {formatarNumero(total)} sommas — a lista mostra a
              maior cobertura registrada.
            </p>
          ) : (
            <p className="mb-3 text-meta text-ink-muted">
              {completos === 1
                ? '1 insider esteve em todos os sommas.'
                : `${formatarNumero(completos)} insiders estiveram em todos os sommas.`}
            </p>
          )}

          <div className="hidden overflow-x-auto lg:block">
            <Table
              className="min-w-[420px]"
              caption="Insiders com maior número de sommas com check-in registrado, com a cobertura sobre o total de eventos."
            >
              <THead>
                <TH width="3rem">#</TH>
                <TH>Insider</TH>
                <TH align="right">Sommas</TH>
                <TH align="right">Cobertura</TH>
              </THead>
              <TBody>
                {insiders.map((insider, index) => (
                  <TR key={insider.id}>
                    <TD className="ds-eyebrow text-ink-subtle whitespace-nowrap">{index + 1}º</TD>
                    <TD className="text-ink-strong">{insider.nome}</TD>
                    <TD align="right" className="font-mono tabular-nums whitespace-nowrap">
                      {formatarNumero(insider.eventos)} de {formatarNumero(total)}
                    </TD>
                    <TD align="right" className="font-mono tabular-nums whitespace-nowrap">
                      {rotuloCobertura(cobertura(insider, total))}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          <ul className="space-y-2.5 lg:hidden">
            {insiders.map((insider, index) => (
              <li key={insider.id}>
                <MobileRecordCard
                  title={`${index + 1}º ${insider.nome}`}
                  status={
                    <StatusPill tone={insider.eventos === total ? 'success' : 'neutral'} dot={false}>
                      {rotuloCobertura(cobertura(insider, total))}
                    </StatusPill>
                  }
                  fields={[
                    {
                      label: 'Sommas',
                      value: `${formatarNumero(insider.eventos)} de ${formatarNumero(total)}`,
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
