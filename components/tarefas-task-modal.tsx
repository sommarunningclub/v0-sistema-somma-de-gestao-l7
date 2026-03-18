// components/tarefas-task-modal.tsx
'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { X, Plus, Trash2, Check, Paperclip, FileText, Download, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react'
import { TAREFAS_PRIORIDADES } from '@/lib/tarefas-constants'
import type { TarefasTask, TarefasColumn, TarefasUser, ChecklistItem, TarefasAnexo } from '@/lib/services/tarefas'
import { getSession } from '@/components/protected-route'

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

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImage(fileType: string) {
  return fileType.startsWith('image/')
}

export function TarefasTaskModal({
  task, isNew, columns, users, defaultColumnId, onClose, onSave, onDelete
}: TarefasTaskModalProps) {
  const session = getSession()
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // Attachments
  const [anexos, setAnexos] = useState<TarefasAnexo[]>([])
  const [uploading, setUploading] = useState(false)
  const [previewAnexo, setPreviewAnexo] = useState<TarefasAnexo | null>(null)
  const [activeTab, setActiveTab] = useState<'detalhes' | 'anexos'>('detalhes')

  const selectedUser = users.find(u => u.id === responsavelId)

  const loadAnexos = useCallback(async () => {
    if (!task?.id) return
    const res = await fetch(`/api/tarefas/tasks/${task.id}/attachments`)
    if (res.ok) setAnexos(await res.json())
  }, [task?.id])

  useEffect(() => {
    loadAnexos()
  }, [loadAnexos])

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !task?.id) return

    setUploading(true)
    try {
      const { supabase } = await import('@/lib/supabase-client')
      const fileExt = file.name.split('.').pop()
      const fileName = `${task.id}/${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('tarefas-anexos')
        .upload(fileName, file)

      if (uploadError) {
        console.error('[v0] tarefas upload error:', uploadError)
        return
      }

      const { data: urlData } = supabase.storage
        .from('tarefas-anexos')
        .getPublicUrl(fileName)

      const res = await fetch(`/api/tarefas/tasks/${task.id}/attachments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: session?.full_name || session?.email || 'unknown',
        }),
      })

      if (res.ok) loadAnexos()
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteAnexo = async (id: string) => {
    if (!task?.id) return
    const res = await fetch(`/api/tarefas/tasks/${task.id}/attachments?attachmentId=${id}`, { method: 'DELETE' })
    if (res.ok) setAnexos(prev => prev.filter(a => a.id !== id))
  }

  const imageAnexos = anexos.filter(a => isImage(a.file_type))
  const previewIndex = previewAnexo ? imageAnexos.findIndex(a => a.id === previewAnexo.id) : -1

  const handleAnexoClick = (anexo: TarefasAnexo) => {
    if (isImage(anexo.file_type)) {
      setPreviewAnexo(anexo)
    } else {
      window.open(anexo.file_url, '_blank')
    }
  }

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (previewIndex > 0) setPreviewAnexo(imageAnexos[previewIndex - 1])
  }

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (previewIndex < imageAnexos.length - 1) setPreviewAnexo(imageAnexos[previewIndex + 1])
  }

  function getFileIcon(fileType: string) {
    if (fileType === 'application/pdf') return { icon: FileText, color: 'text-red-400', bg: 'bg-red-500/10', label: 'PDF' }
    if (fileType.includes('word') || fileType.includes('document')) return { icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'DOC' }
    if (fileType.includes('excel') || fileType.includes('sheet')) return { icon: FileText, color: 'text-green-400', bg: 'bg-green-500/10', label: 'XLS' }
    if (fileType.includes('presentation') || fileType.includes('powerpoint')) return { icon: FileText, color: 'text-orange-400', bg: 'bg-orange-500/10', label: 'PPT' }
    if (fileType === 'text/csv') return { icon: FileText, color: 'text-teal-400', bg: 'bg-teal-500/10', label: 'CSV' }
    return { icon: FileText, color: 'text-neutral-400', bg: 'bg-neutral-700', label: 'FILE' }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70">
        <div className="bg-neutral-900 border border-neutral-800 rounded-t-xl sm:rounded-xl w-full max-w-lg max-h-[92vh] sm:max-h-[90vh] flex flex-col shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
            <h2 className="text-white font-bold text-sm">
              {isNew ? 'Nova Tarefa' : 'Editar Tarefa'}
            </h2>
            <button onClick={onClose} className="p-2 -mr-2 text-neutral-500 hover:text-white rounded-lg hover:bg-neutral-800">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tabs — só para edição */}
          {!isNew && (
            <div className="flex border-b border-neutral-800">
              <button
                onClick={() => setActiveTab('detalhes')}
                className={`flex-1 py-3 text-xs font-medium transition-colors ${activeTab === 'detalhes' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                Detalhes
              </button>
              <button
                onClick={() => setActiveTab('anexos')}
                className={`flex-1 py-3 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${activeTab === 'anexos' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                <Paperclip className="w-3 h-3" />
                Anexos {anexos.length > 0 && <span className="bg-neutral-700 text-neutral-300 rounded-full px-1.5 py-0.5 text-[10px]">{anexos.length}</span>}
              </button>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            {/* ── Aba Detalhes ── */}
            {(isNew || activeTab === 'detalhes') && (
              <>
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
                      onChange={e => setPrioridade(e.target.value as TarefasTask['prioridade'])}
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
              </>
            )}

            {/* ── Aba Anexos ── */}
            {!isNew && activeTab === 'anexos' && (
              <div className="space-y-4">
                {/* Upload button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 py-3.5 border border-dashed border-neutral-700 rounded-xl text-sm text-neutral-400 hover:text-white hover:border-orange-500 hover:bg-orange-500/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-orange-500/40 border-t-orange-500 rounded-full animate-spin" />
                      <span>Enviando...</span>
                    </>
                  ) : (
                    <>
                      <Paperclip className="w-4 h-4" />
                      <span>Clique para anexar arquivo</span>
                    </>
                  )}
                </button>

                {anexos.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-neutral-600">
                    <Paperclip className="w-8 h-8 opacity-30" />
                    <p className="text-xs">Nenhum anexo ainda</p>
                  </div>
                ) : (
                  <>
                    {/* Grid de imagens */}
                    {imageAnexos.length > 0 && (
                      <div>
                        <p className="text-neutral-500 text-[11px] uppercase tracking-wider mb-2">Imagens</p>
                        <div className="grid grid-cols-3 gap-2">
                          {imageAnexos.map(anexo => (
                            <div key={anexo.id} className="relative group/img aspect-square">
                              <button
                                onClick={() => handleAnexoClick(anexo)}
                                className="w-full h-full rounded-lg overflow-hidden bg-neutral-800 border border-neutral-700 hover:border-orange-500 transition-all"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={anexo.file_url} alt={anexo.file_name} className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/40 transition-all flex items-center justify-center">
                                  <ZoomIn className="w-5 h-5 text-white opacity-0 group-hover/img:opacity-100 transition-opacity" />
                                </div>
                              </button>
                              <button
                                onClick={() => handleDeleteAnexo(anexo.id)}
                                className="absolute top-1.5 right-1.5 p-1 bg-black/70 rounded-md text-white/60 hover:text-red-400 opacity-0 group-hover/img:opacity-100 transition-opacity"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Lista de arquivos não-imagem */}
                    {anexos.filter(a => !isImage(a.file_type)).length > 0 && (
                      <div>
                        {imageAnexos.length > 0 && <p className="text-neutral-500 text-[11px] uppercase tracking-wider mb-2">Arquivos</p>}
                        <div className="space-y-1.5">
                          {anexos.filter(a => !isImage(a.file_type)).map(anexo => {
                            const { icon: Icon, color, bg, label } = getFileIcon(anexo.file_type)
                            return (
                              <div key={anexo.id} className="flex items-center gap-3 p-3 bg-neutral-800/60 rounded-xl border border-neutral-800 hover:border-neutral-700 group/doc transition-colors">
                                {/* Ícone do tipo */}
                                <div className={`flex-shrink-0 w-10 h-10 rounded-lg ${bg} flex flex-col items-center justify-center gap-0.5`}>
                                  <Icon className={`w-4 h-4 ${color}`} />
                                  <span className={`text-[9px] font-bold ${color} leading-none`}>{label}</span>
                                </div>

                                {/* Nome e tamanho */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-white text-xs font-medium truncate">{anexo.file_name}</p>
                                  <p className="text-neutral-500 text-[11px] mt-0.5">{formatFileSize(anexo.file_size)}</p>
                                </div>

                                {/* Ações */}
                                <div className="flex items-center gap-1 opacity-0 group-hover/doc:opacity-100 transition-opacity">
                                  <a
                                    href={anexo.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-neutral-400 hover:text-white bg-neutral-700 rounded-md"
                                    title="Abrir"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>
                                  <button
                                    onClick={() => handleDeleteAnexo(anexo.id)}
                                    className="p-1.5 text-neutral-400 hover:text-red-400 bg-neutral-700 rounded-md"
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-neutral-800 flex items-center justify-between gap-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
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

      {/* Lightbox de imagens */}
      {previewAnexo && (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-black/95"
          onClick={() => setPreviewAnexo(null)}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPreviewAnexo(null)}
                className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <p className="text-white text-sm font-medium truncate max-w-[200px] sm:max-w-xs">{previewAnexo.file_name}</p>
                <p className="text-white/40 text-xs">{formatFileSize(previewAnexo.file_size)}{imageAnexos.length > 1 && ` · ${previewIndex + 1} de ${imageAnexos.length}`}</p>
              </div>
            </div>
            <a
              href={previewAnexo.file_url}
              download={previewAnexo.file_name}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              onClick={e => e.stopPropagation()}
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </a>
          </div>

          {/* Imagem central */}
          <div className="flex-1 flex items-center justify-center relative px-14 pb-4">
            {/* Navegação anterior */}
            {previewIndex > 0 && (
              <button
                onClick={handlePrevImage}
                className="absolute left-3 z-10 p-2.5 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewAnexo.file_url}
              alt={previewAnexo.file_name}
              className="rounded-lg shadow-2xl object-contain"
              style={{
                maxHeight: 'calc(100vh - 140px)',
                maxWidth: '100%',
                width: 'auto',
                height: 'auto',
              }}
              onClick={e => e.stopPropagation()}
            />

            {/* Navegação próxima */}
            {previewIndex < imageAnexos.length - 1 && (
              <button
                onClick={handleNextImage}
                className="absolute right-3 z-10 p-2.5 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Miniaturas de navegação (quando há múltiplas imagens) */}
          {imageAnexos.length > 1 && (
            <div className="flex justify-center gap-2 pb-4 flex-shrink-0" onClick={e => e.stopPropagation()}>
              {imageAnexos.map((a, i) => (
                <button
                  key={a.id}
                  onClick={() => setPreviewAnexo(a)}
                  className={`w-2 h-2 rounded-full transition-all ${i === previewIndex ? 'bg-white scale-125' : 'bg-white/30 hover:bg-white/60'}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
