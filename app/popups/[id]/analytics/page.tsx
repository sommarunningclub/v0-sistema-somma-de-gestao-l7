// app/popups/[id]/analytics/page.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { BarChart3, Eye, MousePointerClick, Smartphone, TrendingUp, X } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  EmptyState,
  MobileRecordCard,
  PageHeader,
  PageShell,
  Panel,
  Skeleton,
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
} from '@/components/somma'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/ui/error-banner'
import { popupStatus } from '@/components/popups-card'
import { apiFetch } from '@/lib/api-client'
import type { Popup, PopupStats } from '@/lib/services/popups'

const numberFormatter = new Intl.NumberFormat('pt-BR')
const dayFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })
const longDayFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})
const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

const CHART_CONFIG = {
  views: { label: 'Impressões', color: 'hsl(var(--chart-2))' },
  clicks: { label: 'Cliques', color: 'hsl(var(--chart-1))' },
} satisfies ChartConfig

function fmtNumber(value: number) {
  return numberFormatter.format(value)
}

function fmtDay(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dayFormatter.format(date)
}

function fmtLongDay(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : longDayFormatter.format(date)
}

function fmtDateTime(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date)
}

function getReferrerHost(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

/** Barra de proporção usada nas quebras por origem/navegador. */
function BreakdownRow({
  label,
  count,
  max,
  tone,
}: {
  label: string
  count: number
  max: number
  tone: 'brand' | 'info'
}) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <li className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate text-meta text-ink-muted sm:w-40" title={label}>
        {label}
      </span>
      <span
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken"
        role="img"
        aria-label={`${label}: ${fmtNumber(count)} cliques`}
      >
        <span
          className={`block h-full rounded-full ${tone === 'brand' ? 'bg-brand' : 'bg-info'}`}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className="w-12 shrink-0 text-right font-mono text-meta tabular-nums text-ink">
        {fmtNumber(count)}
      </span>
    </li>
  )
}

