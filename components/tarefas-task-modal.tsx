// components/tarefas-task-modal.tsx
'use client'

import * as React from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Paperclip,
  Plus,
  Trash2,
  ZoomIn,
} from 'lucide-react'
import {
  EmptyState,
  ResponsiveModal,
  SectionTitle,
  SegmentedControl,
  Skeleton,
  confirmAction,
  notify,
} from '@/components/somma'
import { PriorityPill } from '@/components/tarefas-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TAREFAS_PRIORIDADES } from '@/lib/tarefas-constants'
import { getSession } from '@/components/protected-route'
import { apiFetch } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import type {
  ChecklistItem,
  TarefasAnexo,
  TarefasColumn,
  TarefasTask,
  TarefasUser,
} from '@/lib/services/tarefas'

/**
 * Modal de tarefa.
 *
 * Formulário e anexos vivem no mesmo diálogo responsivo do design system —
 * bottom sheet no celular, diálogo no desktop — com foco preso, ESC e
 * confirmação antes de descartar alterações não salvas.
 */

interface TarefasTaskModalProps {
  task: Partial<TarefasTask> | null
  isNew: boolean
  columns: TarefasColumn[]
  users: TarefasUser[]
  defaultColumnId?: string
  onClose: () => void
  onSave: (task: Partial<TarefasTask>) => void | Promise<void>
  onDelete?: (id: string) => void | Promise<void>
}

type TaskTab = 'detalhes' | 'anexos'

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

function fileBadge(fileType: string): { label: string; className: string } {
  if (fileType === 'application/pdf')
    return { label: 'PDF', className: 'border-danger-border bg-danger-soft text-danger' }
  if (fileType.includes('word') || fileType.includes('document'))
    return { label: 'DOC', className: 'border-info-border bg-info-soft text-info' }
  if (fileType.includes('excel') || fileType.includes('sheet'))
    return { label: 'XLS', className: 'border-success-border bg-success-soft text-success' }
  if (fileType.includes('presentation') || fileType.includes('powerpoint'))
    return { label: 'PPT', className: 'border-brand-border bg-brand-soft text-brand-strong' }
  if (fileType === 'text/csv')
    return { label: 'CSV', className: 'border-info-border bg-info-soft text-info' }
  return { label: 'ARQ', className: 'border-line bg-surface-sunken text-ink-muted' }
}

/** Classe compartilhada pelos `select` nativos do formulário. */
const SELECT_CLASS =
  'h-11 w-full rounded-lg border border-line bg-surface-sunken px-3 text-base text-ink transition-colors hover:border-line-strong focus-visible:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand lg:h-10'

