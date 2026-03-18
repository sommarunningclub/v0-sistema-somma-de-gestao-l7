// components/tarefas-board-modal.tsx
'use client'

import { useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import type { TarefasBoard } from '@/lib/services/tarefas'

interface TarefasBoardModalProps {
  board: Partial<TarefasBoard> | null
  isNew: boolean
  onClose: () => void
  onSave: (board: Partial<TarefasBoard>) => void
  onDelete?: (id: string) => void
}

export function TarefasBoardModal({ board, isNew, onClose, onSave, onDelete }: TarefasBoardModalProps) {
  const [nome, setNome] = useState(board?.nome || '')
  const [descricao, setDescricao] = useState(board?.descricao || '')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleSave = async () => {
    if (!nome.trim()) return
    setSaving(true)
    await onSave({ ...(board?.id && { id: board.id }), nome: nome.trim(), descricao: descricao.trim() || null })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <h2 className="text-white font-bold text-sm">{isNew ? 'Novo Quadro' : 'Editar Quadro'}</h2>
          <button onClick={onClose} className="p-1.5 text-neutral-500 hover:text-white rounded-lg hover:bg-neutral-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-neutral-400 text-xs mb-1 block">Nome *</label>
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Operações Somma Club"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
              style={{ fontSize: '16px' }}
              autoFocus
            />
          </div>
          <div>
            <label className="text-neutral-400 text-xs mb-1 block">Descrição</label>
            <input
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Opcional..."
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
              style={{ fontSize: '16px' }}
            />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-neutral-800 flex items-center justify-between gap-3">
          {!isNew && onDelete && (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-red-400 text-xs">Confirmar?</span>
                <button onClick={() => { onDelete(board!.id!); onClose() }} className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded">Sim</button>
                <button onClick={() => setConfirmDelete(false)} className="text-xs text-neutral-500 px-2 py-1 rounded hover:text-white">Não</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-xs text-neutral-500 hover:text-red-400 flex items-center gap-1 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />Excluir
              </button>
            )
          )}
          {isNew && <div />}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} className="px-4 py-2 text-xs text-neutral-400 hover:text-white bg-neutral-800 border border-neutral-700 rounded-lg">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!nome.trim() || saving}
              className="px-4 py-2 text-xs font-bold bg-orange-500 text-black rounded-lg hover:bg-orange-400 disabled:opacity-40"
            >
              {saving ? 'Salvando...' : isNew ? 'Criar' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
