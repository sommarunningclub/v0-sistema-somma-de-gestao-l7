// app/email-marketing/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Mail, Plus, RefreshCw, Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { confirmAction } from '@/components/somma'
import { matchesTextSearch } from '@/lib/search-utils'
import EmailCampaignCard from '@/components/email-campaign-card'
import EmailCampaignModal from '@/components/email-campaign-modal'
import type { CampaignStatus, EmailCampaign } from '@/lib/email/types'
import { apiFetch } from '@/lib/api-client'
import { ErrorBanner } from '@/components/ui/error-banner'
import { PageLoading } from '@/components/ui/page-loading'

const STATUS_FILTERS: Array<{ value: CampaignStatus | 'todas'; label: string }> = [
  { value: 'todas', label: 'Todas' },
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'agendada', label: 'Agendada' },
  { value: 'enviando', label: 'Enviando' },
  { value: 'enviada', label: 'Enviada' },
  { value: 'cancelada', label: 'Cancelada' },
  { value: 'erro', label: 'Erro' },
]

export default function EmailMarketingPage() {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<EmailCampaign | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'todas'>('todas')

  const loadCampaigns = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await apiFetch('/api/email-campaigns')
      if (!res.ok) throw new Error('Erro ao carregar')
      const data = await res.json()
      setCampaigns(data)
      setError(null)
    } catch {
      setError('Erro ao carregar campanhas')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadCampaigns()
  }, [loadCampaigns])

  const handleDelete = async (id: string) => {
    const campaign = campaigns.find((c) => c.id === id)
    const ok = await confirmAction({
      title: 'Excluir campanha?',
      description: 'A campanha e o histórico de destinatários são apagados. Não dá para desfazer.',
      detail: campaign?.nome,
      confirmLabel: 'Excluir',
      tone: 'danger',
    })
    if (!ok) return

    try {
      const res = await apiFetch(`/api/email-campaigns/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        // Ex.: 409 para campanha 'enviando' — apiFetch não lança em respostas
        // não-2xx, então sem esse check o card sumiria da lista mesmo com a
        // exclusão rejeitada pelo servidor.
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Erro ao excluir campanha')
        return
      }
      setCampaigns((prev) => prev.filter((c) => c.id !== id))
    } catch {
      setError('Erro ao excluir campanha')
    }
  }

  const handleCancel = async (id: string) => {
    const campaign = campaigns.find((c) => c.id === id)
    const ok = await confirmAction({
      title: 'Cancelar campanha?',
      description: 'Quem já recebeu o e-mail não é afetado. Os destinatários pendentes deixam de receber.',
      detail: campaign?.nome,
      confirmLabel: 'Cancelar campanha',
      cancelLabel: 'Voltar',
    })
    if (!ok) return

    try {
      const res = await apiFetch(`/api/email-campaigns/${id}/cancel`, { method: 'POST' })
      if (!res.ok) throw new Error('Erro ao cancelar')
      loadCampaigns(true)
    } catch {
      setError('Erro ao cancelar campanha')
    }
  }

  const openEdit = (campaign: EmailCampaign) => {
    setEditingCampaign(campaign)
    setShowModal(true)
  }

  const openCreate = () => {
    setEditingCampaign(null)
    setShowModal(true)
  }

  const handleSaved = () => {
    loadCampaigns(true)
  }

  const filteredCampaigns = campaigns
    .filter((c) => statusFilter === 'todas' || c.status === statusFilter)
    .filter((c) => matchesTextSearch(searchTerm, [c.nome, c.subject]))

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-orange-400" />
          <h1 className="text-lg font-semibold text-white">E-mail Marketing</h1>
          {campaigns.length > 0 && (
            <span className="text-xs text-neutral-500 bg-neutral-800 px-2 py-0.5 rounded-full">
              {campaigns.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadCampaigns(true)}
            disabled={refreshing}
            className="p-2 text-neutral-500 hover:text-white transition-colors rounded-lg"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-400 text-black font-semibold px-3 py-2 rounded-lg text-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova campanha
          </button>
        </div>
      </div>

      {/* Search + status filter */}
      {campaigns.length > 0 && (
        <div className="px-4 pt-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nome ou assunto..."
              className="pl-10 pr-10 bg-neutral-900 border-neutral-700 text-white"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                aria-label="Limpar busca"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {STATUS_FILTERS.map((f) => (
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
      )}

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4">
          <ErrorBanner message={error} onRetry={() => loadCampaigns()} />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <PageLoading label="Carregando campanhas..." />
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
            <Mail className="w-12 h-12 text-neutral-700" />
            <div>
              <p className="text-neutral-400 font-medium">Nenhuma campanha criada</p>
              <p className="text-neutral-600 text-sm mt-1">
                Crie sua primeira campanha de e-mail marketing
              </p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-400 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Criar primeira campanha
            </button>
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-center">
            <p className="text-neutral-400 font-medium">Nenhuma campanha encontrada</p>
            <p className="text-neutral-600 text-sm">Tente outro termo de busca ou filtro</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCampaigns.map((campaign) => (
              <EmailCampaignCard
                key={campaign.id}
                campaign={campaign}
                onEdit={openEdit}
                onDelete={handleDelete}
                onCancel={handleCancel}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <EmailCampaignModal
          campaign={editingCampaign}
          onClose={() => {
            setShowModal(false)
            setEditingCampaign(null)
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
