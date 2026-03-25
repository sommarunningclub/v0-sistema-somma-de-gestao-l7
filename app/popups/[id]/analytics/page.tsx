// app/popups/[id]/analytics/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { ArrowLeft, BarChart2, MousePointer, Smartphone, Eye, TrendingUp, X } from 'lucide-react'
import { useRouter, useParams } from 'next/navigation'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { Popup } from '@/lib/services/popups'

interface Stats {
  total_clicks: number
  clicks_today: number
  mobile_clicks: number
  desktop_clicks: number
  total_views: number
  total_dismissals: number
  ctr: number
  daily_series: { date: string; clicks: number; views: number; dismissals: number }[]
  recent_events: {
    id: string
    clicked_at: string
    page: string
    device_type: string
    user_session_id: string
    referrer: string
    utm_source: string
    browser: string
    viewport_width: number | null
  }[]
  referrer_breakdown: { referrer: string; count: number }[]
  browser_breakdown: { browser: string; count: number }[]
  utm_source_breakdown: { utm_source: string; count: number }[]
}

function getReferrerHost(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export default function PopupAnalyticsPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [popup, setPopup] = useState<Popup | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      try {
        const [popupRes, statsRes] = await Promise.all([
          fetch(`/api/popups/${id}`),
          fetch(`/api/popups/${id}/stats`),
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
    }
    load()
  }, [id])

  const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const fmtDateTime = (d: string) =>
    new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

  const mobileRate = stats
    ? stats.total_clicks > 0
      ? Math.round((stats.mobile_clicks / stats.total_clicks) * 100)
      : 0
    : 0

  return (
    <div className="flex flex-col h-full bg-black overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-neutral-800">
        <button
          onClick={() => router.push('/popups')}
          className="p-1.5 text-neutral-500 hover:text-white transition-colors rounded"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold text-white truncate">
            {popup?.title || 'Analytics'}
          </h1>
          {popup && (
            <span
              className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                popup.is_active
                  ? 'bg-green-500/20 text-green-400 border-green-500/30'
                  : 'bg-neutral-700 text-neutral-400 border-neutral-600'
              }`}
            >
              {popup.is_active ? 'Ativo' : 'Inativo'}
            </span>
          )}
        </div>
        <BarChart2 className="w-5 h-5 text-orange-400 flex-shrink-0" />
      </div>

      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-20 bg-neutral-900 rounded-xl animate-pulse" />
            ))}
          </div>
          <div className="h-48 bg-neutral-900 rounded-xl animate-pulse" />
        </div>
      ) : stats ? (
        <div className="p-4 space-y-5">
          {/* Metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Total de cliques', value: stats.total_clicks, icon: MousePointer, color: 'text-orange-400' },
              { label: 'Impressões (30d)', value: stats.total_views, icon: Eye, color: 'text-blue-400' },
              { label: 'CTR', value: `${stats.ctr}%`, icon: TrendingUp, color: 'text-green-400' },
              { label: 'Fechamentos', value: stats.total_dismissals, icon: X, color: 'text-red-400' },
              { label: '% Mobile', value: `${mobileRate}%`, icon: Smartphone, color: 'text-purple-400' },
              { label: 'Cliques hoje', value: stats.clicks_today, icon: MousePointer, color: 'text-yellow-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
                <Icon className={`w-4 h-4 ${color} mb-2`} />
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
            <h2 className="text-sm font-medium text-white mb-4">Cliques e impressões — últimos 30 dias</h2>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.daily_series} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: '#525252', fontSize: 10 }}
                  tickFormatter={fmtDate}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fill: '#525252', fontSize: 10 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#171717', border: '1px solid #262626', borderRadius: 8 }}
                  labelStyle={{ color: '#a3a3a3', fontSize: 11 }}
                  itemStyle={{ fontSize: 12 }}
                  labelFormatter={fmtDate}
                />
                <Bar dataKey="views" fill="#3b82f6" radius={[3, 3, 0, 0]} name="Impressões" />
                <Bar dataKey="clicks" fill="#f97316" radius={[3, 3, 0, 0]} name="Cliques" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Referrer breakdown */}
          {stats.referrer_breakdown.length > 0 && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-800">
                <h2 className="text-sm font-medium text-white">Origens de tráfego</h2>
              </div>
              <div className="p-4 space-y-2">
                {stats.referrer_breakdown.map(({ referrer, count }) => {
                  const maxCount = stats.referrer_breakdown[0].count
                  const pct = Math.round((count / maxCount) * 100)
                  return (
                    <div key={referrer} className="flex items-center gap-3">
                      <span className="text-xs text-neutral-400 w-32 truncate flex-shrink-0" title={referrer}>{referrer}</span>
                      <div className="flex-1 bg-neutral-800 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-neutral-500 w-8 text-right flex-shrink-0">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Browser breakdown */}
          {stats.browser_breakdown.length > 0 && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-800">
                <h2 className="text-sm font-medium text-white">Navegadores</h2>
              </div>
              <div className="p-4 space-y-2">
                {stats.browser_breakdown.map(({ browser, count }) => {
                  const maxCount = stats.browser_breakdown[0].count
                  const pct = Math.round((count / maxCount) * 100)
                  return (
                    <div key={browser} className="flex items-center gap-3">
                      <span className="text-xs text-neutral-400 w-20 flex-shrink-0">{browser}</span>
                      <div className="flex-1 bg-neutral-800 rounded-full h-1.5">
                        <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-neutral-500 w-8 text-right flex-shrink-0">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Recent events */}
          {stats.recent_events.length > 0 && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-neutral-800">
                <h2 className="text-sm font-medium text-white">Cliques recentes</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-neutral-800">
                      <th className="text-left px-4 py-2 text-neutral-500 font-medium">Data/hora</th>
                      <th className="text-left px-4 py-2 text-neutral-500 font-medium">Página</th>
                      <th className="text-left px-4 py-2 text-neutral-500 font-medium">Dispositivo</th>
                      <th className="text-left px-4 py-2 text-neutral-500 font-medium">Navegador</th>
                      <th className="text-left px-4 py-2 text-neutral-500 font-medium">Origem</th>
                      <th className="text-left px-4 py-2 text-neutral-500 font-medium">Sessão</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recent_events.map((ev) => (
                      <tr key={ev.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/30">
                        <td className="px-4 py-2.5 text-neutral-300 whitespace-nowrap">{fmtDateTime(ev.clicked_at)}</td>
                        <td className="px-4 py-2.5 text-neutral-400">{ev.page || '/'}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-xs ${ev.device_type === 'mobile' ? 'text-green-400 bg-green-500/10' : 'text-blue-400 bg-blue-500/10'}`}>
                            {ev.device_type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-neutral-400">{ev.browser || '—'}</td>
                        <td className="px-4 py-2.5 text-neutral-500 max-w-[120px] truncate" title={ev.referrer}>
                          {ev.referrer ? getReferrerHost(ev.referrer) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-neutral-600 font-mono">
                          {ev.user_session_id.slice(0, 8)}…
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
