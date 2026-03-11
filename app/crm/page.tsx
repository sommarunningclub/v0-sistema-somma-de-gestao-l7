'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Plus, RefreshCw, LayoutGrid, List, Filter, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CRMKanbanBoard } from '@/components/crm-kanban-board'
import { CRMLeadModal } from '@/components/crm-lead-modal'
import { CRM_STAGES } from '@/lib/crm-constants'
import type { CRMLead, CRMStage } from '@/lib/services/crm'
import { getSession } from '@/components/protected-route'

export default function CRMPage() {
  const [leads, setLeads] = useState<CRMLead[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStage, setFilterStage] = useState<CRMStage | 'all'>('all')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<CRMLead | null>(null)
  const [isNewLead, setIsNewLead] = useState(false)
  const [newLeadStage, setNewLeadStage] = useState<CRMStage>('novo_lead')

  // View state - default to list on mobile
  const [view, setView] = useState<'kanban' | 'list'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return 'list'
    return 'kanban'
  })

  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/crm')
      if (res.ok) {
        const data = await res.json()
        setLeads(data)
      }
    } catch (err) {
      console.error('[v0] Error fetching CRM leads:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  const handleRefresh = () => {
    setRefreshing(true)
    fetchLeads()
  }

  // Filter leads
  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      !search ||
      lead.name.toLowerCase().includes(search.toLowerCase()) ||
      lead.company_name.toLowerCase().includes(search.toLowerCase()) ||
      lead.email.toLowerCase().includes(search.toLowerCase()) ||
      lead.phone.includes(search)

    const matchesStage = filterStage === 'all' || lead.stage === filterStage

    return matchesSearch && matchesStage
  })

  // Card click
  const handleCardClick = (lead: CRMLead) => {
    setSelectedLead(lead)
    setIsNewLead(false)
    setModalOpen(true)
  }

  // New lead
  const handleNewLead = (stage: CRMStage) => {
    setSelectedLead(null)
    setIsNewLead(true)
    setNewLeadStage(stage)
    setModalOpen(true)
  }

  // Move card
  const handleMoveCard = async (leadId: string, newStage: CRMStage) => {
    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, stage: newStage } : l))
    )

    try {
      const res = await fetch(`/api/crm/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      })

      if (!res.ok) {
        // Revert on error
        fetchLeads()
      }
    } catch {
      fetchLeads()
    }
  }

  // Save lead
  const handleSave = async (leadData: Partial<CRMLead>) => {
    const session = getSession()

    if (isNewLead) {
      const res = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...leadData,
          stage: leadData.stage || newLeadStage,
          created_by: session?.full_name || session?.email || 'unknown',
        }),
      })

      if (res.ok) {
        fetchLeads()
      }
    } else if (leadData.id) {
      const res = await fetch(`/api/crm/${leadData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadData),
      })

      if (res.ok) {
        fetchLeads()
      }
    }
  }

  // Delete lead
  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/crm/${id}`, { method: 'DELETE' })
    if (res.ok) {
      fetchLeads()
    }
  }

  // Stats
  const stats = CRM_STAGES.map((stage) => ({
    ...stage,
    count: leads.filter((l) => l.stage === stage.id).length,
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-3" />
          <p className="text-neutral-400 text-sm">Carregando CRM...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-neutral-950">
      {/* Header */}
      <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-neutral-800 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-wide">CRM</h1>
            <p className="text-xs text-neutral-500 mt-0.5">Gestão de Parcerias B2B</p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* View Toggle */}
            <div className="flex bg-neutral-800 rounded-lg p-1 border border-neutral-700">
              <button
                onClick={() => setView('kanban')}
                className={`p-2 sm:p-2.5 rounded-md transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center ${
                  view === 'kanban' ? 'bg-orange-500 text-white shadow-lg' : 'text-neutral-400 hover:text-white active:bg-neutral-700'
                }`}
                title="Kanban"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setView('list')}
                className={`p-2 sm:p-2.5 rounded-md transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center ${
                  view === 'list' ? 'bg-orange-500 text-white shadow-lg' : 'text-neutral-400 hover:text-white active:bg-neutral-700'
                }`}
                title="Lista"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2.5 text-neutral-400 hover:text-orange-500 active:text-orange-500 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-neutral-800/50 active:bg-neutral-800"
              title="Atualizar"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            <Button
              onClick={() => handleNewLead('novo_lead')}
              className="bg-orange-500 hover:bg-orange-600 text-white text-xs sm:text-sm font-bold min-h-[44px] px-3 sm:px-4"
              size="sm"
            >
              <Plus className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">NOVO LEAD</span>
              <span className="sm:hidden">NOVO</span>
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 sm:-mx-6 px-4 sm:px-6 scrollbar-hide">
          {stats.map((stage) => (
            <button
              key={stage.id}
              onClick={() => setFilterStage(filterStage === stage.id ? 'all' : stage.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:py-2.5 rounded-lg border transition-colors text-xs sm:text-sm font-medium min-h-[44px] ${
                filterStage === stage.id
                  ? 'bg-orange-500/20 border-orange-500/50 text-orange-400 shadow-lg'
                  : 'bg-neutral-800/50 border-neutral-800 text-neutral-400 hover:border-neutral-600 active:bg-neutral-700'
              }`}
            >
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${stage.color}`} />
              <span>{stage.label}</span>
              <span className="font-bold text-white ml-0.5">{stage.count}</span>
            </button>
          ))}
          {filterStage !== 'all' && (
            <button
              onClick={() => setFilterStage('all')}
              className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-2 sm:py-2.5 text-xs sm:text-sm text-neutral-500 hover:text-white hover:bg-neutral-800/50 active:bg-neutral-700 transition-colors min-h-[44px] rounded-lg font-medium"
            >
              <X className="w-4 h-4" />
              Limpar
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, empresa..."
            className="pl-10 bg-neutral-800 border-neutral-700 text-white text-sm h-11 sm:h-10 rounded-lg px-3.5"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden px-4 py-4 sm:px-6 sm:py-6">
        {view === 'kanban' ? (
          <CRMKanbanBoard
            leads={filteredLeads}
            onCardClick={handleCardClick}
            onMoveCard={handleMoveCard}
            onNewLead={handleNewLead}
          />
        ) : (
          /* List View */
          <div className="overflow-auto h-full rounded-lg border border-neutral-800">
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-900/50 sticky top-0">
                  <th className="text-left text-xs font-semibold text-neutral-400 px-3 sm:px-4 py-3 sm:py-3.5">NOME</th>
                  <th className="text-left text-xs font-semibold text-neutral-400 px-3 sm:px-4 py-3 sm:py-3.5 hidden md:table-cell">EMPRESA</th>
                  <th className="text-left text-xs font-semibold text-neutral-400 px-3 sm:px-4 py-3 sm:py-3.5 hidden lg:table-cell">E-MAIL</th>
                  <th className="text-left text-xs font-semibold text-neutral-400 px-3 sm:px-4 py-3 sm:py-3.5 hidden lg:table-cell">TELEFONE</th>
                  <th className="text-left text-xs font-semibold text-neutral-400 px-3 sm:px-4 py-3 sm:py-3.5">ETAPA</th>
                  <th className="text-left text-xs font-semibold text-neutral-400 px-3 sm:px-4 py-3 sm:py-3.5 hidden sm:table-cell">DATA</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map((lead) => {
                  const stageConfig = CRM_STAGES.find((s) => s.id === lead.stage)
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => handleCardClick(lead)}
                      className="border-b border-neutral-800/50 hover:bg-neutral-800/50 active:bg-neutral-800 cursor-pointer transition-colors min-h-[48px]"
                    >
                      <td className="px-3 sm:px-4 py-3 sm:py-3.5 min-h-[48px] flex items-center">
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-white block truncate">{lead.name}</span>
                          <span className="text-xs text-neutral-500 md:hidden block truncate">{lead.company_name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-3 sm:py-3.5 hidden md:table-cell">
                        <span className="text-sm text-neutral-400 truncate block">{lead.company_name || '—'}</span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 sm:py-3.5 hidden lg:table-cell">
                        <span className="text-sm text-neutral-400 truncate block">{lead.email || '—'}</span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 sm:py-3.5 hidden lg:table-cell">
                        <span className="text-sm text-neutral-400 truncate block">{lead.phone || '—'}</span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 sm:py-3.5">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${stageConfig?.color} text-white`}>
                          <span className="hidden sm:inline">{stageConfig?.label}</span>
                          <span className="sm:hidden text-xs">{stageConfig?.label?.split(' ')[0]}</span>
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-3 sm:py-3.5 hidden sm:table-cell">
                        <span className="text-xs text-neutral-500">
                          {new Date(lead.created_at).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {filteredLeads.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-neutral-500 text-sm">
                      Nenhum lead encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <CRMLeadModal
          lead={isNewLead ? ({ stage: newLeadStage } as CRMLead) : selectedLead}
          isNew={isNewLead}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