export function TarefasTaskModal({
  task,
  isNew,
  columns,
  users,
  defaultColumnId,
  onClose,
  onSave,
  onDelete,
}: TarefasTaskModalProps) {
  const session = getSession()
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const initial = React.useRef({
    titulo: task?.titulo || '',
    descricao: task?.descricao || '',
    prioridade: task?.prioridade || 'media',
    responsavelId: task?.responsavel_id || '',
    dataEntrega: task?.data_entrega || '',
    columnId: task?.column_id || defaultColumnId || '',
    checklist: JSON.stringify(task?.checklist || []),
  })

  const [titulo, setTitulo] = React.useState(initial.current.titulo)
  const [descricao, setDescricao] = React.useState(initial.current.descricao)
  const [prioridade, setPrioridade] = React.useState(initial.current.prioridade)
  const [responsavelId, setResponsavelId] = React.useState(initial.current.responsavelId)
  const [dataEntrega, setDataEntrega] = React.useState(initial.current.dataEntrega)
  const [columnId, setColumnId] = React.useState(initial.current.columnId)
  const [checklist, setChecklist] = React.useState<ChecklistItem[]>(task?.checklist || [])
  const [newItem, setNewItem] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [touched, setTouched] = React.useState(false)

  const [anexos, setAnexos] = React.useState<TarefasAnexo[]>([])
  const [anexosLoading, setAnexosLoading] = React.useState(!isNew && Boolean(task?.id))
  const [uploading, setUploading] = React.useState(false)
  const [previewAnexo, setPreviewAnexo] = React.useState<TarefasAnexo | null>(null)
  const [activeTab, setActiveTab] = React.useState<TaskTab>('detalhes')

  const tituloId = React.useId()
  const descricaoId = React.useId()
  const prioridadeId = React.useId()
  const columnFieldId = React.useId()
  const responsavelId_ = React.useId()
  const dataId = React.useId()
  const novoItemId = React.useId()
  const tituloErrorId = React.useId()
  const columnErrorId = React.useId()

  const selectedUser = users.find((u) => u.id === responsavelId)

  const loadAnexos = React.useCallback(async () => {
    if (!task?.id) return
    try {
      const res = await apiFetch(`/api/tarefas/tasks/${task.id}/attachments`)
      if (res.ok) setAnexos(await res.json())
    } finally {
      setAnexosLoading(false)
    }
  }, [task?.id])

  React.useEffect(() => {
    void loadAnexos()
  }, [loadAnexos])

  const dirty =
    titulo !== initial.current.titulo ||
    descricao !== initial.current.descricao ||
    prioridade !== initial.current.prioridade ||
    responsavelId !== initial.current.responsavelId ||
    dataEntrega !== initial.current.dataEntrega ||
    columnId !== initial.current.columnId ||
    JSON.stringify(checklist) !== initial.current.checklist

  const tituloInvalid = touched && !titulo.trim()
  const columnInvalid = touched && !columnId

  const handleClose = async () => {
    if (dirty && !saving) {
      const leave = await confirmAction({
        title: 'Descartar alterações?',
        description: 'Esta tarefa tem alterações que ainda não foram salvas.',
        confirmLabel: 'Descartar',
        cancelLabel: 'Continuar editando',
        tone: 'danger',
      })
      if (!leave) return
    }
    onClose()
  }

  const handleAddChecklistItem = () => {
    if (!newItem.trim()) return
    setChecklist((prev) => [...prev, { id: generateId(), texto: newItem.trim(), concluido: false }])
    setNewItem('')
  }

  const handleToggleItem = (id: string) => {
    setChecklist((prev) =>
      prev.map((i) => (i.id === id ? { ...i, concluido: !i.concluido } : i)),
    )
  }

  const handleRemoveItem = (id: string) => {
    setChecklist((prev) => prev.filter((i) => i.id !== id))
  }

  const handleSave = async () => {
    setTouched(true)
    if (!titulo.trim() || !columnId) {
      setActiveTab('detalhes')
      notify.warning('Preencha o título e a coluna da tarefa.')
      return
    }
    setSaving(true)
    const col = columns.find((c) => c.id === columnId)
    try {
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
      notify.success(isNew ? 'Tarefa criada.' : 'Tarefa atualizada.')
      onClose()
    } catch {
      notify.error('Não foi possível salvar a tarefa.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!task?.id || !onDelete) return
    const confirmed = await confirmAction({
      title: 'Excluir esta tarefa?',
      description: 'A tarefa sai do quadro junto com seu checklist. Esta ação não pode ser desfeita.',
      detail: task.titulo,
      tone: 'danger',
    })
    if (!confirmed) return
    try {
      await onDelete(task.id)
      notify.success('Tarefa excluída.')
      onClose()
    } catch {
      notify.error('Não foi possível excluir a tarefa.')
    }
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
        notify.error('Falha ao enviar o arquivo.')
        return
      }

      const { data: urlData } = supabase.storage.from('tarefas-anexos').getPublicUrl(fileName)

      const res = await apiFetch(`/api/tarefas/tasks/${task.id}/attachments`, {
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

      if (res.ok) {
        await loadAnexos()
        notify.success('Anexo enviado.')
      } else {
        notify.error('Falha ao registrar o anexo.')
      }
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDeleteAnexo = async (anexo: TarefasAnexo) => {
    if (!task?.id) return
    const confirmed = await confirmAction({
      title: 'Excluir anexo?',
      description: 'O arquivo deixa de ficar disponível nesta tarefa.',
      detail: anexo.file_name,
      tone: 'danger',
    })
    if (!confirmed) return
    const res = await apiFetch(
      `/api/tarefas/tasks/${task.id}/attachments?attachmentId=${anexo.id}`,
      { method: 'DELETE' },
    )
    if (res.ok) {
      setAnexos((prev) => prev.filter((a) => a.id !== anexo.id))
      notify.success('Anexo excluído.')
    } else {
      notify.error('Não foi possível excluir o anexo.')
    }
  }

  const imageAnexos = anexos.filter((a) => isImage(a.file_type))
  const fileAnexos = anexos.filter((a) => !isImage(a.file_type))
  const previewIndex = previewAnexo ? imageAnexos.findIndex((a) => a.id === previewAnexo.id) : -1

  const handleAnexoClick = (anexo: TarefasAnexo) => {
    if (isImage(anexo.file_type)) {
      setPreviewAnexo(anexo)
    } else {
      window.open(anexo.file_url, '_blank', 'noopener,noreferrer')
    }
  }

  const doneItems = checklist.filter((i) => i.concluido).length

  return (
    <>
      <ResponsiveModal
        open
        onOpenChange={(open) => {
          if (!open) void handleClose()
        }}
        dismissible={!saving}
        size="lg"
        title={isNew ? 'Nova tarefa' : 'Editar tarefa'}
        description={
          isNew ? 'Defina título, coluna e prazo. O restante pode ser ajustado depois.' : undefined
        }
        footer={
          <>
            {!isNew && onDelete ? (
              <Button variant="ghost" onClick={handleDelete} className="mr-auto text-danger">
                <Trash2 aria-hidden="true" />
                Excluir
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => void handleClose()}>
              Cancelar
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {isNew ? 'Criar tarefa' : 'Salvar'}
            </Button>
          </>
        }
      >
        {!isNew ? (
          <div className="mb-5">
            <SegmentedControl<TaskTab>
              label="Seção da tarefa"
              value={activeTab}
              onChange={setActiveTab}
              options={[
                { value: 'detalhes', label: 'Detalhes' },
                { value: 'anexos', label: `Anexos${anexos.length ? ` (${anexos.length})` : ''}`, icon: Paperclip },
              ]}
            />
          </div>
        ) : null}

        {isNew || activeTab === 'detalhes' ? (
          <div className="space-y-6">
            <section>
              <SectionTitle as="h3" title="Descrição" />
              <div className="space-y-4">
                <div>
                  <label htmlFor={tituloId} className="mb-1 block text-meta text-ink-muted">
                    Título <span className="text-danger">*</span>
                  </label>
                  <Input
                    id={tituloId}
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    onBlur={() => setTouched(true)}
                    placeholder="Nome da tarefa"
                    required
                    autoFocus={isNew}
                    enterKeyHint="next"
                    aria-invalid={tituloInvalid}
                    aria-describedby={tituloInvalid ? tituloErrorId : undefined}
                  />
                  {tituloInvalid ? (
                    <p id={tituloErrorId} role="alert" className="mt-1 text-meta text-danger">
                      Informe um título para a tarefa.
                    </p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor={descricaoId} className="mb-1 block text-meta text-ink-muted">
                    Detalhes
                  </label>
                  <textarea
                    id={descricaoId}
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    rows={3}
                    placeholder="Contexto, links, critérios de conclusão..."
                    className="w-full resize-y rounded-lg border border-line bg-surface-sunken px-3.5 py-2.5 text-base text-ink transition-colors placeholder:text-ink-subtle hover:border-line-strong focus-visible:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand"
                  />
                </div>
              </div>
            </section>

            <section>
              <SectionTitle as="h3" title="Classificação" />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor={prioridadeId} className="mb-1 block text-meta text-ink-muted">
                    Prioridade
                  </label>
                  <select
                    id={prioridadeId}
                    value={prioridade}
                    onChange={(e) => setPrioridade(e.target.value as TarefasTask['prioridade'])}
                    className={SELECT_CLASS}
                  >
                    {TAREFAS_PRIORIDADES.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <div className="mt-2">
                    <PriorityPill prioridade={prioridade} />
                  </div>
                </div>

                <div>
                  <label htmlFor={columnFieldId} className="mb-1 block text-meta text-ink-muted">
                    Coluna <span className="text-danger">*</span>
                  </label>
                  <select
                    id={columnFieldId}
                    value={columnId}
                    onChange={(e) => setColumnId(e.target.value)}
                    onBlur={() => setTouched(true)}
                    required
                    aria-invalid={columnInvalid}
                    aria-describedby={columnInvalid ? columnErrorId : undefined}
                    className={cn(SELECT_CLASS, columnInvalid && 'border-danger')}
                  >
                    <option value="">Selecionar...</option>
                    {columns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </select>
                  {columnInvalid ? (
                    <p id={columnErrorId} role="alert" className="mt-1 text-meta text-danger">
                      Escolha em qual coluna a tarefa entra.
                    </p>
                  ) : null}
                </div>
              </div>
            </section>

            <section>
              <SectionTitle as="h3" title="Responsável e prazo" />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor={responsavelId_} className="mb-1 block text-meta text-ink-muted">
                    Responsável
                  </label>
                  <select
                    id={responsavelId_}
                    value={responsavelId}
                    onChange={(e) => setResponsavelId(e.target.value)}
                    className={SELECT_CLASS}
                  >
                    <option value="">Ninguém atribuído</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.full_name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor={dataId} className="mb-1 block text-meta text-ink-muted">
                    Data de entrega
                  </label>
                  <Input
                    id={dataId}
                    type="date"
                    value={dataEntrega ? dataEntrega.split('T')[0] : ''}
                    onChange={(e) => setDataEntrega(e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section>
              <SectionTitle
                as="h3"
                title="Checklist"
                meta={checklist.length > 0 ? `${doneItems}/${checklist.length} concluídos` : undefined}
              />

              {checklist.length > 0 ? (
                <ul className="mb-3 space-y-1.5">
                  {checklist.map((item) => (
                    <li key={item.id} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleItem(item.id)}
                        aria-pressed={item.concluido}
                        aria-label={`${item.concluido ? 'Desmarcar' : 'Marcar'} ${item.texto}`}
                        className={cn(
                          'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                          'hover:bg-surface-hover',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-5 w-5 items-center justify-center rounded border',
                            item.concluido
                              ? 'border-brand bg-brand text-white'
                              : 'border-line-strong bg-surface-sunken',
                          )}
                        >
                          {item.concluido ? (
                            <Check aria-hidden="true" className="h-3.5 w-3.5" />
                          ) : null}
                        </span>
                      </button>
                      <span
                        className={cn(
                          'min-w-0 flex-1 text-sm',
                          item.concluido ? 'text-ink-muted line-through' : 'text-ink',
                        )}
                      >
                        {item.texto}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(item.id)}
                        aria-label={`Remover item ${item.texto}`}
                        className="hover:text-danger"
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}

              <div className="flex gap-2">
                <label htmlFor={novoItemId} className="sr-only">
                  Novo item do checklist
                </label>
                <Input
                  id={novoItemId}
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleAddChecklistItem()
                    }
                  }}
                  enterKeyHint="done"
                  placeholder="Adicionar item..."
                />
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handleAddChecklistItem}
                  disabled={!newItem.trim()}
                  aria-label="Adicionar item ao checklist"
                >
                  <Plus aria-hidden="true" />
                </Button>
              </div>
            </section>
          </div>
        ) : null}

        {!isNew && activeTab === 'anexos' ? (
          <div className="space-y-5">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileUpload}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
            />
            <Button
              variant="secondary"
              block
              loading={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip aria-hidden="true" />
              {uploading ? 'Enviando...' : 'Anexar arquivo'}
            </Button>

            {anexosLoading ? (
              <div className="space-y-2" aria-busy="true">
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
              </div>
            ) : anexos.length === 0 ? (
              <EmptyState
                compact
                icon={Paperclip}
                title="Nenhum anexo ainda"
                description="Imagens, PDFs e planilhas anexados aqui ficam disponíveis para todo o time."
              />
            ) : (
              <>
                {imageAnexos.length > 0 ? (
                  <section>
                    <SectionTitle as="h3" title="Imagens" meta={`${imageAnexos.length}`} />
                    <ul className="grid grid-cols-3 gap-2">
                      {imageAnexos.map((anexo) => (
                        <li key={anexo.id} className="group/img relative aspect-square">
                          <button
                            type="button"
                            onClick={() => handleAnexoClick(anexo)}
                            aria-label={`Ampliar ${anexo.file_name}`}
                            className="h-full w-full overflow-hidden rounded-lg border border-line bg-surface-sunken transition-colors hover:border-brand-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                          >
                            <img
                              src={anexo.file_url}
                              alt={anexo.file_name}
                              className="h-full w-full object-cover"
                            />
                            <span className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 transition-colors group-hover/img:bg-black/40">
                              <ZoomIn
                                aria-hidden="true"
                                className="h-5 w-5 text-white opacity-0 transition-opacity group-hover/img:opacity-100"
                              />
                            </span>
                          </button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleDeleteAnexo(anexo)}
                            aria-label={`Excluir ${anexo.file_name}`}
                            className="absolute right-1 top-1 bg-black/60 text-white hover:bg-black/80 hover:text-danger"
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                {fileAnexos.length > 0 ? (
                  <section>
                    <SectionTitle as="h3" title="Arquivos" meta={`${fileAnexos.length}`} />
                    <ul className="space-y-2">
                      {fileAnexos.map((anexo) => {
                        const badge = fileBadge(anexo.file_type)
                        return (
                          <li
                            key={anexo.id}
                            className="flex items-center gap-3 rounded-xl border border-line bg-surface-raised p-3"
                          >
                            <span
                              aria-hidden="true"
                              className={cn(
                                'flex h-10 w-10 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border',
                                badge.className,
                              )}
                            >
                              <FileText className="h-4 w-4" />
                              <span className="text-[0.5625rem] font-bold leading-none">
                                {badge.label}
                              </span>
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-ink-strong">
                                {anexo.file_name}
                              </span>
                              <span className="block text-micro text-ink-muted">
                                {badge.label} · {formatFileSize(anexo.file_size)}
                              </span>
                            </span>
                            <a
                              href={anexo.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Abrir ${anexo.file_name}`}
                              className="ds-tap flex w-11 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                            >
                              <Download aria-hidden="true" className="h-4 w-4" />
                            </a>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteAnexo(anexo)}
                              aria-label={`Excluir ${anexo.file_name}`}
                              className="hover:text-danger"
                            >
                              <Trash2 aria-hidden="true" />
                            </Button>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </ResponsiveModal>

      {previewAnexo ? (
        <ResponsiveModal
          open
          onOpenChange={(open) => {
            if (!open) setPreviewAnexo(null)
          }}
          size="xl"
          title={previewAnexo.file_name}
          description={`${formatFileSize(previewAnexo.file_size)}${
            imageAnexos.length > 1 ? ` · ${previewIndex + 1} de ${imageAnexos.length}` : ''
          }`}
          footer={
            <>
              {imageAnexos.length > 1 ? (
                <div className="mr-auto flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="icon"
                    disabled={previewIndex <= 0}
                    onClick={() => setPreviewAnexo(imageAnexos[previewIndex - 1])}
                    aria-label="Imagem anterior"
                  >
                    <ChevronLeft aria-hidden="true" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    disabled={previewIndex >= imageAnexos.length - 1}
                    onClick={() => setPreviewAnexo(imageAnexos[previewIndex + 1])}
                    aria-label="Próxima imagem"
                  >
                    <ChevronRight aria-hidden="true" />
                  </Button>
                </div>
              ) : null}
              <Button variant="secondary" asChild>
                <a
                  href={previewAnexo.file_url}
                  download={previewAnexo.file_name}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Download aria-hidden="true" />
                  Baixar
                </a>
              </Button>
              <Button onClick={() => setPreviewAnexo(null)}>Fechar</Button>
            </>
          }
        >
          <img
            src={previewAnexo.file_url}
            alt={previewAnexo.file_name}
            className="mx-auto max-h-[60vh] w-auto max-w-full rounded-lg"
          />
        </ResponsiveModal>
      ) : null}
    </>
  )
}
