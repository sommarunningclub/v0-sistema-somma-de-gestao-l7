'use client'

import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { PageLoading } from '@/components/ui/page-loading'
import { ErrorBanner } from '@/components/ui/error-banner'
import type { AudienceKey, AudienceSelection } from '@/lib/email/types'
import type { AudienceSource } from '@/lib/email/audiences'

interface EventoOption {
  id: string
  titulo: string
  data_evento: string
}

interface EmailAudiencePickerProps {
  value: AudienceSelection
  onChange: (next: AudienceSelection) => void
  onTotalChange?: (total: number) => void
}

export default function EmailAudiencePicker({ value, onChange, onTotalChange }: EmailAudiencePickerProps) {
  const [sources, setSources] = useState<AudienceSource[]>([])
  const [eventos, setEventos] = useState<EventoOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [previewLoading, setPreviewLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [porBase, setPorBase] = useState<Record<string, number>>({})

  const loadSources = async () => {
    setLoading(true)
    try {
      const [srcRes, evRes] = await Promise.all([
        apiFetch('/api/email-audiences/preview'),
        apiFetch('/api/eventos/ativos'),
      ])
      if (!srcRes.ok) throw new Error('Erro ao carregar bases')
      const srcData = await srcRes.json()
      setSources(srcData.sources ?? [])

      if (evRes.ok) {
        const evData = await evRes.json()
        const merged = [...(evData.proximos_eventos ?? []), ...(evData.historico ?? [])]
        setEventos(
          merged.map((e: { id: string; titulo: string; data_evento: string }) => ({
            id: e.id,
            titulo: e.titulo,
            data_evento: e.data_evento,
          })),
        )
      }
      setError(null)
    } catch {
      setError('Erro ao carregar bases de audiência')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSources()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recalcula a contagem ao vivo, com debounce de 500ms, sempre que a seleção muda.
  useEffect(() => {
    if (value.bases.length === 0) {
      setTotal(0)
      setPorBase({})
      setPreviewLoading(false)
      onTotalChange?.(0)
      return
    }

    setPreviewLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await apiFetch('/api/email-audiences/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(value),
        })
        if (!res.ok) return
        const data = await res.json()
        setTotal(data.total ?? 0)
        setPorBase(data.porBase ?? {})
        onTotalChange?.(data.total ?? 0)
      } catch {
        // silencioso — mantém a última contagem conhecida
      } finally {
        setPreviewLoading(false)
      }
    }, 500)

    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(value)])

  const toggleBase = (key: AudienceKey) => {
    const exists = value.bases.some((b) => b.key === key)
    const bases = exists
      ? value.bases.filter((b) => b.key !== key)
      : [...value.bases, { key, filtros: {} }]
    onChange({ bases })
  }

  const setFilter = (key: AudienceKey, filterKey: string, filterValue: string) => {
    const bases = value.bases.map((b) =>
      b.key === key ? { ...b, filtros: { ...b.filtros, [filterKey]: filterValue } } : b,
    )
    onChange({ bases })
  }

  if (loading) return <PageLoading label="Carregando bases de audiência..." />
  if (error) return <ErrorBanner message={error} onRetry={loadSources} />

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {sources.map((source) => {
          const base = value.bases.find((b) => b.key === source.key)
          const selected = !!base
          return (
            <div
              key={source.key}
              className={`border rounded-lg p-3 transition-colors ${
                selected ? 'border-orange-500 bg-orange-500/5' : 'border-neutral-700 bg-neutral-900'
              }`}
            >
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => toggleBase(source.key)}
                  className="accent-orange-500"
                />
                <span className="text-sm font-medium text-white">{source.label}</span>
                {selected && porBase[source.key] != null && (
                  <span className="text-xs text-neutral-500 ml-auto">
                    {porBase[source.key]} nesta base
                  </span>
                )}
              </label>

              {selected && source.filters.length > 0 && (
                <div className="mt-3 pl-6 space-y-2.5 border-l border-neutral-800">
                  {source.filters.map((f) => (
                    <div key={f.key} className="pl-3">
                      <label className="block text-xs text-neutral-400 mb-1">{f.label}</label>
                      {f.kind === 'select' && (
                        <select
                          value={base?.filtros[f.key] ?? ''}
                          onChange={(e) => setFilter(source.key, f.key, e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors"
                        >
                          <option value="">Todos</option>
                          {f.options?.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      )}
                      {f.kind === 'evento' && (
                        <select
                          value={base?.filtros[f.key] ?? ''}
                          onChange={(e) => setFilter(source.key, f.key, e.target.value)}
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500 transition-colors"
                        >
                          <option value="">Todos os eventos</option>
                          {eventos.map((ev) => (
                            <option key={ev.id} value={ev.id}>
                              {ev.titulo} —{' '}
                              {new Date(ev.data_evento).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: '2-digit',
                              })}
                            </option>
                          ))}
                        </select>
                      )}
                      {f.kind === 'text' && (
                        <input
                          type="text"
                          value={base?.filtros[f.key] ?? ''}
                          onChange={(e) => setFilter(source.key, f.key, e.target.value)}
                          placeholder="Deixe em branco para todos"
                          className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-orange-500 transition-colors"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-4 flex items-start gap-3">
        <Users className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-semibold">
            {previewLoading ? 'Calculando...' : `${total} destinatários únicos`}
          </p>
          <p className="text-xs text-neutral-500 mt-0.5">
            Já descontados os duplicados e os descadastrados.
          </p>
          {Object.keys(porBase).length > 0 && (
            <p className="text-xs text-neutral-600 mt-1.5">
              {Object.entries(porBase)
                .map(([key, count]) => `${sources.find((s) => s.key === key)?.label ?? key}: ${count}`)
                .join(' · ')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
