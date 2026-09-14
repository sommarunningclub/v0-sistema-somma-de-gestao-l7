'use client'

import { AlertCircle, ClipboardCheck, Gauge, HeartPulse, Info, Timer, Users } from 'lucide-react'
import {
  EmptyState,
  Panel,
  PanelHeader,
  StatGrid,
  StatTile,
  StatusPill,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableFrame,
} from '@/components/somma'
import { rotuloDaReferencia } from '@/lib/nps/periodo'
import { BarrasHorizontais, Dimensoes, DistribuicaoNps, NotasDeZeroADez, Variacao } from './graficos'
import { formatarDecimal, formatarNps } from './visual'
import type { AbaRodada, DadosRodada } from './nps-rodada-detalhe'

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="mb-3 text-[0.8125rem] font-semibold text-ink-strong">{titulo}</h4>
      {children}
    </div>
  )
}

export function NpsResultados({ dados, onIrPara }: { dados: DadosRodada; onIrPara: (aba: AbaRodada) => void }) {
  const { relatorio: r, anterior, alunos_ativos: alunosAtivos } = dados
  const rotuloAnterior = anterior ? rotuloDaReferencia(anterior.reference_period) : null

  if (r.total === 0) {
    return (
      <EmptyState
        icon={Gauge}
        title="Ainda sem respostas"
        description="Os resultados aparecem assim que o primeiro aluno responder. Os links para divulgar estão na aba Divulgação."
        action={
          <button type="button" onClick={() => onIrPara('divulgacao')} className="text-sm font-semibold text-brand hover:underline">
            Ver links de divulgação
          </button>
        }
      />
    )
  }

  const identificados = r.professores.filter((p) => p.identificado)

  return (
    <div className="space-y-5">
      <StatGrid>
        <StatTile
          label="NPS"
          tone="brand"
          icon={Gauge}
          value={formatarNps(r.nps.nps)}
          hint={
            <span className="flex flex-wrap items-center gap-2">
              <span>{r.zona.rotulo}</span>
              {r.variacaoNps !== null ? (
                <Variacao valor={r.variacaoNps} sufixo=" pts" titulo={rotuloAnterior ? `em relação a ${rotuloAnterior}` : undefined} />
              ) : null}
            </span>
          }
        />
        <StatTile
          label="Respostas"
          icon={Users}
          value={r.total}
          hint={alunosAtivos > 0 ? `${Math.round((100 * r.total) / alunosAtivos)}% dos ${alunosAtivos} ativos` : undefined}
          onClick={() => onIrPara('respostas')}
        />
        <StatTile
          label="Tratativas pendentes"
          icon={ClipboardCheck}
          value={r.tratativasPendentes}
          hint={`${r.precisamTratativa} ${r.precisamTratativa === 1 ? 'precisa' : 'precisam'} de contato`}
          onClick={() => onIrPara('tratativas')}
        />
        <StatTile
          label="Chance de renovar"
          icon={HeartPulse}
          value={r.renovacao.media === null ? '-' : `${formatarDecimal(r.renovacao.media)}/10`}
          hint={`${r.renovacao.emRisco} com 6 ou menos`}
        />
      </StatGrid>

      {r.total < 10 ? (
        <p className="flex items-start gap-2 text-meta text-ink-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Amostra pequena ({r.total} {r.total === 1 ? 'resposta' : 'respostas'}): cada pessoa muda muito o percentual. Leia como sinal, não como tendência.
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel>
          <PanelHeader
            title="Distribuição do NPS"
            description="Detratores de 0 a 6, neutros 7 e 8, promotores 9 e 10."
          />
          <div className="space-y-6 p-4 sm:p-5">
            <DistribuicaoNps resumo={r.nps} />
            <div>
              <p className="mb-2 ds-eyebrow text-ink-muted">Respostas por nota</p>
              <NotasDeZeroADez notas={r.notas} />
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader icon={AlertCircle} title="Pontos de atenção" description="Regras fixas sobre esta rodada." />
          <div className="p-4 sm:p-5">
            {r.pontos.length === 0 ? (
              <p className="text-meta text-ink-muted">Nada fora do esperado nesta rodada.</p>
            ) : (
              <ul className="space-y-3">
                {r.pontos.map((p) => (
                  <li key={p.id} className="flex items-start gap-3">
                    <StatusPill tone={p.severidade === 'alta' ? 'danger' : 'warning'} className="mt-0.5 shrink-0">
                      {p.severidade === 'alta' ? 'Alta' : 'Média'}
                    </StatusPill>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-strong">{p.titulo}</p>
                      <p className="mt-0.5 text-meta text-ink-muted">{p.detalhe}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Médias por dimensão"
            description={`Escala de 1 a 5. Toque para ver as perguntas.${rotuloAnterior ? ` Variação sobre ${rotuloAnterior}.` : ''}`}
          />
          <div className="p-4 sm:p-5">
            <Dimensoes dimensoes={r.dimensoes} rotuloAnterior={rotuloAnterior} />
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            title="Por professor"
            description="Pelo cadastro do aluno e, sem cadastro, pelo professor que o aluno marcou na pesquisa."
          />
          {identificados.length === 0 ? (
            <p className="p-4 text-meta text-ink-muted sm:p-5">
              Nenhuma resposta tem professor ainda. Os links pessoais da aba Divulgação trazem o professor do cadastro, e a
              ficha de cada resposta permite corrigir.
            </p>
          ) : (
            <TableFrame className="rounded-none border-0">
              <Table caption="NPS por professor" className="min-w-[480px]">
                <THead>
                  <TH>Professor</TH>
                  <TH align="right">Respostas</TH>
                  <TH align="right">NPS</TH>
                  <TH align="right">Média prof.</TH>
                  <TH align="right">Detratores</TH>
                </THead>
                <TBody>
                  {r.professores.map((p) => (
                    <TR key={p.professor}>
                      <TD>
                        <span className={p.identificado ? 'text-ink-strong' : 'text-ink-muted'}>{p.professor}</span>
                        {p.informadas > 0 ? (
                          <span className="block text-meta text-ink-muted">
                            {p.informadas === p.respostas ? 'todas' : p.informadas} marcadas pelo aluno
                          </span>
                        ) : null}
                      </TD>
                      <TD align="right">
                        <span className="font-mono tabular-nums">{p.respostas}</span>
                      </TD>
                      <TD align="right">
                        <span className="font-mono font-semibold tabular-nums text-ink-strong">{formatarNps(p.nps)}</span>
                      </TD>
                      <TD align="right">
                        <span className="font-mono tabular-nums">{formatarDecimal(p.mediaProfessor)}</span>
                      </TD>
                      <TD align="right">
                        <span className="font-mono tabular-nums">{p.detratores}</span>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </TableFrame>
          )}
        </Panel>
      </div>

      <Panel>
        <PanelHeader title="Treinos presenciais na semana" description="Demanda para abrir turmas durante a semana." />
        <div className="grid gap-6 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-3">
          <Bloco titulo="Teria interesse?">
            <BarrasHorizontais fatias={r.semana.interesse} />
          </Bloco>
          <Bloco titulo="Combinação de dias">
            <BarrasHorizontais fatias={r.semana.dias} vazio="Ninguém com interesse respondeu." />
          </Bloco>
          <Bloco titulo="Períodos disponíveis">
            <BarrasHorizontais fatias={r.semana.periodos} vazio="Ninguém com interesse respondeu." />
          </Bloco>
          <Bloco titulo="Horário da manhã">
            <BarrasHorizontais fatias={r.semana.manha} vazio="Ninguém escolheu manhã." />
          </Bloco>
          <Bloco titulo="Horário da noite">
            <BarrasHorizontais fatias={r.semana.noite} vazio="Ninguém escolheu noite." />
          </Bloco>
          <Bloco titulo="Vezes por semana">
            <BarrasHorizontais fatias={r.semana.frequencia} vazio="Ninguém com interesse respondeu." />
          </Bloco>
        </div>
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel>
          <PanelHeader title="WhatsApp e acompanhamento" />
          <div className="grid gap-6 p-4 sm:p-5 md:grid-cols-2">
            <Bloco titulo="O que querem receber nos grupos">
              <BarrasHorizontais fatias={r.whatsapp.conteudos} />
            </Bloco>
            <div className="space-y-6">
              <Bloco titulo="Volume de mensagens">
                <BarrasHorizontais fatias={r.whatsapp.volume} />
              </Bloco>
              <Bloco titulo="Precisam de mais feedback do professor?">
                <BarrasHorizontais fatias={r.whatsapp.maisFeedback} />
              </Bloco>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Domingos e origem" />
          <div className="grid gap-6 p-4 sm:p-5 md:grid-cols-2">
            <Bloco titulo="Frequência nos domingos">
              <BarrasHorizontais fatias={r.domingos.frequencia} destacar={false} />
            </Bloco>
            <div className="space-y-6">
              <Bloco titulo="Por onde chegaram">
                <BarrasHorizontais fatias={r.origens} />
              </Bloco>
              <Bloco titulo="Como foram identificados">
                <BarrasHorizontais fatias={r.identificacao} destacar={false} />
              </Bloco>
              {r.tempoMedianoSegundos !== null ? (
                <p className="flex items-center gap-2 text-meta text-ink-muted">
                  <Timer className="h-3.5 w-3.5" aria-hidden="true" />
                  Tempo mediano de resposta: {Math.max(1, Math.round(r.tempoMedianoSegundos / 60))} min
                </p>
              ) : null}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}
