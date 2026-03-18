// components/tarefas-task-modal.tsx
'use client'

import { useState } from 'react'
import { X, Plus, Trash2, Check } from 'lucide-react'
import { TAREFAS_PRIORIDADES } from '@/lib/tarefas-constants'
import type { TarefasTask, TarefasColumn, TarefasUser, ChecklistItem } from '@/lib/services/tarefas'

interface TarefasTaskModalProps {
  task: Partial<TarefasTask> | null
  isNew: boolean
  columns: TarefasColumn[]
  users: TarefasUser[]
  defaultColumnId?: string
  onClose: () => void
  onSave: (task: Partial<TarefasTask>) => void
  onDelete?: (id: string) => void
}

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

export function TarefasTaskModal({
  task, isNew, columns, users, defaultColumnId, onClose, onSave, onDelete
}: TarefasTaskModalProps) {
  const [titulo, setTitulo] = useState(task?.titulo || '')
  const [descricao, setDescricao] = useState(task?.descricao || '')
  const [prioridade, setPrioridade] = useState(task?.prioridade || 'media')
  const [responsavelId, setResponsavelId] = useState(task?.responsavel_id || '')
  const [dataEntrega, setDataEntrega] = useState(task?.data_entrega || '')
  const [columnId, setColumnId] = useState(task?.column_id || defaultColumnId || '')
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task?.checklist || [])
  const [newItem, setNewItem] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const selectedUser = users.find(u => u.id === responsavelId)

  const handleAddChecklistItem = () => {
    if (!newItem.trim()) return
    setChecklist(prev => [...prev, { id: generateId(), texto: newItem.trim(), concluido: false }])
    setNewItem('')
  }

  const handleToggleItem = (id: string) => {
    setChecklist(prev => prev.map(i => i.id === id ? { ...i, concluido: !i.concluido } : i))
  }

  const handleRemoveItem = (id: string) => {
    setChecklist(prev => prev.filter(i => i.id !== id))
  }

  const handleSave = async () => {
    if (!titulo.trim() || !columnId) return
    setSaving(true)
    const col = columns.find(c => c.id === columnId)
    await onSave({
      ...(task?.id && { id: task.id }),
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      prioridade: prioridade as TarefasTask['prioridade'],
      responsavel_id: responsavelId || null,
      responsavel_nome: selectedUser?.full_name || null,
      data_entrega: dataEntrega || null,
      column_id: columnId,
      board_id: task?.board_id || col?.board_id,
      checklist,
    })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <h2 className="text-white font-bold text-sm">
            {isNew ? 'Nova Tarefa' : 'Editar Tarefa'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-neutral-500 hover:text-white rounded-lg hover:bg-neutral-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Título */}
          <div>
            <label className="text-neutral-400 text-xs mb-1 block">Título *</label>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Nome da tarefa"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
              style={{ fontSize: '16px' }}
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="text-neutral-400 text-xs mb-1 block">Descrição</label>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Detalhes opcionais..."
              rows={3}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-orange-500"
              style={{ fontSize: '16px' }}
            />
          </div>

          {/* Prioridade + Coluna */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-neutral-400 text-xs mb-1 block">Prioridade</label>
              <select
                value={prioridade}
                onChange={e => setPrioridade(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                style={{ fontSize: '16px' }}
              >
                {TAREFAS_PRIORIDADES.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-neutral-400 text-xs mb-1 block">Coluna</label>
              <select
                value={columnId}
                onChange={e => setColumnId(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                style={{ fontSize: '16px' }}
              >
                <option value="">Selecionar...</option>
                {columns.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Responsável + Data */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-neutral-400 text-xs mb-1 block">Responsável</label>
              <select
                value={responsavelId}
                onChange={e => setResponsavelId(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                style={{ fontSize: '16px' }}
              >
                <option value="">Nenhum</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-neutral-400 text-xs mb-1 block">Data de entrega</label>
              <input
                type="date"
                value={dataEntrega}
                onChange={e => setDataEntrega(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                style={{ fontSize: '16px' }}
              />
            </div>
          </div>

          {/* Checklist */}
          <div>
            <label className="text-neutral-400 text-xs mb-2 block">
              Checklist {checklist.length > 0 && `(${checklist.filter(i=>i.concluido).length}/${checklist.length})`}
            </label>
            <div className="space-y-1.5 mb-2">
              {checklist.map(item => (
                <div key={item.id} className="flex items-center gap-2 group/item">
                  <button
                    onClick={() => handleToggleItem(item.id)}
                    className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${item.concluido ? 'bg-orange-500 border-orange-500' : 'border-neutral-600 bg-neutral-800'}`}
                  >
                    {item.concluido && <Check className="w-2.5 h-2.5 text-black" />}
                  </button>
                  <span className={`flex-1 text-sm ${item.concluido ? 'line-through text-neutral-500' : 'text-neutral-300'}`}>
                    {item.texto}
                  </span>
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="opacity-0 group-hover/item:opacity-100 p-0.5 text-neutral-600 hover:text-red-400 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newItem}
                onChange={e => setNewItem(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddChecklistItem() } }}
                placeholder="Adicionar item..."
                className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-orange-500"
                style={{ fontSize: '16px' }}
              />
              <button
                onClick={handleAddChecklistItem}
                className="p-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-400 hover:text-white hover:border-orange-500"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-800 flex items-center justify-between gap-3">
          {!isNew && onDelete && (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-red-400 text-xs">Confirmar?</span>
                <button onClick={() => { onDelete(task!.id!); onClose() }} className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded">Sim</button>
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
              disabled={!titulo.trim() || !columnId || saving}
              className="px-4 py-2 text-xs font-bold bg-orange-500 text-black rounded-lg hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Salvando...' : isNew ? 'Criar' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
