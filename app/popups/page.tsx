// app/popups/page.tsx
'use client'

import { useCallback, useEffect, useState } from 'react'
import { Megaphone, Plus, RefreshCw } from 'lucide-react'
import {
  EmptyState,
  NoResultsState,
  PageHeader,
  PageShell,
  SearchInput,
  Toolbar,
  confirmAction,
  notify,
} from '@/components/somma'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/ui/error-banner'
import PopupsCard from '@/components/popups-card'
import PopupsModal from '@/components/popups-modal'
import { searchAndRank } from '@/lib/search-utils'
import { apiFetch } from '@/lib/api-client'
import type { CreatePopupInput, PopupWithStats } from '@/lib/services/popups'

function PopupsGridSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-xl border border-line bg-surface-raised">
          <div className="ds-skeleton aspect-video rounded-none" />
          <div className="space-y-3 p-4">
            <div className="ds-skeleton h-4 w-3/5" />
            <div className="ds-skeleton h-3 w-2/5" />
            <div className="ds-skeleton h-12 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function PopupsPage() {
  const [popups, setPopups] = useState<PopupWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingPopup, setEditingPopup] = useState<PopupWithStats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const loadPopups = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await apiFetch('/api/popups')
      if (!res.ok) throw new Error('Erro ao carregar')
      const data = await res.json()
      setPopups(data)
      setError(null)
    } catch {
      setError('Erro ao carregar pop-ups')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadPopups()
  }, [loadPopups])

  const handleSave = async (data: CreatePopupInput) => {
    try {
      const method = editingPopup ? 'PATCH' : 'POST'
      const url = editingPopup ? `/api/popups/${editingPopup.id}` : '/api/popups'
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      setShowModal(false)
      setEditingPopup(null)
      notify.success(editingPopup ? 'Pop-up atualizado' : 'Pop-up criado')
      void loadPopups(true)
    } catch {
      notify.error('Erro ao salvar pop-up')
    }
  }

  const handleToggle = async (id: string, value: boolean) => {
    setPopups((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: value } : p)))
    try {
      const res = await apiFetch(`/api/popups/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: value }),
      })
      if (!res.ok) throw new Error('Erro ao atualizar')
    } catch {
      setPopups((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: !value } : p)))
      notify.error('Não foi possível alterar o status do pop-up')
    }
  }

  const handleDelete = async (popup: PopupWithStats) => {
    const confirmed = await confirmAction({
      title: 'Excluir pop-up?',
      description: 'Esta ação é irreversível. O pop-up e sua imagem serão removidos permanentemente.',
      detail: popup.title,
      tone: 'danger',
    })
    if (!confirmed) return

    try {
      const res = await apiFetch(`/api/popups/${popup.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Erro ao deletar')
      setPopups((prev) => prev.filter((p) => p.id !== popup.id))
      notify.success('Pop-up excluído')
    } catch {
      notify.error('Erro ao excluir pop-up')
    }
  }

  const openEdit = (popup: PopupWithStats) => {
    setEditingPopup(popup)
    setShowModal(true)
  }

  const openCreate = () => {
    setEditingPopup(null)
    setShowModal(true)
  }

  const filteredPopups = searchAndRank(popups, searchTerm, (popup) => [
    popup.title,
    popup.redirect_link,
    popup.pages?.join(' '),
  ])

  const activeCount = popups.filter((popup) => popup.is_active).length

  return (
    <PageShell>
      <PageHeader
        eyebrow="Gestão"
        title="Pop-ups"
        description="Campanhas exibidas sobre as páginas do site, com agendamento e segmentação."
        meta={
          popups.length > 0 ? (
            <>
              <span>
                <span className="font-mono tabular-nums text-ink">{popups.length}</span> no total
              </span>
              <span>
                <span className="font-mono tabular-nums text-ink">{activeCount}</span> ativos
              </span>
            </>
          ) : undefined
        }
        actions={
          <Button
            variant="secondary"
            size="icon"
            onClick={() => void loadPopups(true)}
            loading={refreshing}
            aria-label="Atualizar lista de pop-ups"
          >
            <RefreshCw aria-hidden="true" />
          </Button>
        }
        primaryAction={
          <Button onClick={openCreate}>
            <Plus aria-hidden="true" />
            Novo pop-up
          </Button>
        }
      >
        {popups.length > 0 ? (
          <Toolbar>
            <SearchInput
              value={searchTerm}
              onValueChange={setSearchTerm}
              placeholder="Buscar por título, link ou página..."
            placeholderShort="Título ou link"
            />
          </Toolbar>
        ) : null}
      </PageHeader>

      {error ? (
        <div className="mb-4">
          <ErrorBanner message={error} onRetry={() => void loadPopups()} />
        </div>
      ) : null}

      <div aria-busy={loading || refreshing}>
        {loading ? (
          <PopupsGridSkeleton />
        ) : popups.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="Nenhum pop-up criado"
            description="Crie o primeiro pop-up para exibir uma campanha no site."
            action={
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" />
                Criar primeiro pop-up
              </Button>
            }
          />
        ) : filteredPopups.length === 0 ? (
          <NoResultsState query={searchTerm} onClear={() => setSearchTerm('')} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPopups.map((popup) => (
              <PopupsCard
                key={popup.id}
                popup={popup}
                onEdit={openEdit}
                onDelete={(target) => void handleDelete(target)}
                onToggle={(id, value) => void handleToggle(id, value)}
              />
            ))}
          </div>
        )}
      </div>

      <PopupsModal
        key={editingPopup?.id ?? 'novo'}
        open={showModal}
        popup={editingPopup}
        onClose={() => {
          setShowModal(false)
          setEditingPopup(null)
        }}
        onSave={handleSave}
      />
    </PageShell>
  )
}
