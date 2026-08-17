'use client'

import { useId, useMemo, useState } from 'react'
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
import { nomeDoMes } from '@/lib/escala-ui'
import { BlocoPanel, formatarNumero } from './bloco-panel'
import type { DashboardPresencaInsidersBloco, InsiderPresenca } from './types'

const MES_TODOS = 'todos'

function cobertura(insider: InsiderPresenca, total: number): number | null {
  if (total <= 0) return null
  return (insider.eventos / total) * 100
}

function rotuloCobertura(valor: number | null): string {
  return valor === null ? '—' : `${valor.toFixed(0)}%`
}

function tomCobertura(insider: InsiderPresenca, total: number) {
  if (total > 0 && insider.eventos === total) return 'success' as const
  if (insider.eventos === 0) return 'danger' as const
  return 'neutral' as const
}

function rotuloMes(chave: string): string {
  const [ano, mes] = chave.split('-').map(Number)
  if (!ano || !mes) return chave
  const nome = nomeDoMes(ano, mes)
  return nome.charAt(0).toUpperCase() + nome.slice(1)
}

function mesCorrenteISO(): string {
  const agora = new Date()
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`
}

function mesPadrao(bloco: DashboardPresencaInsidersBloco): string {
  const atual = mesCorrenteISO()
  if (bloco.meses.some((m) => m.mes === atual)) return atual
  return bloco.meses[0]?.mes ?? MES_TODOS
}

export function PresencaInsidersPanel({
  bloco,
  loading,
}: {
  bloco: DashboardPresencaInsidersBloco | null
  loading: boolean
}) {
  const mesId = useId()
  const [mesEscolhido, setMesEscolhido] = useState<string | null>(null)
  const selecionado = mesEscolhido ?? (bloco ? mesPadrao(bloco) : MES_TODOS)

  const visao = useMemo(() => {
    if (!bloco) return null
    if (selecionado === MES_TODOS) return bloco.todos
    return bloco.meses.find((m) => m.mes === selecionado) ?? bloco.todos
  }, [bloco, selecionado])

  const total = visao?.totalEventos ?? 0
  const insiders = visao?.insiders ?? []
  const zerados = insiders.filter((i) => i.eventos === 0).length
  const periodo =
    selecionado === MES_TODOS ? 'no período' : `em ${rotuloMes(selecionado).toLowerCase()}`

  return (
    <BlocoPanel
      id="dashboard-presenca-insiders"
      icon={Medal}
      title="Presença dos insiders nos sommas"
      description={
        bloco
          ? `Critério: escala como corre ou apoio, sobre os ${formatarNumero(total)} sommas ${
              selecionado === MES_TODOS
                ? 'já realizados com escala montada'
                : `de ${rotuloMes(selecionado).toLowerCase()} com escala montada`
            }`
          : undefined
      }
      loading={loading}
      indisponivel={bloco === null}
      aviso={
        bloco?.parcial
          ? 'Amostra parcial: o volume da escala excedeu o limite de leitura, então a cobertura pode estar subestimada.'
          : undefined
      }
    >
      {bloco && bloco.meses.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <label htmlFor={mesId} className="ds-eyebrow text-ink-muted">
            Mês
          </label>
          <select
            id={mesId}
            value={selecionado}
            onChange={(e) => setMesEscolhido(e.target.value)}
            className="ds-tap max-w-full rounded border border-line bg-surface-hover px-2.5 py-1.5 text-sm text-ink hover:border-line-strong focus-visible:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand"
          >
            {bloco.meses.map((m) => (
              <option key={m.mes} value={m.mes}>
                {rotuloMes(m.mes)}
              </option>
            ))}
            <option value={MES_TODOS}>Todos os meses</option>
          </select>
        </div>
      ) : null}

      {insiders.length === 0 || total === 0 ? (
        <EmptyState
          compact
          icon={Medal}
          title="Nenhuma escala no período"
          description="O ranking mensal aparece quando a escala de um somma já realizado marcar insiders como corre, apoio ou não vai."
        />
      ) : (
        <>
          <p className="mb-3 text-meta text-ink-muted">
            {zerados === 0
              ? `Todos os ${formatarNumero(insiders.length)} insiders tiveram presença ${periodo}.`
              : zerados === 1
                ? `1 insider com presença zerada ${periodo}.`
                : `${formatarNumero(zerados)} insiders com presença zerada ${periodo}.`}
          </p>

          <div className="hidden max-h-[28rem] overflow-auto lg:block">
            <Table
              className="min-w-[420px]"
              caption="Insiders com presença na escala (corre ou apoio) no período selecionado, incluindo quem ficou zerado."
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
                    <TD align="right" className="whitespace-nowrap">
                      <StatusPill tone={tomCobertura(insider, total)} dot={false}>
                        {rotuloCobertura(cobertura(insider, total))}
                      </StatusPill>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </div>

          <ul className="max-h-[28rem] space-y-2.5 overflow-auto lg:hidden">
            {insiders.map((insider, index) => (
              <li key={insider.id}>
                <MobileRecordCard
                  title={`${index + 1}º ${insider.nome}`}
                  status={
                    <StatusPill tone={tomCobertura(insider, total)} dot={false}>
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