export default function PopupAnalyticsPage() {
  const params = useParams()
  const id = typeof params.id === 'string' ? params.id : ''

  const [popup, setPopup] = useState<Popup | null>(null)
  const [stats, setStats] = useState<PopupStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const [popupRes, statsRes] = await Promise.all([
        apiFetch(`/api/popups/${id}`),
        apiFetch(`/api/popups/${id}/stats`),
      ])
      if (!popupRes.ok || !statsRes.ok) throw new Error('Erro ao carregar')
      const [popupData, statsData] = await Promise.all([popupRes.json(), statsRes.json()])
      setPopup(popupData)
      setStats(statsData)
    } catch {
      setError('Erro ao carregar analytics')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  const status = popup ? popupStatus(popup) : null
  const period = popup
    ? `${fmtLongDay(popup.start_date)} até ${popup.end_date ? fmtLongDay(popup.end_date) : 'sem fim definido'}`
    : null

  const mobileRate =
    stats && stats.total_clicks > 0
      ? Math.round((stats.mobile_clicks / stats.total_clicks) * 100)
      : 0

  const series = stats?.daily_series ?? []
  const hasSeriesData = series.some((point) => point.views > 0 || point.clicks > 0)

  const chartSummary = stats
    ? `Gráfico de barras com impressões e cliques por dia nos últimos 30 dias. Total de ${fmtNumber(
        stats.total_views,
      )} impressões e ${fmtNumber(stats.total_clicks)} cliques.`
    : ''

  return (
    <PageShell className="pb-10 pt-4">
      <PageHeader
        sticky={false}
        eyebrow="Pop-ups"
        title={loading && !popup ? <Skeleton className="h-7 w-56" /> : (popup?.title ?? 'Analytics')}
        description="Desempenho de exibição e cliques dos últimos 30 dias."
        meta={
          period ? (
            <>
              <span>Período: {period}</span>
              {status ? <StatusPill tone={status.tone}>{status.label}</StatusPill> : null}
            </>
          ) : undefined
        }
        actions={
          <Button variant="secondary" onClick={() => void load()} loading={loading}>
            Atualizar
          </Button>
        }
      />

      {error ? (
        <div className="mb-4">
          <ErrorBanner message={error} onRetry={() => void load()} />
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-5" aria-busy>
          <StatGridSkeleton count={4} />
          <Skeleton className="h-64 w-full rounded-xl" />
          <TableSkeleton rows={5} columns={4} />
        </div>
      ) : stats ? (
        <div className="space-y-5">
          <StatGrid>
            <StatTile
              tone="brand"
              icon={MousePointerClick}
              label="Cliques"
              value={fmtNumber(stats.total_clicks)}
              hint={`${fmtNumber(stats.clicks_today)} hoje`}
            />
            <StatTile
              icon={Eye}
              label="Impressões (30d)"
              value={fmtNumber(stats.total_views)}
            />
            <StatTile
              icon={TrendingUp}
              label="CTR"
              value={`${numberFormatter.format(stats.ctr)}%`}
              hint="Cliques por impressão"
            />
            <StatTile
              icon={X}
              label="Fechamentos"
              value={fmtNumber(stats.total_dismissals)}
              hint={`${fmtNumber(mobileRate)}% dos cliques no mobile`}
            />
          </StatGrid>

          <Panel>
            <PanelHeader
              icon={BarChart3}
              title="Impressões e cliques por dia"
              description="Últimos 30 dias"
            />
            <div className="p-4 sm:p-5">
              {hasSeriesData ? (
                <>
                  <ChartContainer
                    config={CHART_CONFIG}
                    className="aspect-auto h-[260px] w-full sm:h-[300px]"
                    role="img"
                    aria-label={chartSummary}
                    aria-describedby="serie-diaria-tabela"
                  >
                    <BarChart data={series} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        interval="preserveStartEnd"
                        tickFormatter={fmtDay}
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                        width={44}
                        tickFormatter={fmtNumber}
                      />
                      <ChartTooltip
                        cursor={{ fill: 'var(--surface-hover)', opacity: 0.5 }}
                        content={<ChartTooltipContent labelFormatter={(value) => fmtLongDay(String(value))} />}
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Bar
                        dataKey="views"
                        name="Impressões"
                        fill="var(--color-views)"
                        radius={[3, 3, 0, 0]}
                      />
                      <Bar
                        dataKey="clicks"
                        name="Cliques"
                        fill="var(--color-clicks)"
                        radius={[3, 3, 0, 0]}
                      />
                    </BarChart>
                  </ChartContainer>

                  <div className="mt-5" id="serie-diaria-tabela">
                    <TableFrame className="hidden md:block">
                      <Table caption="Impressões, cliques e fechamentos por dia nos últimos 30 dias — alternativa textual ao gráfico.">
                        <THead>
                          <TH>Dia</TH>
                          <TH align="right">Impressões</TH>
                          <TH align="right">Cliques</TH>
                          <TH align="right">Fechamentos</TH>
                        </THead>
                        <TBody>
                          {series.map((point) => (
                            <TR key={point.date}>
                              <TD>{fmtLongDay(point.date)}</TD>
                              <TD align="right" className="font-mono tabular-nums">
                                {fmtNumber(point.views)}
                              </TD>
                              <TD align="right" className="font-mono tabular-nums">
                                {fmtNumber(point.clicks)}
                              </TD>
                              <TD align="right" className="font-mono tabular-nums">
                                {fmtNumber(point.dismissals)}
                              </TD>
                            </TR>
                          ))}
                        </TBody>
                      </Table>
                    </TableFrame>

                    <div className="space-y-2 md:hidden">
                      {series.map((point) => (
                        <MobileRecordCard
                          key={point.date}
                          title={fmtLongDay(point.date)}
                          fields={[
                            { label: 'Impressões', value: fmtNumber(point.views) },
                            { label: 'Cliques', value: fmtNumber(point.clicks) },
                            { label: 'Fechamentos', value: fmtNumber(point.dismissals) },
                          ]}
                        />
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <EmptyState
                  compact
                  icon={BarChart3}
                  title="Sem dados no período"
                  description="Este pop-up ainda não registrou impressões ou cliques nos últimos 30 dias."
                />
              )}
            </div>
          </Panel>

          {stats.referrer_breakdown.length > 0 || stats.browser_breakdown.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {stats.referrer_breakdown.length > 0 ? (
                <Panel>
                  <PanelHeader title="Origens de tráfego" description="Cliques por referenciador" />
                  <ul className="space-y-2.5 p-4 sm:p-5">
                    {stats.referrer_breakdown.map(({ referrer, count }) => (
                      <BreakdownRow
                        key={referrer}
                        label={referrer}
                        count={count}
                        max={stats.referrer_breakdown[0].count}
                        tone="info"
                      />
                    ))}
                  </ul>
                </Panel>
              ) : null}

              {stats.browser_breakdown.length > 0 ? (
                <Panel>
                  <PanelHeader title="Navegadores" description="Cliques por navegador" />
                  <ul className="space-y-2.5 p-4 sm:p-5">
                    {stats.browser_breakdown.map(({ browser, count }) => (
                      <BreakdownRow
                        key={browser}
                        label={browser}
                        count={count}
                        max={stats.browser_breakdown[0].count}
                        tone="brand"
                      />
                    ))}
                  </ul>
                </Panel>
              ) : null}
            </div>
          ) : null}

          <Panel>
            <PanelHeader
              title="Cliques recentes"
              description={`${fmtNumber(stats.recent_events.length)} eventos`}
            />
            {stats.recent_events.length === 0 ? (
              <div className="p-4 sm:p-5">
                <EmptyState
                  compact
                  icon={MousePointerClick}
                  title="Nenhum clique registrado"
                  description="Assim que alguém clicar no pop-up, os eventos aparecem aqui."
                />
              </div>
            ) : (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <Table caption="Últimos cliques registrados no pop-up, com data, página, dispositivo, navegador e origem.">
                    <THead>
                      <TH>Data/hora</TH>
                      <TH>Página</TH>
                      <TH>Dispositivo</TH>
                      <TH>Navegador</TH>
                      <TH>Origem</TH>
                      <TH>Sessão</TH>
                    </THead>
                    <TBody>
                      {stats.recent_events.map((event) => (
                        <TR key={event.id}>
                          <TD className="whitespace-nowrap">{fmtDateTime(event.clicked_at)}</TD>
                          <TD>{event.page || '/'}</TD>
                          <TD>
                            <StatusPill tone={event.device_type === 'mobile' ? 'info' : 'neutral'}>
                              {event.device_type === 'mobile' ? 'Mobile' : 'Desktop'}
                            </StatusPill>
                          </TD>
                          <TD>{event.browser || '—'}</TD>
                          <TD className="max-w-[10rem] truncate" title={event.referrer}>
                            {event.referrer ? getReferrerHost(event.referrer) : '—'}
                          </TD>
                          <TD className="font-mono text-ink-subtle">
                            {event.user_session_id.slice(0, 8)}…
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </div>

                <div className="space-y-2 p-4 md:hidden">
                  {stats.recent_events.map((event) => (
                    <MobileRecordCard
                      key={event.id}
                      title={fmtDateTime(event.clicked_at)}
                      subtitle={event.page || '/'}
                      status={
                        <StatusPill tone={event.device_type === 'mobile' ? 'info' : 'neutral'}>
                          {event.device_type === 'mobile' ? 'Mobile' : 'Desktop'}
                        </StatusPill>
                      }
                      fields={[
                        { label: 'Navegador', value: event.browser || '—' },
                        {
                          label: 'Origem',
                          value: event.referrer ? getReferrerHost(event.referrer) : '—',
                        },
                      ]}
                    />
                  ))}
                </div>
              </>
            )}
          </Panel>
        </div>
      ) : !error ? (
        <EmptyState
          icon={BarChart3}
          title="Nenhum dado disponível"
          description="Não encontramos estatísticas para este pop-up."
        />
      ) : null}
    </PageShell>
  )
}
