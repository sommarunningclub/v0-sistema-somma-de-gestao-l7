'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Building2,
  Handshake,
  Plus,
  RefreshCw,
  TrendingUp,
  UserCheck,
  UserX,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { apiFetch } from '@/lib/api-client'
import { CNPJLookup } from '@/components/cnpj-lookup'
import { PartnerForm } from '@/components/partner-form'
import { PartnerCodesModal } from '@/components/partner-codes-modal'
import { PartnerDetailModal } from '@/components/partner-detail-modal'
import { PartnerList, type PartnerSortKey } from '@/components/partner-list'
import { WhatsAppMessageModal } from '@/components/whatsapp-message-modal'
import type { CNPJData, Partner } from '@/lib/services/partners'
import { matchesTextSearch } from '@/lib/search-utils'
import {
  CardListSkeleton,
  EmptyState,
  FilterChip,
  NoResultsState,
  PageHeader,
  PageShell,
  ResponsiveModal,
  SearchInput,
  StatGrid,
  StatGridSkeleton,
  StatTile,
  TableSkeleton,
  Toolbar,
  confirmAction,
  notify,
} from '@/components/somma'
import {
  PARTNER_STATUS_LABEL,
  PARTNER_STATUS_ORDER,
  type PartnerStatus,
} from '@/components/partner-utils'

type FilterStatus = 'all' | PartnerStatus

interface PartnerCode {
  id: string
  codigo: string
  nome_parceiro: string
  ativo: boolean
  created_at: string
  last_access?: string
}

const PAGE_SIZE = 20

const STATUS_ICON = {
  active: UserCheck,
  negotiating: TrendingUp,
  pending: AlertCircle,
  inactive: UserX,
} as const

