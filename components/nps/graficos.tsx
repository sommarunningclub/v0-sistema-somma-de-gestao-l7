'use client'

import { AlertCircle, ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { cn } from '@/lib/utils'
import type { Fatia, ResultadoDimensao, ResumoNps } from '@/lib/nps/relatorio'
import type { PontoHistorico } from '@/lib/nps/tipos'
import {
  CATEGORIA,
  COR_BASE,
  COR_DESTAQUE,
  COR_EIXO,
  COR_GRADE,
  COR_SUPERFICIE,
  corDaNota,
  formatarDecimal,
  formatarNps,
  formatarPct,
  formatarVariacao,
} from './visual'

// ─── Distribuição do NPS ────────────────────────────────────────────────────
/**
 * Parte do todo numa barra só: detratores | neutros | promotores. Segmentos
 * separados por 2px de superfície; a legenda carrega nome, quantidade e
 * percentual, então nenhum valor depende de passar o mouse.
 */
export function DistribuicaoNps({ resumo }: { resumo: ResumoNps }) {
  const partes = [
    { chave: 'detractor' as const, quantidade: resumo.detratores, pct: resumo.pctDetratores },
    { chave: 'passive' as const, quantidade: resumo.neutros, pct: resumo.pctNeutros },
    { chave: 'promoter' as const, quantidade: resumo.promotores, pct: resumo.pctPromotores },
  ]
  const descricao = partes
    .map((p) => `${CATEGORIA[p.chave].plural}: ${p.quantidade} (${formatarPct(p.pct)})`)
    .join(', ')

  return (
    <figure>
      <div role="img" aria-label={descricao} className="flex h-6 w-full gap-[2px]">
        {partes
          .filter((p) => p.quantidade > 0)
          .map((p) => (
            <div
              key={p.chave}
              title={`${CATEGORIA[p.chave].plural}: ${p.quantidade} (${formatarPct(p.pct)})`}
              className="h-full first:rounded-l last:rounded-r"
              style={{ width: `${p.pct}%`, backgroundColor: CATEGORIA[p.chave].cor }}
            />
          ))}
      </div>
      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {partes.map((p) => (
          <span key={p.chave} className="inline-flex items-center gap-2 text-[0.8125rem] text-ink">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CATEGORIA[p.chave].cor }} />
            {CATEGORIA[p.chave].plural}
            <span className="font-mono tabular-nums text-ink-muted">
              {p.quantidade} · {formatarPct(p.pct)}
            </span>
          </span>
        ))}
      </figcaption>
    </figure>
  )
}

