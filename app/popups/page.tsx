// app/popups/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { Megaphone, Plus, RefreshCw } from 'lucide-react'
import PopupsCard from '@/components/popups-card'
import PopupsModal from '@/components/popups-modal'
import type { PopupWithStats, CreatePopupInput } from '@/lib/services/popups'

export default function PopupsPage() {
  const [popups, setPopups] = useState<PopupWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editingPopup, setEditingPopup] = useState<PopupWithStats | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadPopups = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    try {
      const res = await fetch('/api/popups')
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

  useEffect(() => { loadPopups() }, [loadPopups])

  const handleSave = async (data: CreatePopupInput) => {
    try {
      const method = editingPopup ? 'PATCH' : 'POST'
      const url = editingPopup ? `/api/popups/${editingPopup.id}` : '/api/popups'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Erro ao salvar')
      setShowModal(false)
      setEditingPopup(null)
      loadPopups(true)
    } catch {
      setError('Erro ao salvar pop-up')
    }
  }

  const handleToggle = async (id: string, value: boolean) => {
    setPopups((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: value } : p)))
    try {
      await fetch(`/api/popups/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: value }),
      })
    } catch {
      // Revert on error
      setPopups((prev) => prev.map((p) => (p.id === id ? { ...p, is_active: !value } : p)))
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/popups/${id}`, { method: 'DELETE' })
      setPopups((prev) => prev.filter((p) => p.id !== id))
    } catch {
      setError('Erro ao deletar pop-up')
    } finally {
      setDeleteConfirm(null)
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

  return (
    <div className="flex flex-col h-full bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Megaphone className="w-5 h-5 text-orange-400" />
          <h1 className="text-lg font-semibold text-white">Pop-ups</h1>
          {popups.length > 0 && (
            <span className="text-xs text-neutral-500 bg-neutral-800 px-2 py-0.5 rounded-full">
              {popups.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadPopups(true)}
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
            Novo Pop-up
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden animate-pulse">
                <div className="aspect-video bg-neutral-800" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-neutral-800 rounded w-3/4" />
                  <div className="h-3 bg-neutral-800 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : popups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
            <Megaphone className="w-12 h-12 text-neutral-700" />
            <div>
              <p className="text-neutral-400 font-medium">Nenhum pop-up criado</p>
              <p className="text-neutral-600 text-sm mt-1">
                Crie seu primeiro pop-up para exibir no site
              </p>
            </div>
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-400 text-black font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Criar primeiro pop-up
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {popups.map((popup) => (
              <PopupsCard
                key={popup.id}
                popup={popup}
                onEdit={openEdit}
                onDelete={(id) => setDeleteConfirm(id)}
                onToggle={handleToggle}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <PopupsModal
          popup={editingPopup}
          onClose={() => { setShowModal(false); setEditingPopup(null) }}
          onSave={handleSave}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-white mb-2">Excluir pop-up?</h3>
            <p className="text-sm text-neutral-400 mb-5">
              Esta ação é irreversível. O pop-up e sua imagem serão removidos permanentemente.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 rounded-lg bg-neutral-800 text-neutral-300 hover:text-white text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition-colors"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
