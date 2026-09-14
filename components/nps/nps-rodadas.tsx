'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClipboardCheck, Gauge, HeartPulse, Plus, RefreshCw, TrendingUp, Users } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/ui/error-banner'
import {
  EmptyState,
  MobileRecordCard,
  PageHeader,
  PageShell,
  Panel,
  PanelHeader,
  StatGrid,
  StatGridSkeleton,
  StatTile,
  StatusPill,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableFrame,
  TableSkeleton,
  notify,
} from '@/components/somma'
import { cn } from '@/lib/utils'
import { ESTADOS, estadoDaRodada } from '@/lib/nps/estado'
import { formatarData, rotuloDaReferencia } from '@/lib/nps/periodo'
import { zonaDoNps } from '@/lib/nps/relatorio'
import type { PontoHistorico, ResumoRodada } from '@/lib/nps/tipos'
import { HistoricoNps, Variacao } from './graficos'
import { NpsRodadaForm } from './nps-rodada-form'
import { formatarDecimal, formatarNps } from './visual'
import type { AbaRodada } from './nps-rodada-detalhe'

interface Dados {
  rodadas: ResumoRodada[]
  historico: PontoHistorico[]
  alunos_ativos: number
}

/** A rodada que o topo da tela resume: a que está no ar, senão a mais recente com respostas. */
function rodadaEmFoco(rodadas: ResumoRodada[]): ResumoRodada | null {
  const agora = new Date()
  return (
    rodadas.find((r) => estadoDaRodada(r, agora) === 'no_ar') ??
    rodadas.find((r) => r.status !== 'draft' && r.total_responses > 0) ??
    null
  )
}

function janela(r: ResumoRodada): string {
  if (!r.opens_at) return 'Sem datas'
  return `${formatarData(r.opens_at)} a ${r.closes_at ? formatarData(r.closes_at) : 'sem fim'}`
}

