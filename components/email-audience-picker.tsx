'use client'

import { useEffect, useRef, useState } from 'react'
import { Users } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import { PageLoading } from '@/components/ui/page-loading'
import { ErrorBanner } from '@/components/ui/error-banner'
import { EmailIndividualPicker } from '@/components/email-individual-picker'
import type { AudienceIndividual, AudienceKey, AudienceSelection, EmailCampaign } from '@/lib/email/types'
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
  /** Campanha em edição — não pode aparecer como opção de exclusão de si mesma. */
  currentCampaignId?: string | null
}

/**
 * Só campanhas que podem ter abertura. 'rascunho' e 'cancelada' nunca saem,
 * então excluir os abridores delas seria excluir ninguém; 'agendada' entra
 * porque é exatamente o caso da régua montada de uma vez (a etapa 2 é criada
 * antes de a etapa 1 ter disparado).
 */
const STATUS_COM_ABERTURA = new Set(['agendada', 'enviando', 'enviada'])

export default function EmailAudiencePicker({
  value,
  onChange,
  onTotalChange,
  currentCampaignId,
}: EmailAudiencePickerProps) {
  const [sources, setSources] = useState<AudienceSource[]>([])
  const [eventos, setEventos] = useState<EventoOption[]>([])
  const [campanhas, setCampanhas] = useState<EmailCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [previewLoading, setPreviewLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [porBase, setPorBase] = useState<Record<string, number>>({})
  const [excluidosPorAbertura, setExcluidosPorAbertura] = useState(0)
  const [excluidosPorNaoAbertura, setExcluidosPorNaoAbertura] = useState(0)
  // Gera um "número de série" por requisição de preview disparada, para
  // descartar respostas desatualizadas que cheguem fora de ordem (ex.: o
  // usuário marca a base A, espera o debounce disparar, depois marca a base
  // B antes da resposta de A voltar — se a resposta de A chegar DEPOIS da de
  // B, não pode sobrescrever a contagem já atualizada).
  const requestIdRef = useRef(0)

  const loadSources = async () => {
    setLoading(true)
    try {
      const [srcRes, evRes, campRes] = await Promise.all([
        apiFetch('/api/email-audiences/preview'),
        apiFetch('/api/eventos/ativos'),
        // Best-effort: a exclusão por abertura é opcional, e derrubar a tela
        // inteira de audiência porque a listagem de campanhas falhou seria
        // trocar um recurso a mais por um recurso a menos.
        apiFetch('/api/email-campaigns').catch(() => null),
      ])
      if (!srcRes.ok) throw new Error('Erro ao carregar bases')
      const srcData = await srcRes.json()
      setSources(srcData.sources ?? [])

      if (campRes?.ok) {
        const campData = (await campRes.json()) as EmailCampaign[]
        setCampanhas(
          (campData ?? []).filter(
            (c) => STATUS_COM_ABERTURA.has(c.status) && c.id !== currentCampaignId,
          ),
        )
      }

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
    if (value.bases.length === 0 && (value.individuais ?? []).length === 0) {
      requestIdRef.current += 1 // invalida qualquer requisição em voo
      setTotal(0)
      setPorBase({})
      setExcluidosPorAbertura(0)
      setExcluidosPorNaoAbertura(0)
      setPreviewLoading(false)
      onTotalChange?.(0)
      return
    }

    setPreviewLoading(true)
    const timer = setTimeout(async () => {
      // Captura o número de série ANTES do fetch — se outra requisição
      // disparar enquanto esta está em voo, `requestIdRef.current` avança e
      // essa comparação abaixo passa a falhar, então a resposta é descartada.
      const requestId = ++requestIdRef.current
      try {
        const res = await apiFetch('/api/email-audiences/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(value),
        })
        const data = res.ok ? await res.json() : null
        if (requestId !== requestIdRef.current) return // resposta desatualizada — ignora
        if (!data) return
        setTotal(data.total ?? 0)
        setPorBase(data.porBase ?? {})
        setExcluidosPorAbertura(data.excluidosPorAbertura ?? 0)
        setExcluidosPorNaoAbertura(data.excluidosPorNaoAbertura ?? 0)
        onTotalChange?.(data.total ?? 0)
      } catch {
        // silencioso — mantém a última contagem conhecida
      } finally {
        // Só a requisição mais recente pode encerrar o estado de carregamento
        // — senão uma resposta lenta e desatualizada poderia "destravar" a UI
        // antes da resposta de verdade (a mais nova) voltar.
        if (requestId === requestIdRef.current) setPreviewLoading(false)
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
    onChange({ ...value, bases })
  }

  const setFilter = (key: AudienceKey, filterKey: string, filterValue: string) => {
    const bases = value.bases.map((b) =>
      b.key === key ? { ...b, filtros: { ...b.filtros, [filterKey]: filterValue } } : b,
    )
    onChange({ ...value, bases })
  }

  const setIndividuais = (individuais: AudienceIndividual[]) => {
    onChange({ ...value, individuais })
  }

  const toggleExclusaoAbertura = (campaignId: string) => {
    const atual = value.excluir_abertos_de ?? []
    const excluir_abertos_de = atual.includes(campaignId)
      ? atual.filter((id) => id !== campaignId)
      : [...atual, campaignId]
    onChange({ ...value, excluir_abertos_de })
  }

  const toggleSomenteAbertura = (campaignId: string) => {
    const atual = value.somente_abertos_de ?? []
    const somente_abertos_de = atual.includes(campaignId)
      ? atual.filter((id) => id !== campaignId)
      : [...atual, campaignId]
    onChange({ ...value, somente_abertos_de })
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

      <div className="space-y-2">
        <p className="text-sm font-medium text-white">Ou envie para pessoas específicas</p>
        <EmailIndividualPicker value={value.individuais ?? []} onChange={setIndividuais} />
      </div>

      {campanhas.length > 0 && (
        <div className="space-y-2" role="group" aria-label="Não enviar para quem já abriu">
          <p className="text-sm font-medium text-white">Não enviar para quem já abriu</p>
          <p className="text-xs text-neutral-500">
            Para reenviar só para quem não abriu. A conta é feita na hora do disparo, então dá para
            agendar a régua inteira de uma vez.
          </p>
          <div className="space-y-1.5">
            {campanhas.map((c) => {
              const marcada = (value.excluir_abertos_de ?? []).includes(c.id)
              return (
                <label
                  key={c.id}
                  className={`flex items-center gap-2.5 border rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                    marcada ? 'border-orange-500 bg-orange-500/5' : 'border-neutral-700 bg-neutral-900'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={marcada}
                    onChange={() => toggleExclusaoAbertura(c.id)}
                    className="accent-orange-500"
                  />
                  <span className="text-sm text-white truncate">{c.nome}</span>
                  <span className="text-xs text-neutral-500 ml-auto flex-shrink-0">{c.status}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {campanhas.length > 0 && (
        <div className="space-y-2" role="group" aria-label="Enviar só para quem já abriu">
          <p className="text-sm font-medium text-white">Enviar só para quem já abriu</p>
          <p className="text-xs text-neutral-500">
            Para falar só com quem demonstrou interesse: recebe quem abriu ou clicou em pelo menos
            uma das marcadas. Também é calculado na hora do disparo.
          </p>
          <div className="space-y-1.5">
            {campanhas.map((c) => {
              const marcada = (value.somente_abertos_de ?? []).includes(c.id)
              return (
                <label
                  key={c.id}
                  className={`flex items-center gap-2.5 border rounded-lg px-3 py-2 cursor-pointer transition-colors ${
                    marcada ? 'border-orange-500 bg-orange-500/5' : 'border-neutral-700 bg-neutral-900'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={marcada}
                    onChange={() => toggleSomenteAbertura(c.id)}
                    className="accent-orange-500"
                  />
                  <span className="text-sm text-white truncate">{c.nome}</span>
                  <span className="text-xs text-neutral-500 ml-auto flex-shrink-0">{c.status}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-neutral-700 bg-neutral-900 p-4 flex items-start gap-3">
        <Users className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white font-semibold">
            {previewLoading ? 'Calculando...' : `${total} destinatários únicos`}
          </p>
          <p className="text-xs text-neutral-500 mt-0.5">
            Já descontados os duplicados e os descadastrados.
          </p>
          {(value.excluir_abertos_de ?? []).length > 0 && (
            <p className="text-xs text-orange-400/80 mt-1">
              {excluidosPorAbertura} já abriram uma das campanhas marcadas e ficaram de fora. O
              número final é recalculado na hora do disparo.
            </p>
          )}
          {(value.somente_abertos_de ?? []).length > 0 && (
            <p className="text-xs text-orange-400/80 mt-1">
              {excluidosPorNaoAbertura} não abriram nenhuma das campanhas marcadas e ficaram de fora.
              Enquanto elas não forem enviadas, a contagem fica em zero.
            </p>
          )}
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
