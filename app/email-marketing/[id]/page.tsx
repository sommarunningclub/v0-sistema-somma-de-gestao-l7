// app/email-marketing/[id]/page.tsx
'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  Users,
  Send,
  CheckCircle2,
  Eye,
  MousePointerClick,
  AlertTriangle,
  ShieldAlert,
  UserMinus,
  Search,
  ExternalLink,
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts'
import { AuthenticatedChrome } from '@/components/authenticated-chrome'
import { apiFetch } from '@/lib/api-client'
import { ErrorBanner } from '@/components/ui/error-banner'
import { PageLoading } from '@/components/ui/page-loading'
import { Input } from '@/components/ui/input'
import { matchesTextSearch } from '@/lib/search-utils'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import type { CampaignStats, CampaignStatus, EmailCampaign, RecipientStatus } from '@/lib/email/types'
import type { DailyEventPoint, RecipientRow } from '@/lib/services/email-campaigns'

interface StatsResponse {
  stats: CampaignStats
  recipients: RecipientRow[]
  links: Array<{ link: string; count: number }>
  daily_series: DailyEventPoint[]
}

const CAMPAIGN_STATUS_META: Record<CampaignStatus, { label: string; className: string }> = {
  rascunho: { label: 'Rascunho', className: 'bg-neutral-700/80 text-neutral-300 border-neutral-600' },
  agendada: { label: 'Agendada', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  enviando: { label: 'Enviando', className: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  enviada: { label: 'Enviada', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  cancelada: { label: 'Cancelada', className: 'bg-neutral-700/80 text-neutral-400 border-neutral-600' },
  erro: { label: 'Erro', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

const RECIPIENT_STATUS_META: Record<RecipientStatus, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'text-neutral-400 bg-neutral-700/40' },
  enviado: { label: 'Enviado', className: 'text-blue-400 bg-blue-500/10' },
  entregue: { label: 'Entregue', className: 'text-green-400 bg-green-500/10' },
  aberto: { label: 'Aberto', className: 'text-purple-400 bg-purple-500/10' },
  clicado: { label: 'Clicado', className: 'text-orange-400 bg-orange-500/10' },
  bounce: { label: 'Bounce', className: 'text-red-400 bg-red-500/10' },
  spam: { label: 'Spam', className: 'text-red-500 bg-red-600/10' },
  falha: { label: 'Falha', className: 'text-red-400 bg-red-500/10' },
}

const RECIPIENT_STATUS_FILTERS: Array<{ value: RecipientStatus | 'todos'; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'pendente', label: 'Pendente' },
  { value: 'enviado', label: 'Enviado' },
  { value: 'entregue', label: 'Entregue' },
  { value: 'aberto', label: 'Aberto' },
  { value: 'clicado', label: 'Clicado' },
  { value: 'bounce', label: 'Bounce' },
  { value: 'spam', label: 'Spam' },
  { value: 'falha', label: 'Falha' },
]

const CHART_CONFIG: ChartConfig = {
  abertos: { label: 'Aberturas', color: '#a855f7' },
  clicados: { label: 'Cliques', color: '#f97316' },
}

const POLL_INTERVAL_MS = 10_000

/** Percentual de `value` sobre `entregue` — não sobre o total (é assim que taxa de abertura/clique se lê). */
function pct(value: number, entregue: number): number {
  return entregue > 0 ? Math.round((value / entregue) * 100) : 0
}

function fmtDate(d: string) {
  // `d` chega como 'YYYY-MM-DD' (data pura, sem timezone) — new Date('YYYY-MM-DD')
  // interpretaria como UTC meia-noite, que pode exibir o dia anterior em fusos negativos.
  const [y, m, day] = d.split('-').map(Number)
  if (!y || !m || !day) return d
  return new Date(y, m - 1, day).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function fmtDateTime(d: string) {
  return new Date(d).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function EmailCampaignStatusPage() {
  const params = useParams()
  const id = params.id as string

  const [campaign, setCampaign] = useState<EmailCampaign | null>(null)
  const [stats, setStats] = useState<CampaignStats | null>(null)
  const [recipients, setRecipients] = useState<RecipientRow[]>([])
  const [links, setLinks] = useState<Array<{ link: string; count: number }>>([])
  const [dailySeries, setDailySeries] = useState<DailyEventPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<RecipientStatus | 'todos'>('todos')
  const [searchTerm, setSearchTerm] = useState('')

  // Evita: uma resposta de polling que chega fora de ordem (rede lenta) sobrescrever
  // um estado mais novo já carregado por uma chamada disparada depois dela.
  const requestSeq = useRef(0)

  const loadData = useCallback(
    async (status: RecipientStatus | 'todos', opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLoading(true)
      const seq = ++requestSeq.current
      try {
        const qs = status !== 'todos' ? `?status=${status}` : ''
        const [campaignRes, statsRes] = await Promise.all([
          apiFetch(`/api/email-campaigns/${id}`),
          apiFetch(`/api/email-campaigns/${id}/stats${qs}`),
        ])

        if (seq !== requestSeq.current) return // resposta obsoleta, descarta

        if (campaignRes.status === 404 || statsRes.status === 404) {
          setNotFound(true)
          return
        }
        if (!campaignRes.ok || !statsRes.ok) throw new Error('Erro ao carregar')

        const [campaignData, statsData]: [EmailCampaign, StatsResponse] = await Promise.all([
          campaignRes.json(),
          statsRes.json(),
        ])

        if (seq !== requestSeq.current) return

        setCampaign(campaignData)
        setStats(statsData.stats)
        setRecipients(statsData.recipients ?? [])
        setLinks(statsData.links ?? [])
        setDailySeries(statsData.daily_series ?? [])
        setError(null)
      } catch {
        if (seq === requestSeq.current) setError('Erro ao carregar status da campanha')
      } finally {
        if (seq === requestSeq.current) setLoading(false)
      }
    },
    [id],
  )

  useEffect(() => {
    if (!id) return
    loadData(statusFilter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, statusFilter])

  // Polling de 10s enquanto a campanha está em disparo — silencioso (sem re-mostrar o loading cheio).
  useEffect(() => {
    if (campaign?.status !== 'enviando') return
    const interval = setInterval(() => {
      loadData(statusFilter, { silent: true })
    }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [campaign?.status, statusFilter, loadData])

  const filteredRecipients = useMemo(
    () => recipients.filter((r) => matchesTextSearch(searchTerm, [r.email, r.nome])),
    [recipients, searchTerm],
  )

  const entregue = stats?.entregue ?? 0
  const dispatched = stats ? stats.total - stats.pendente : 0
  const progressPct = stats && stats.total > 0 ? Math.round((dispatched / stats.total) * 100) : 0

  const cards = stats
    ? [
        { key: 'total', label: 'Total', value: stats.total, icon: Users, color: 'text-neutral-300' },
        { key: 'enviado', label: 'Enviados', value: stats.enviado, icon: Send, color: 'text-blue-400' },
        { key: 'entregue', label: 'Entregues', value: stats.entregue, icon: CheckCircle2, color: 'text-green-400' },
        {
          key: 'aberto',
          label: 'Abertos',
          value: stats.aberto,
          icon: Eye,
          color: 'text-purple-400',
          pct: pct(stats.aberto, entregue),
        },
        {
          key: 'clicado',
          label: 'Clicados',
          value: stats.clicado,
          icon: MousePointerClick,
          color: 'text-orange-400',
          pct: pct(stats.clicado, entregue),
        },
        {
          key: 'bounce',
          label: 'Bounces',
          value: stats.bounce,
          icon: AlertTriangle,
          color: 'text-red-400',
          pct: pct(stats.bounce, entregue),
        },
        {
          key: 'spam',
          label: 'Spam',
          value: stats.spam,
          icon: ShieldAlert,
          color: 'text-red-500',
          pct: pct(stats.spam, entregue),
        },
        {
          key: 'descadastros',
          label: 'Descadastros',
          value: stats.descadastros,
          icon: UserMinus,
          color: 'text-neutral-400',
          pct: pct(stats.descadastros, entregue),
        },
      ]
    : []

  const campaignMeta = campaign ? CAMPAIGN_STATUS_META[campaign.status] : null

  return (
    <AuthenticatedChrome backHref="/?section=email" backLabel="E-mail Marketing" title={campaign?.nome}>
      <div className="h-full overflow-auto bg-black">
        {notFound ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-center px-4">
            <p className="text-neutral-400 font-medium">Campanha não encontrada</p>
            <p className="text-neutral-600 text-sm">Ela pode ter sido excluída.</p>
          </div>
        ) : (
          <div className="p-4 space-y-5">
            {error && (
              <ErrorBanner
                message={error}
                onRetry={() => {
                  setError(null)
                  loadData(statusFilter)
                }}
              />
            )}

            {loading && !campaign ? (
              <PageLoading label="Carregando status da campanha..." />
            ) : campaign && stats ? (
              <>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {campaignMeta && (
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${campaignMeta.className}`}>
                      {campaignMeta.label}
                    </span>
                  )}
                  <span className="text-sm text-neutral-400 truncate">{campaign.subject}</span>
                  {campaign.status === 'erro' && campaign.error && (
                    <span className="text-xs text-red-400">— {campaign.error}</span>
                  )}
                </div>

                {/* Barra de progresso durante o disparo */}
                {campaign?.status === 'enviando' && stats && (
                  <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="text-sm font-medium text-white">Disparo em andamento</h2>
                      <span className="text-xs text-neutral-500">atualiza a cada 10s</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-neutral-400 mb-1.5">
                      {/* "processados" (não "enviados") para não colidir com o card
                          "Enviados" abaixo, que mostra stats.enviado — quem está
                          parado nesse status agora, não quem já passou por ele. */}
                      <span>
                        {dispatched} / {stats.total} processados
                      </span>
                      <span>{progressPct}%</span>
                    </div>
                    <div className="w-full bg-neutral-800 rounded-full h-2">
                      <div
                        className="bg-orange-500 h-2 rounded-full transition-all"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Cards de métrica */}
                {stats && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {cards.map(({ key, label, value, icon: Icon, color, pct: cardPct }) => (
                      <div key={key} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                        <Icon className={`w-4 h-4 ${color} mb-2`} />
                        <p className="text-2xl font-bold text-white">{value}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {label}
                          {cardPct !== undefined && <span className="text-neutral-600"> · {cardPct}%</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Gráfico de aberturas e cliques ao longo do tempo */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                  <h2 className="text-sm font-medium text-white mb-4">Aberturas e cliques ao longo do tempo</h2>
                  {dailySeries.length > 0 ? (
                    <ChartContainer config={CHART_CONFIG} className="aspect-auto h-[220px] w-full">
                      <LineChart data={dailySeries} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                        <XAxis
                          dataKey="date"
                          tick={{ fill: '#525252', fontSize: 10 }}
                          tickFormatter={fmtDate}
                          interval="preserveStartEnd"
                        />
                        <YAxis tick={{ fill: '#525252', fontSize: 10 }} allowDecimals={false} />
                        <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => fmtDate(String(v))} />} />
                        <Line
                          type="monotone"
                          dataKey="abertos"
                          stroke="var(--color-abertos)"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="clicados"
                          stroke="var(--color-clicados)"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ChartContainer>
                  ) : (
                    <p className="text-xs text-neutral-600 py-8 text-center">
                      Ainda não há aberturas ou cliques registrados.
                    </p>
                  )}
                </div>

                {/* Ranking de links clicados */}
                {links.length > 0 && (
                  <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-neutral-800">
                      <h2 className="text-sm font-medium text-white">Links mais clicados</h2>
                    </div>
                    <div className="p-4 space-y-2">
                      {links.map(({ link, count }) => {
                        const maxCount = links[0].count
                        const pctWidth = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0
                        return (
                          <div key={link} className="flex items-center gap-3">
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={link}
                              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 w-40 sm:w-56 truncate flex-shrink-0"
                            >
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{link}</span>
                            </a>
                            <div className="flex-1 bg-neutral-800 rounded-full h-1.5">
                              <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${pctWidth}%` }} />
                            </div>
                            <span className="text-xs text-neutral-500 w-8 text-right flex-shrink-0">{count}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Tabela de destinatários */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-neutral-800 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-sm font-medium text-white">Destinatários</h2>
                      <span className="text-xs text-neutral-500">
                        {filteredRecipients.length} de {recipients.length}
                      </span>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
                      <Input
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar por e-mail ou nome..."
                        className="pl-10 bg-neutral-950 border-neutral-700 text-white text-sm h-9"
                      />
                    </div>
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                      {RECIPIENT_STATUS_FILTERS.map((f) => (
                        <button
                          key={f.value}
                          onClick={() => setStatusFilter(f.value)}
                          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                            statusFilter === f.value
                              ? 'bg-orange-500 text-black border-orange-500'
                              : 'bg-neutral-900 text-neutral-400 border-neutral-700 hover:text-white'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-[440px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-neutral-800 sticky top-0 bg-neutral-900">
                          <th className="text-left px-4 py-2 text-neutral-500 font-medium">E-mail</th>
                          <th className="text-left px-4 py-2 text-neutral-500 font-medium">Nome</th>
                          <th className="text-left px-4 py-2 text-neutral-500 font-medium">Base</th>
                          <th className="text-left px-4 py-2 text-neutral-500 font-medium">Status</th>
                          <th className="text-left px-4 py-2 text-neutral-500 font-medium">Enviado em</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRecipients.map((r) => {
                          const meta = RECIPIENT_STATUS_META[r.status]
                          return (
                            <tr key={r.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                              <td className="px-4 py-2.5 text-neutral-300">{r.email}</td>
                              <td className="px-4 py-2.5 text-neutral-400">{r.nome || '—'}</td>
                              <td className="px-4 py-2.5 text-neutral-500">{r.source_base || '—'}</td>
                              <td className="px-4 py-2.5">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-xs ${meta.className}`}
                                  title={r.error || undefined}
                                >
                                  {meta.label}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-neutral-400 whitespace-nowrap">
                                {r.sent_at ? fmtDateTime(r.sent_at) : '—'}
                              </td>
                            </tr>
                          )
                        })}
                        {filteredRecipients.length === 0 && (
                          <tr>
                            <td colSpan={5} className="px-4 py-8 text-center text-neutral-600">
                              Nenhum destinatário encontrado.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>
    </AuthenticatedChrome>
  )
}
