'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Ban, ChevronDown, ChevronUp, Edit2, Mail, Trash2 } from 'lucide-react'
import { apiFetch } from '@/lib/api-client'
import type { CampaignStats, CampaignStatus, EmailCampaign } from '@/lib/email/types'

interface EmailCampaignCardProps {
  campaign: EmailCampaign
  onEdit: (campaign: EmailCampaign) => void
  onDelete: (id: string) => void
  onCancel: (id: string) => void
}

const STATUS_META: Record<CampaignStatus, { label: string; className: string }> = {
  rascunho: { label: 'Rascunho', className: 'bg-neutral-700/80 text-neutral-300 border-neutral-600' },
  agendada: { label: 'Agendada', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  enviando: { label: 'Enviando', className: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  enviada: { label: 'Enviada', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
  cancelada: { label: 'Cancelada', className: 'bg-neutral-700/80 text-neutral-400 border-neutral-600' },
  erro: { label: 'Erro', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
}

const TEMPLATE_LABELS: Record<string, string> = {
  anuncio: 'Anúncio',
  simples: 'Simples',
  evento: 'Evento',
}

const STATS_LABELS: Record<keyof CampaignStats, string> = {
  total: 'Total',
  pendente: 'Pendente',
  enviado: 'Enviado',
  entregue: 'Entregue',
  aberto: 'Aberto',
  clicado: 'Clicado',
  bounce: 'Bounce',
  spam: 'Spam',
  falha: 'Falha',
  descadastros: 'Descadastros',
}

export default function EmailCampaignCard({ campaign, onEdit, onDelete, onCancel }: EmailCampaignCardProps) {
  const [stats, setStats] = useState<CampaignStats | null>(null)
  const [showStats, setShowStats] = useState(false)
  const [statsLoading, setStatsLoading] = useState(false)

  const loadStats = async () => {
    setStatsLoading(true)
    try {
      const res = await apiFetch(`/api/email-campaigns/${campaign.id}/stats`)
      if (res.ok) {
        const data = await res.json()
        setStats(data.stats)
      }
    } catch {
      // silencioso — a linha de taxas/estatísticas fica indisponível
    } finally {
      setStatsLoading(false)
    }
  }

  // Entrega/abertura aparecem direto no card assim que a campanha é enviada.
  useEffect(() => {
    if (campaign.status === 'enviada' || campaign.status === 'enviando') loadStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.id, campaign.status])

  const toggleStats = () => {
    setShowStats((v) => !v)
    if (!stats) loadStats()
  }

  const fmt = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
          year: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      : null

  const meta = STATUS_META[campaign.status]
  const canEdit = campaign.status === 'rascunho' || campaign.status === 'agendada'
  const canCancel =
    campaign.status === 'rascunho' || campaign.status === 'agendada' || campaign.status === 'enviando'

  const deliveryRate = stats && stats.total > 0 ? Math.round((stats.entregue / stats.total) * 100) : null
  const openRate = stats && stats.total > 0 ? Math.round((stats.aberto / stats.total) * 100) : null

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Mail className="w-4 h-4 text-orange-400 flex-shrink-0" />
          <h3 className="font-semibold text-sm leading-snug truncate min-w-0">
            <Link
              href={`/email-marketing/${campaign.id}`}
              title={`Ver status detalhado de ${campaign.nome}`}
              className="text-white hover:text-orange-400 hover:underline transition-colors"
            >
              {campaign.nome}
            </Link>
          </h3>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border flex-shrink-0 ${meta.className}`}>
          {meta.label}
        </span>
      </div>

      <p className="text-xs text-neutral-500 truncate" title={campaign.subject}>
        {campaign.subject}
      </p>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-500">
        <span>{TEMPLATE_LABELS[campaign.template_key] ?? campaign.template_key}</span>
        <span className="text-neutral-700">·</span>
        <span>{campaign.total_recipients} destinatários</span>
        {campaign.status === 'agendada' && campaign.scheduled_at && (
          <>
            <span className="text-neutral-700">·</span>
            <span>Agendada para {fmt(campaign.scheduled_at)}</span>
          </>
        )}
        {campaign.status === 'enviada' && campaign.finished_at && (
          <>
            <span className="text-neutral-700">·</span>
            <span>Enviada em {fmt(campaign.finished_at)}</span>
          </>
        )}
      </div>

      {(campaign.status === 'enviada' || campaign.status === 'enviando') && (
        <div className="flex items-center gap-4 text-xs">
          <span className="text-neutral-400">
            Entrega: <strong className="text-white">{deliveryRate != null ? `${deliveryRate}%` : '—'}</strong>
          </span>
          <span className="text-neutral-400">
            Abertura: <strong className="text-white">{openRate != null ? `${openRate}%` : '—'}</strong>
          </span>
        </div>
      )}

      {/* Ações */}
      <div className="flex items-center gap-1 pt-2 border-t border-neutral-800 mt-1">
        {canEdit && (
          <button
            onClick={() => onEdit(campaign)}
            title="Editar"
            className="p-1.5 text-neutral-500 hover:text-white transition-colors rounded"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={toggleStats}
          title="Ver status"
          className="flex items-center gap-1 p-1.5 text-neutral-500 hover:text-blue-400 transition-colors rounded"
        >
          {showStats ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span className="text-xs">Status</span>
        </button>
        {canCancel && (
          <button
            onClick={() => onCancel(campaign.id)}
            title="Cancelar"
            className="p-1.5 text-neutral-500 hover:text-yellow-400 transition-colors rounded"
          >
            <Ban className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          onClick={() => onDelete(campaign.id)}
          title="Excluir"
          className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors rounded ml-auto"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Painel de status expandido */}
      {showStats && (
        <div className="pt-2 border-t border-neutral-800">
          {statsLoading && !stats ? (
            <p className="text-xs text-neutral-600">Carregando...</p>
          ) : stats ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-1 text-xs">
              {(Object.keys(STATS_LABELS) as Array<keyof CampaignStats>).map((key) => (
                <div key={key} className="flex items-center justify-between text-neutral-500">
                  <span>{STATS_LABELS[key]}</span>
                  <span className="text-white font-medium">{stats[key]}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-neutral-600">Sem dados de status ainda.</p>
          )}
        </div>
      )}
    </div>
  )
}