export default function ParceiroSommaPage() {
  const [cnpjData, setCNPJData] = useState<CNPJData | undefined>()
  const [editingPartner, setEditingPartner] = useState<Partner | undefined>()
  const [partners, setPartners] = useState<Partner[]>([])
  const [partnerCodes, setPartnerCodes] = useState<PartnerCode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFormLoading, setIsFormLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all')
  const [sortKey, setSortKey] = useState<PartnerSortKey>('company_name')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [detailPartner, setDetailPartner] = useState<Partner | null>(null)
  const [whatsappModal, setWhatsappModal] = useState<{ isOpen: boolean; phone: string; name: string }>({
    isOpen: false, phone: '', name: ''
  })

  const formDirtyRef = useRef(false)

  const loadPartners = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await apiFetch('/api/partners')
      if (!response.ok) throw new Error('Erro ao carregar parceiros')
      const data = await response.json()
      setPartners(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar parceiros')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadPartnerCodes = useCallback(async () => {
    try {
      const response = await apiFetch('/api/partner-codes')
      if (!response.ok) throw new Error('Erro ao carregar códigos')
      const data = await response.json()
      setPartnerCodes(data.data || [])
    } catch (err) {
      console.error('Error loading codes:', err)
    }
  }, [])

  useEffect(() => {
    loadPartners()
    loadPartnerCodes()
  }, [loadPartners, loadPartnerCodes])

  const stats = useMemo(() => ({
    total: partners.length,
    active: partners.filter(p => p.status === 'active').length,
    pending: partners.filter(p => p.status === 'pending').length,
    negotiating: partners.filter(p => p.status === 'negotiating').length,
    inactive: partners.filter(p => p.status === 'inactive').length,
  }), [partners])

  const filteredPartners = useMemo(() => {
    const filtered = partners.filter(p => {
      const matchesSearch = !searchTerm ||
        matchesTextSearch(searchTerm, [
          p.company_name,
          p.cnpj,
          p.responsible_name,
          p.responsible_email,
          p.company_email,
          p.responsible_phone,
        ])
      const matchesStatus = filterStatus === 'all' || p.status === filterStatus
      return matchesSearch && matchesStatus
    })

    const factor = sortDirection === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      const left = (sortKey === 'status'
        ? PARTNER_STATUS_LABEL[a.status ?? 'pending']
        : a[sortKey]) ?? ''
      const right = (sortKey === 'status'
        ? PARTNER_STATUS_LABEL[b.status ?? 'pending']
        : b[sortKey]) ?? ''
      return factor * String(left).localeCompare(String(right), 'pt-BR')
    })
  }, [partners, searchTerm, filterStatus, sortKey, sortDirection])

  useEffect(() => {
    setPage(1)
  }, [searchTerm, filterStatus])

  const pagedPartners = useMemo(
    () => filteredPartners.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredPartners, page],
  )

  const handleSort = (key: PartnerSortKey) => {
    if (key === sortKey) {
      setSortDirection(current => (current === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  const openCreateForm = () => {
    setEditingPartner(undefined)
    setCNPJData(undefined)
    setIsEditMode(false)
    formDirtyRef.current = false
    setFormOpen(true)
  }

  const openEditForm = (partner: Partner) => {
    setDetailPartner(null)
    setEditingPartner(partner)
    setCNPJData(undefined)
    setIsEditMode(true)
    formDirtyRef.current = false
    setFormOpen(true)
  }

  const closeForm = () => {
    formDirtyRef.current = false
    setFormOpen(false)
    setCNPJData(undefined)
    setEditingPartner(undefined)
  }

  const requestCloseForm = async () => {
    if (formDirtyRef.current) {
      const confirmed = await confirmAction({
        title: 'Descartar alterações?',
        description: 'Os dados preenchidos neste formulário não foram salvos e serão perdidos.',
        confirmLabel: 'Descartar',
        cancelLabel: 'Continuar editando',
        tone: 'danger',
      })
      if (!confirmed) return
    }
    closeForm()
  }

  const handleCNPJLoaded = (data: CNPJData) => {
    setCNPJData(data)
  }

  const handleFormSubmit = async (formData: Partial<Partner>) => {
    try {
      setIsFormLoading(true)
      setError(null)

      // Se está editando
      if (isEditMode && editingPartner?.id) {
        const response = await apiFetch(`/api/partners?id=${editingPartner.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        })
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Erro ao atualizar parceiro')
        }
        const updatedPartner = await response.json()
        setPartners(current => current.map(p => (p.id === updatedPartner.id ? updatedPartner : p)))
        notify.success('Parceiro atualizado com sucesso')
      } else {
        // Criando novo
        const response = await apiFetch('/api/partners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        })
        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Erro ao cadastrar parceiro')
        }
        const newPartner = await response.json()
        setPartners(current => [newPartner, ...current])
        notify.success('Parceiro cadastrado com sucesso')
      }

      closeForm()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar parceiro'
      setError(message)
      notify.error(message)
      console.error('[v0] Error submitting form:', err)
    } finally {
      setIsFormLoading(false)
    }
  }

  const handleDeletePartner = async (partner: Partner) => {
    if (!partner.id) return
    const confirmed = await confirmAction({
      title: 'Excluir parceiro?',
      description: 'Esta ação não pode ser desfeita. O benefício deixa de aparecer para os membros.',
      detail: partner.company_name,
      tone: 'danger',
    })
    if (!confirmed) return

    try {
      const response = await apiFetch(`/api/partners?id=${partner.id}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Erro ao deletar parceiro')
      setPartners(current => current.filter(p => p.id !== partner.id))
      setDetailPartner(null)
      notify.success('Parceiro excluído')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao deletar parceiro'
      setError(message)
      notify.error(message)
    }
  }

  const openWhatsApp = (partner: Partner) => {
    setWhatsappModal({
      isOpen: true,
      phone: partner.responsible_phone,
      name: partner.responsible_name,
    })
  }

  const clearFilters = () => {
    setSearchTerm('')
    setFilterStatus('all')
  }

  const statusCount = (status: PartnerStatus) =>
    status === 'active' ? stats.active
      : status === 'pending' ? stats.pending
      : status === 'negotiating' ? stats.negotiating
      : stats.inactive

  return (
    <PageShell>
      <PageHeader
        eyebrow="Relacionamento"
        title="Parceiro Somma"
        description="Gestão das parcerias comerciais e dos benefícios oferecidos aos membros."
        meta={
          <>
            <span>
              <span className="font-mono tabular-nums text-ink">{filteredPartners.length}</span>{' '}
              {filteredPartners.length === 1 ? 'parceiro' : 'parceiros'} listados
            </span>
            <span>
              <span className="font-mono tabular-nums text-ink">{stats.active}</span> ativos
            </span>
          </>
        }
        actions={
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={loadPartners}
              disabled={isLoading}
              aria-label="Recarregar parceiros"
            >
              <RefreshCw aria-hidden="true" className={isLoading ? 'animate-spin' : undefined} />
            </Button>
            <PartnerCodesModal
              codes={partnerCodes}
              onCodesUpdate={loadPartnerCodes}
              partnerName="Somma"
            />
          </>
        }
        primaryAction={
          <Button onClick={openCreateForm}>
            <Plus aria-hidden="true" />
            Novo parceiro
          </Button>
        }
      />

      <div className="space-y-5">
        {error ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger-border bg-danger-soft p-3.5"
          >
            <p className="flex min-w-0 items-center gap-2 text-sm text-danger">
              <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span className="truncate">{error}</span>
            </p>
            <Button variant="ghost" size="sm" onClick={loadPartners} className="text-danger">
              <RefreshCw aria-hidden="true" />
              Tentar novamente
            </Button>
          </div>
        ) : null}

        {isLoading ? (
          <StatGridSkeleton count={5} />
        ) : (
          <StatGrid className="lg:grid-cols-5">
            <StatTile
              label="Total"
              value={stats.total}
              icon={Building2}
              tone={filterStatus === 'all' ? 'brand' : 'default'}
              hint="Todos os parceiros"
              onClick={() => setFilterStatus('all')}
            />
            {PARTNER_STATUS_ORDER.map((status) => (
              <StatTile
                key={status}
                label={PARTNER_STATUS_LABEL[status]}
                value={statusCount(status)}
                icon={STATUS_ICON[status]}
                tone={filterStatus === status ? 'brand' : 'default'}
                hint={`Filtrar por ${PARTNER_STATUS_LABEL[status].toLowerCase()}`}
                onClick={() => setFilterStatus(status)}
              />
            ))}
          </StatGrid>
        )}

        <Toolbar>
          <SearchInput
            value={searchTerm}
            onValueChange={setSearchTerm}
            placeholder="Buscar por empresa, CNPJ ou responsável..."
          placeholderShort="Empresa ou CNPJ"
            label="Buscar parceiros"
          />
          <div className="flex flex-wrap items-center gap-2">
            {filterStatus !== 'all' ? (
              <FilterChip
                label="Status"
                value={PARTNER_STATUS_LABEL[filterStatus]}
                onRemove={() => setFilterStatus('all')}
              />
            ) : null}
          </div>
        </Toolbar>

        {isLoading ? (
          <>
            <div className="lg:hidden">
              <CardListSkeleton count={4} />
            </div>
            <div className="hidden lg:block">
              <TableSkeleton rows={6} columns={6} />
            </div>
          </>
        ) : filteredPartners.length === 0 ? (
          partners.length === 0 ? (
            <EmptyState
              icon={Handshake}
              title="Nenhum parceiro cadastrado"
              description="Cadastre o primeiro parceiro para começar a oferecer benefícios aos membros Somma."
              action={
                <Button onClick={openCreateForm}>
                  <Plus aria-hidden="true" />
                  Cadastrar primeiro parceiro
                </Button>
              }
            />
          ) : (
            <NoResultsState query={searchTerm || PARTNER_STATUS_LABEL[filterStatus as PartnerStatus]} onClear={clearFilters} />
          )
        ) : (
          <PartnerList
            partners={pagedPartners}
            page={page}
            pageSize={PAGE_SIZE}
            total={filteredPartners.length}
            onPageChange={setPage}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            onSelect={setDetailPartner}
            onEdit={openEditForm}
            onDelete={handleDeletePartner}
            onWhatsApp={openWhatsApp}
            selectedId={detailPartner?.id ?? null}
          />
        )}
      </div>


      <ResponsiveModal
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) requestCloseForm()
        }}
        size="xl"
        dismissible={false}
        title={isEditMode ? 'Editar parceiro' : 'Novo parceiro'}
        description={
          isEditMode
            ? 'Atualize os dados da parceria.'
            : 'Busque pelo CNPJ ou preencha os dados manualmente.'
        }
      >
        <div className="space-y-6">
          {!isEditMode ? (
            <CNPJLookup
              onDataLoaded={handleCNPJLoaded}
              onLoading={setIsFormLoading}
              onError={setError}
            />
          ) : null}

          <PartnerForm
            key={editingPartner?.id ?? 'new'}
            initialData={editingPartner}
            cnpjData={cnpjData}
            onSubmit={handleFormSubmit}
            isLoading={isFormLoading}
            isEditMode={isEditMode}
            onCancel={requestCloseForm}
            onDirtyChange={(dirty) => {
              formDirtyRef.current = dirty
            }}
          />
        </div>
      </ResponsiveModal>

      <PartnerDetailModal
        partner={detailPartner}
        open={!!detailPartner}
        onOpenChange={(open) => {
          if (!open) setDetailPartner(null)
        }}
        onEdit={openEditForm}
        onDelete={handleDeletePartner}
        onWhatsApp={openWhatsApp}
      />

      <WhatsAppMessageModal
        isOpen={whatsappModal.isOpen}
        phoneNumber={whatsappModal.phone}
        memberName={whatsappModal.name}
        onClose={() => setWhatsappModal({ isOpen: false, phone: '', name: '' })}
      />
    </PageShell>
  )
}
