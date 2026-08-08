'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Handshake,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CRMKanbanBoard } from '@/components/crm-kanban-board'
import { CRMLeadModal } from '@/components/crm-lead-modal'
import { STAGE_TONE, stageLabel } from '@/components/crm-lead-card'
import {
  CardListSkeleton,
  EmptyState,
  MobileRecordCard,
  NoResultsState,
  PageHeader,
  PageShell,
  SegmentedControl,
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
  Toolbar,
  SearchInput,
  notify,
} from '@/components/somma'
import { CRM_STAGES } from '@/lib/crm-constants'
import type { CRMLead, CRMStage } from '@/lib/services/crm'
import { getSession } from '@/components/protected-route'
import { matchesTextSearch } from '@/lib/search-utils'
import { apiFetch } from '@/lib/api-client'
import { ErrorBanner } from '@/components/ui/error-banner'

type CRMView = 'kanban' | 'list'

export default function CRMPage() {
  const [leads, setLeads] = useState<CRMLead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStage, setFilterStage] = useState<CRMStage | 'all'>('all')

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<CRMLead | null>(null)
  const [isNewLead, setIsNewLead] = useState(false)
  const [newLeadStage, setNewLeadStage] = useState<CRMStage>('novo_lead')

  // View state - default to list on mobile
  const [view, setView] = useState<CRMView>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return 'list'
    return 'kanban'
  })

  const fetchLeads = useCallback(async () => {
    try {
      const res = await apiFetch('/api/crm')
      if (res.ok) {
        const data = await res.json()
        setLeads(data)
        setError(null)
      } else {
        const body = await res.json().catch(() => ({}))
        setError(body.error || 'Erro ao carregar leads')
      }
    } catch (err) {
      console.error('[v0] Error fetching CRM leads:', err)
      setError('Erro de conexão ao carregar leads')
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
    const matchesSearch = matchesTextSearch(search, [
      lead.name,
      lead.company_name,
      lead.email,
      lead.phone,
      lead.cnpj,
    ])
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
      const res = await apiFetch(`/api/crm/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: newStage }),
      })

      if (!res.ok) {
        // Revert on error
        notify.error('Não foi possível mover o lead', {
          description: 'A alteração de fase não foi salva.',
        })
        fetchLeads()
      }
    } catch {
      notify.error('Erro de conexão ao mover o lead')
      fetchLeads()
    }
  }

  // Save lead
  const handleSave = async (leadData: Partial<CRMLead>) => {
    const session = getSession()

    if (isNewLead) {
      const res = await apiFetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...leadData,
          stage: leadData.stage || newLeadStage,
          created_by: session?.full_name || session?.email || 'unknown',
        }),
      })

      if (res.ok) {
        notify.success('Lead criado')
        fetchLeads()
      } else {
        notify.error('Erro ao criar o lead')
      }
    } else if (leadData.id) {
      const res = await apiFetch(`/api/crm/${leadData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadData),
      })

      if (res.ok) {
        notify.success('Lead atualizado')
        fetchLeads()
      } else {
        notify.error('Erro ao salvar o lead')
      }
    }
  }

  // Delete lead
  const handleDelete = async (id: string) => {
    const res = await apiFetch(`/api/crm/${id}`, { method: 'DELETE' })
    if (res.ok) {
      notify.success('Lead excluído')
      fetchLeads()
    } else {
      notify.error('Erro ao excluir o lead')
    }
  }

  // KPIs do funil — todos derivados apenas do que a API já retorna.
  const total = leads.length
  const countByStage = (stage: CRMStage) => leads.filter((l) => l.stage === stage).length
  const inNegotiation = countByStage('proposta_enviada') + countByStage('negociacao')
  const won = countByStage('fechado_ganho')
  const lost = countByStage('perdido')
  const decided = won + lost
  const conversionRate = decided > 0 ? Math.round((won / decided) * 100) : 0

  const hasFilters = search.trim() !== '' || filterStage !== 'all'
  const clearFilters = () => {
    setSearch('')
    setFilterStage('all')
  }

  const newLeadButton = (
    <Button onClick={() => handleNewLead('novo_lead')}>
      <Plus aria-hidden="true" />
      Novo lead
    </Button>
  )

  return (
    <PageShell>
      <PageHeader
        eyebrow="Relacionamento"
        title="CRM"
        description="Funil de parcerias B2B — da prospecção ao fechamento."
        meta={
          <>
            <span>
              <span className="font-mono tabular-nums text-ink">{total}</span> leads no funil
            </span>
            <span>
              <span className="font-mono tabular-nums text-ink">{filteredLeads.length}</span>{' '}
              exibidos
            </span>
          </>
        }
        actions={
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            loading={refreshing}
            aria-label="Atualizar leads"
          >
            <RefreshCw aria-hidden="true" />
          </Button>
        }
        primaryAction={newLeadButton}
      >
        <Toolbar>
          <SearchInput
            value={search}
            onValueChange={setSearch}
            placeholder="Buscar por nome, empresa, CNPJ..."
            placeholderShort="Nome ou empresa"
          />
          <SegmentedControl<CRMView>
            label="Visualização do funil"
            value={view}
            onChange={setView}
            options={[
              { value: 'kanban', label: 'Kanban', icon: LayoutGrid },
              { value: 'list', label: 'Lista', icon: List },
            ]}
          />
        </Toolbar>

        {/* Filtro por fase */}
        <div
          role="group"
          aria-label="Filtrar por fase"
          className="scroll-touch no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6"
        >
          <button
            type="button"
            aria-pressed={filterStage === 'all'}
            onClick={() => setFilterStage('all')}
            className={`ds-tap shrink-0 rounded-lg border px-3 text-sm font-medium transition-colors ${
              filterStage === 'all'
                ? 'border-brand-border bg-brand-soft text-brand-strong'
                : 'border-line bg-surface-raised text-ink-muted hover:border-line-strong hover:text-ink'
            }`}
          >
            Todas
            <span className="ml-2 font-mono tabular-nums">{total}</span>
          </button>
          {CRM_STAGES.map((stage) => {
            const count = countByStage(stage.id)
            const active = filterStage === stage.id
            return (
              <button
                key={stage.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFilterStage(active ? 'all' : stage.id)}
                className={`ds-tap flex shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${
                  active
                    ? 'border-brand-border bg-brand-soft text-brand-strong'
                    : 'border-line bg-surface-raised text-ink-muted hover:border-line-strong hover:text-ink'
                }`}
              >
                <StatusPill tone={STAGE_TONE[stage.id]} size="sm">
                  {stage.label}
                </StatusPill>
                <span className="font-mono tabular-nums">{count}</span>
              </button>
            )
          })}
        </div>
      </PageHeader>

      {error ? (
        <div className="mb-5">
          <ErrorBanner
            message={error}
            onRetry={() => {
              setLoading(true)
              fetchLeads()
            }}
          />
        </div>
      ) : null}

      {loading ? (
        <div className="space-y-5">
          <StatGridSkeleton />
          <div className="hidden lg:block">
            <TableSkeleton rows={6} columns={6} />
          </div>
          <div className="lg:hidden">
            <CardListSkeleton count={5} />
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <StatGrid>
            <StatTile
              label="Leads no funil"
              value={total}
              hint="Todas as fases"
              icon={Users}
            />
            <StatTile
              label="Em negociação"
              value={inNegotiation}
              hint="Proposta enviada + negociação"
              icon={TrendingUp}
              tone="brand"
            />
            <StatTile
              label="Fechados (ganho)"
              value={won}
              hint={`${lost} perdidos`}
              icon={Handshake}
            />
            <StatTile
              label="Taxa de conversão"
              value={`${conversionRate}%`}
              hint={decided > 0 ? `${won} de ${decided} decididos` : 'Sem leads decididos'}
              icon={Target}
            />
          </StatGrid>

          {view === 'kanban' ? (
            <div className="h-[calc(100dvh-22rem)] min-h-[26rem]">
              {filteredLeads.length === 0 && hasFilters ? (
                <NoResultsState query={search || stageLabel(filterStage as CRMStage)} onClear={clearFilters} />
              ) : (
                <CRMKanbanBoard
                  leads={filteredLeads}
                  onCardClick={handleCardClick}
                  onMoveCard={handleMoveCard}
                  onNewLead={handleNewLead}
                />
              )}
            </div>
          ) : filteredLeads.length === 0 ? (
            hasFilters ? (
              <NoResultsState query={search || stageLabel(filterStage as CRMStage)} onClear={clearFilters} />
            ) : (
              <EmptyState
                icon={Users}
                title="Nenhum lead cadastrado"
                description="Os leads das parcerias B2B aparecem aqui assim que forem criados."
                action={newLeadButton}
              />
            )
          ) : (
            <>
              {/* Desktop: tabela */}
              <div className="hidden lg:block">
                <TableFrame>
                  <Table caption="Lista de leads do CRM com contato, fase do funil e data de criação">
                    <THead>
                      <TH>Nome</TH>
                      <TH>Empresa</TH>
                      <TH>E-mail</TH>
                      <TH>Telefone</TH>
                      <TH>Fase</TH>
                      <TH>Criado em</TH>
                    </THead>
                    <TBody>
                      {filteredLeads.map((lead) => (
                        <TR key={lead.id} onClick={() => handleCardClick(lead)}>
                          <TD className="font-medium text-ink-strong">{lead.name}</TD>
                          <TD>{lead.company_name || '—'}</TD>
                          <TD>{lead.email || '—'}</TD>
                          <TD>{lead.phone || '—'}</TD>
                          <TD>
                            <StatusPill tone={STAGE_TONE[lead.stage]}>
                              {stageLabel(lead.stage)}
                            </StatusPill>
                          </TD>
                          <TD className="text-ink-muted">
                            <time dateTime={lead.created_at}>
                              {new Date(lead.created_at).toLocaleDateString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                              })}
                            </time>
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </TableFrame>
              </div>

              {/* Mobile: cards */}
              <div className="space-y-3 lg:hidden">
                {filteredLeads.map((lead) => (
                  <MobileRecordCard
                    key={lead.id}
                    title={lead.name}
                    subtitle={lead.company_name || 'Sem empresa'}
                    status={
                      <StatusPill tone={STAGE_TONE[lead.stage]}>
                        {stageLabel(lead.stage)}
                      </StatusPill>
                    }
                    fields={[
                      { label: 'E-mail', value: lead.email || '—' },
                      { label: 'Telefone', value: lead.phone || '—' },
                      {
                        label: 'Criado em',
                        value: new Date(lead.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        }),
                      },
                      { label: 'Responsável', value: lead.created_by || '—' },
                    ]}
                    onClick={() => handleCardClick(lead)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}


      {modalOpen ? (
        <CRMLeadModal
          key={isNewLead ? `new-${newLeadStage}` : selectedLead?.id}
          open
          lead={isNewLead ? ({ stage: newLeadStage } as CRMLead) : selectedLead}
          isNew={isNewLead}
          onClose={() => setModalOpen(false)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      ) : null}
    </PageShell>
  )
}