// ─── Notas de 0 a 10 ────────────────────────────────────────────────────────
/** Quantas pessoas deram cada nota. A cor segue a categoria da nota. */
export function NotasDeZeroADez({ notas }: { notas: Fatia[] }) {
  const maior = Math.max(...notas.map((n) => n.quantidade), 1)

  return (
    <ol className="grid grid-cols-11 items-end gap-1 sm:gap-2" aria-label="Quantidade de respostas por nota">
      {notas.map((n) => {
        const nota = Number(n.valor)
        return (
          <li key={n.valor} className="flex flex-col items-center" aria-label={`Nota ${nota}: ${n.quantidade}`}>
            <span className="h-4 font-mono text-[0.6875rem] tabular-nums text-ink-muted" aria-hidden="true">
              {n.quantidade > 0 ? n.quantidade : ''}
            </span>
            <div className="flex h-24 w-full items-end justify-center" aria-hidden="true">
              <div
                title={`Nota ${nota}: ${n.quantidade} (${formatarPct(n.pct)})`}
                className="w-full max-w-6 rounded-t"
                style={{
                  height: n.quantidade > 0 ? `${Math.max(4, (n.quantidade / maior) * 100)}%` : '2px',
                  backgroundColor: n.quantidade > 0 ? corDaNota(nota) : COR_GRADE,
                }}
              />
            </div>
            <span className="mt-1.5 font-mono text-[0.6875rem] tabular-nums text-ink-subtle" aria-hidden="true">
              {nota}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

// ─── Barras horizontais ─────────────────────────────────────────────────────
/**
 * Ranking de alternativas. Uma série só: todas as barras em cinza e a mais
 * escolhida em destaque (ênfase, não categoria). Cada linha já traz o valor
 * escrito, então a tabela é a própria lista.
 */
export function BarrasHorizontais({
  fatias,
  vazio = 'Ninguém respondeu esta pergunta.',
  destacar = true,
}: {
  fatias: Fatia[]
  vazio?: string
  destacar?: boolean
}) {
  const respondentes = fatias.reduce((s, f) => s + f.quantidade, 0)
  if (respondentes === 0) return <p className="text-meta text-ink-muted">{vazio}</p>
  const maior = Math.max(...fatias.map((f) => f.quantidade))

  return (
    <ul className="space-y-3">
      {fatias.map((f) => {
        const destaque = destacar && f.quantidade === maior && f.quantidade > 0
        return (
          <li key={f.valor} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1.5">
            <span className={cn('truncate text-[0.8125rem]', destaque ? 'font-medium text-ink-strong' : 'text-ink')}>
              {f.rotulo}
            </span>
            <span className="font-mono text-[0.75rem] tabular-nums text-ink-muted">
              {f.quantidade} · {formatarPct(f.pct)}
            </span>
            <div className="col-span-2 h-2 rounded-sm bg-surface-sunken" aria-hidden="true">
              <div
                className="h-full rounded-sm"
                style={{ width: `${f.pct}%`, backgroundColor: destaque ? COR_DESTAQUE : COR_BASE }}
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

// ─── Dimensões ──────────────────────────────────────────────────────────────
/** Médias de 1 a 5. Abaixo de 3,5 ganha destaque, ícone e aviso em texto. */
export function Dimensoes({ dimensoes, rotuloAnterior }: { dimensoes: ResultadoDimensao[]; rotuloAnterior: string | null }) {
  return (
    <ul className="divide-y divide-line">
      {dimensoes.map((d) => {
        const atencao = d.media !== null && d.media < 3.5
        return (
          <li key={d.id} className="py-3 first:pt-0 last:pb-0">
            <details className="group">
              <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 rounded [&::-webkit-details-marker]:hidden">
                <span className="flex min-w-0 items-center gap-2 text-[0.8125rem] text-ink">
                  {atencao ? <AlertCircle className="h-3.5 w-3.5 shrink-0 text-brand" aria-label="Precisa de atenção" /> : null}
                  <span className="truncate">{d.rotulo}</span>
                </span>
                <span className="flex items-baseline gap-3">
                  <Variacao valor={d.variacao} titulo={rotuloAnterior ? `em relação a ${rotuloAnterior}` : undefined} />
                  <span className="w-10 text-right font-mono text-sm font-semibold tabular-nums text-ink-strong">
                    {formatarDecimal(d.media)}
                  </span>
                </span>
                <div className="col-span-2 h-2 rounded-sm bg-surface-sunken" aria-hidden="true">
                  <div
                    className="h-full rounded-sm"
                    style={{
                      width: d.media === null ? '0%' : `${(d.media / 5) * 100}%`,
                      backgroundColor: atencao ? COR_DESTAQUE : COR_BASE,
                    }}
                  />
                </div>
              </summary>
              <ul className="mt-3 space-y-2 border-l border-line pl-3">
                {d.perguntas.map((p) => (
                  <li key={p.campo} className="text-meta">
                    <p className="text-ink">{p.titulo}</p>
                    <p className="mt-0.5 font-mono tabular-nums text-ink-muted">
                      média {formatarDecimal(p.media)} · {p.respostas} {p.respostas === 1 ? 'resposta' : 'respostas'}
                      {p.pctBaixas !== null ? ` · ${formatarPct(p.pctBaixas)} deram 1 ou 2` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        )
      })}
    </ul>
  )
}

export function Variacao({
  valor,
  casas = 1,
  sufixo = '',
  titulo,
}: {
  valor: number | null
  casas?: number
  sufixo?: string
  titulo?: string
}) {
  if (valor === null) return null
  const Icone = valor > 0 ? ArrowUpRight : valor < 0 ? ArrowDownRight : Minus
  return (
    <span
      title={titulo}
      className={cn(
        'inline-flex items-center gap-0.5 font-mono text-[0.75rem] font-semibold tabular-nums',
        valor > 0 ? 'text-success' : valor < 0 ? 'text-danger' : 'text-ink-muted',
      )}
    >
      <Icone className="h-3 w-3" aria-hidden="true" />
      {formatarVariacao(valor, casas)}
      {sufixo}
      {titulo ? <span className="sr-only"> {titulo}</span> : null}
    </span>
  )
}

// ─── Histórico ──────────────────────────────────────────────────────────────
const CONFIG_HISTORICO = { nps: { label: 'NPS', color: COR_DESTAQUE } } satisfies ChartConfig

/**
 * NPS rodada a rodada. Uma série, sem legenda (o título do painel diz o que
 * é); linha de referência no zero; rótulo só no último ponto. A tabela de
 * rodadas logo abaixo traz os mesmos números.
 */
export function HistoricoNps({ pontos }: { pontos: PontoHistorico[] }) {
  const ultimo = pontos.length - 1

  return (
    <ChartContainer config={CONFIG_HISTORICO} className="aspect-auto h-[240px] w-full">
      <LineChart data={pontos} margin={{ top: 24, right: 28, left: 0, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke={COR_GRADE} />
        <XAxis
          dataKey="rotulo"
          tickLine={false}
          axisLine={{ stroke: COR_GRADE }}
          tick={{ fill: COR_EIXO, fontSize: 11 }}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[-100, 100]}
          ticks={[-100, -50, 0, 50, 100]}
          tickLine={false}
          axisLine={false}
          width={40}
          tick={{ fill: COR_EIXO, fontSize: 11 }}
        />
        <ReferenceLine y={0} stroke={COR_EIXO} strokeOpacity={0.45} />
        <ChartTooltip
          cursor={{ stroke: COR_EIXO, strokeWidth: 1 }}
          content={
            <ChartTooltipContent
              indicator="line"
              formatter={(valor, _nome, item) => (
                <span className="flex w-full items-baseline justify-between gap-4">
                  <span className="text-ink-muted">NPS</span>
                  <span className="font-mono font-semibold tabular-nums text-ink-strong">
                    {formatarNps(Number(valor))}
                    <span className="ml-2 font-normal text-ink-muted">
                      {(item?.payload as PontoHistorico | undefined)?.total} resp.
                    </span>
                  </span>
                </span>
              )}
            />
          }
        />
        <Line
          type="monotone"
          dataKey="nps"
          stroke="var(--color-nps)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          dot={{ r: 4, fill: 'var(--color-nps)', stroke: COR_SUPERFICIE, strokeWidth: 2 }}
          activeDot={{ r: 6, fill: 'var(--color-nps)', stroke: COR_SUPERFICIE, strokeWidth: 2 }}
          isAnimationActive={false}
          label={(props: { x?: number | string; y?: number | string; index?: number; value?: number | string }) =>
            props.index === ultimo ? (
              <text
                x={Number(props.x)}
                y={Number(props.y) - 12}
                textAnchor="middle"
                fill="#e7e9ec"
                fontSize={12}
                fontWeight={600}
              >
                {formatarNps(Number(props.value))}
              </text>
            ) : (
              <g />
            )
          }
        />
      </LineChart>
    </ChartContainer>
  )
}