export function NpsRodadas({ onAbrir }: { onAbrir: (id: string, aba?: AbaRodada) => void }) {
  const [dados, setDados] = useState<Dados | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [criando, setCriando] = useState(false)

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const res = await apiFetch('/api/nps/rodadas')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Não foi possível carregar as rodadas.')
      setDados(data)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível carregar as rodadas.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const foco = useMemo(() => (dados ? rodadaEmFoco(dados.rodadas) : null), [dados])
  const pontoAnterior = useMemo(() => {
    if (!dados || !foco) return null
    const i = dados.historico.findIndex((p) => p.rodada_id === foco.id)
    return i > 0 ? dados.historico[i - 1] : null
  }, [dados, foco])

  const novaRodada = (
    <Button onClick={() => setCriando(true)}>
      <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
      Nova rodada
    </Button>
  )

  return (
    <PageShell>
      <PageHeader
        eyebrow="Relacionamento"
        title="NPS da Assessoria"
        description="Uma rodada de pesquisa a cada dois meses: link para os alunos, relatório e tratativa de quem está insatisfeito."
        meta={
          dados ? (
            <span>
              {dados.rodadas.length} {dados.rodadas.length === 1 ? 'rodada' : 'rodadas'} · {dados.alunos_ativos} alunos ativos
            </span>
          ) : null
        }
        primaryAction={novaRodada}
        actions={
          <Button variant="ghost" size="icon" onClick={() => void carregar()} disabled={carregando} aria-label="Atualizar">
            <RefreshCw className={cn('h-4 w-4', carregando && 'animate-spin')} aria-hidden="true" />
          </Button>
        }
      />

      {erro ? (
        <div className="mb-4">
          <ErrorBanner message={erro} onRetry={() => void carregar()} />
        </div>
      ) : null}

      {!dados && carregando ? (
        <div className="space-y-5">
          <StatGridSkeleton />
          <TableSkeleton />
        </div>
      ) : dados && dados.rodadas.length === 0 ? (
        <EmptyState
          icon={Gauge}
          title="Nenhuma rodada ainda"
          description="Crie a rodada do bimestre: o painel sugere o período, o link e a janela de 15 dias no ar."
          action={novaRodada}
        />
      ) : dados ? (
        <div className={cn('space-y-5 transition-opacity', carregando && 'opacity-60')}>
          {foco ? (
            <section aria-label={`Resumo da rodada ${rotuloDaReferencia(foco.reference_period)}`}>
              <p className="mb-2 ds-eyebrow text-ink-muted">
                {estadoDaRodada(foco) === 'no_ar' ? 'Rodada no ar' : 'Última rodada'} · {rotuloDaReferencia(foco.reference_period)}
              </p>
              <StatGrid>
                <StatTile
                  label="NPS"
                  tone="brand"
                  icon={Gauge}
                  value={formatarNps(foco.nps)}
                  hint={
                    <span className="flex flex-wrap items-center gap-2">
                      <span>{zonaDoNps(foco.nps).rotulo}</span>
                      {pontoAnterior && foco.nps !== null && pontoAnterior.nps !== null ? (
                        <Variacao
                          valor={Math.round((foco.nps - pontoAnterior.nps) * 10) / 10}
                          sufixo=" pts"
                          titulo={`em relação a ${pontoAnterior.rotulo}`}
                        />
                      ) : null}
                    </span>
                  }
                  onClick={() => onAbrir(foco.id)}
                />
                <StatTile
                  label="Respostas"
                  icon={Users}
                  value={foco.total_responses}
                  hint={
                    dados.alunos_ativos > 0
                      ? `${Math.round((100 * foco.total_responses) / dados.alunos_ativos)}% dos ${dados.alunos_ativos} ativos`
                      : undefined
                  }
                  onClick={() => onAbrir(foco.id, 'respostas')}
                />
                <StatTile
                  label="Tratativas pendentes"
                  icon={ClipboardCheck}
                  value={foco.tratativas_pendentes}
                  hint={foco.tratativas_pendentes > 0 ? 'Sem contato ainda' : 'Nenhum esperando'}
                  onClick={() => onAbrir(foco.id, 'tratativas')}
                />
                <StatTile
                  label="Chance de renovar"
                  icon={HeartPulse}
                  value={foco.avg_renewal_probability === null ? '-' : `${formatarDecimal(foco.avg_renewal_probability)}/10`}
                  hint="Média de quem respondeu"
                />
              </StatGrid>
            </section>
          ) : null}

          <Panel>
            <PanelHeader icon={TrendingUp} title="NPS por rodada" description="De -100 a 100: % de promotores menos % de detratores." />
            <div className="p-4 sm:p-5">
              {dados.historico.length >= 2 ? (
                <HistoricoNps pontos={dados.historico} />
              ) : (
                <p className="text-meta text-ink-muted">
                  O gráfico aparece a partir da segunda rodada com respostas.
                  {dados.historico.length === 1
                    ? ` Até agora: ${dados.historico[0].rotulo}, NPS ${formatarNps(dados.historico[0].nps)} com ${dados.historico[0].total} ${dados.historico[0].total === 1 ? 'resposta' : 'respostas'}.`
                    : ''}
                </p>
              )}
            </div>
          </Panel>

          <section aria-label="Rodadas">
            <div className="hidden lg:block">
              <TableFrame busy={carregando}>
                <Table caption="Rodadas do NPS da Assessoria">
                  <THead>
                    <TH>Rodada</TH>
                    <TH>Link</TH>
                    <TH>Janela</TH>
                    <TH>Estado</TH>
                    <TH align="right">Respostas</TH>
                    <TH align="right">NPS</TH>
                    <TH align="right">Tratativas</TH>
                  </THead>
                  <TBody>
                    {dados.rodadas.map((r) => {
                      const estado = ESTADOS[estadoDaRodada(r)]
                      return (
                        <TR key={r.id} onClick={() => onAbrir(r.id)}>
                          <TD>
                            <p className="font-medium text-ink-strong">{r.title}</p>
                            <p className="text-meta text-ink-muted">{rotuloDaReferencia(r.reference_period)}</p>
                          </TD>
                          <TD>
                            <span className="font-mono text-meta text-ink-muted">/nps/{r.slug}</span>
                          </TD>
                          <TD>
                            <span className="text-meta text-ink">{janela(r)}</span>
                          </TD>
                          <TD>
                            <StatusPill tone={estado.tone}>{estado.rotulo}</StatusPill>
                          </TD>
                          <TD align="right">
                            <span className="font-mono tabular-nums">{r.total_responses}</span>
                          </TD>
                          <TD align="right">
                            <span className="font-mono font-semibold tabular-nums text-ink-strong">{formatarNps(r.nps)}</span>
                          </TD>
                          <TD align="right">
                            {r.tratativas_pendentes > 0 ? (
                              <StatusPill tone="danger">{r.tratativas_pendentes} pendentes</StatusPill>
                            ) : (
                              <span className="text-meta text-ink-muted">-</span>
                            )}
                          </TD>
                        </TR>
                      )
                    })}
                  </TBody>
                </Table>
              </TableFrame>
            </div>

            <div className="space-y-3 lg:hidden">
              {dados.rodadas.map((r) => {
                const estado = ESTADOS[estadoDaRodada(r)]
                return (
                  <MobileRecordCard
                    key={r.id}
                    title={r.title}
                    subtitle={janela(r)}
                    status={<StatusPill tone={estado.tone}>{estado.rotulo}</StatusPill>}
                    fields={[
                      { label: 'Respostas', value: r.total_responses },
                      { label: 'NPS', value: formatarNps(r.nps) },
                      { label: 'Tratativas', value: r.tratativas_pendentes > 0 ? `${r.tratativas_pendentes} pendentes` : '-' },
                      { label: 'Link', value: `/nps/${r.slug}` },
                    ]}
                    onClick={() => onAbrir(r.id)}
                  />
                )
              })}
            </div>
          </section>
        </div>
      ) : null}

      <NpsRodadaForm
        open={criando}
        onOpenChange={setCriando}
        periodosExistentes={dados?.rodadas.map((r) => r.reference_period) ?? []}
        onSalva={(rodada) => {
          setCriando(false)
          notify.success('Rodada criada', {
            description: rodada.status === 'draft' ? 'Ela está em rascunho: publique quando quiser.' : 'O link já vale para a janela escolhida.',
          })
          onAbrir(rodada.id, 'divulgacao')
        }}
      />
    </PageShell>
  )
}
