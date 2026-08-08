// components/tarefas-board-modal.tsx
'use client'

import * as React from 'react'
import { Trash2 } from 'lucide-react'
import { ResponsiveModal, SectionTitle, confirmAction, notify } from '@/components/somma'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { TarefasBoard } from '@/lib/services/tarefas'

interface TarefasBoardModalProps {
  board: Partial<TarefasBoard> | null
  isNew: boolean
  onClose: () => void
  onSave: (board: Partial<TarefasBoard>) => void | Promise<void>
  onDelete?: (id: string) => void | Promise<void>
}

export function TarefasBoardModal({
  board,
  isNew,
  onClose,
  onSave,
  onDelete,
}: TarefasBoardModalProps) {
  const [nome, setNome] = React.useState(board?.nome || '')
  const [descricao, setDescricao] = React.useState(board?.descricao || '')
  const [saving, setSaving] = React.useState(false)
  const [touched, setTouched] = React.useState(false)
  const nomeId = React.useId()
  const descricaoId = React.useId()
  const errorId = React.useId()

  const dirty = nome !== (board?.nome || '') || descricao !== (board?.descricao || '')
  const invalid = touched && !nome.trim()

  const handleClose = async () => {
    if (dirty && !saving) {
      const leave = await confirmAction({
        title: 'Descartar alterações?',
        description: 'As alterações feitas neste quadro não foram salvas.',
        confirmLabel: 'Descartar',
        cancelLabel: 'Continuar editando',
        tone: 'danger',
      })
      if (!leave) return
    }
    onClose()
  }

  const handleSave = async () => {
    setTouched(true)
    if (!nome.trim()) return
    setSaving(true)
    try {
      await onSave({
        ...(board?.id && { id: board.id }),
        nome: nome.trim(),
        descricao: descricao.trim() || null,
      })
      notify.success(isNew ? 'Quadro criado.' : 'Quadro atualizado.')
      onClose()
    } catch {
      notify.error('Não foi possível salvar o quadro.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!board?.id || !onDelete) return
    const confirmed = await confirmAction({
      title: 'Excluir este quadro?',
      description:
        'O quadro sai da lista junto com suas colunas e tarefas. Esta ação não pode ser desfeita.',
      detail: board.nome,
      tone: 'danger',
    })
    if (!confirmed) return
    try {
      await onDelete(board.id)
      notify.success('Quadro excluído.')
      onClose()
    } catch {
      notify.error('Não foi possível excluir o quadro.')
    }
  }

  return (
    <ResponsiveModal
      open
      onOpenChange={(open) => {
        if (!open) void handleClose()
      }}
      dismissible={!saving}
      size="sm"
      title={isNew ? 'Novo quadro' : 'Editar quadro'}
      description={
        isNew
          ? 'Quadros agrupam colunas e tarefas de uma mesma frente de trabalho.'
          : undefined
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
          <Button onClick={handleSave} loading={saving} disabled={!nome.trim()}>
            {isNew ? 'Criar quadro' : 'Salvar'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <SectionTitle as="h3" title="Identificação" />

        <div>
          <label htmlFor={nomeId} className="mb-1 block text-meta text-ink-muted">
            Nome <span className="text-danger">*</span>
          </label>
          <Input
            id={nomeId}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder="Ex.: Operações Somma Club"
            autoFocus
            required
            aria-invalid={invalid}
            aria-describedby={invalid ? errorId : undefined}
          />
          {invalid ? (
            <p id={errorId} role="alert" className="mt-1 text-meta text-danger">
              Informe um nome para o quadro.
            </p>
          ) : null}
        </div>

        <div>
          <label htmlFor={descricaoId} className="mb-1 block text-meta text-ink-muted">
            Descrição
          </label>
          <Input
            id={descricaoId}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Opcional"
          />
        </div>
      </div>
    </ResponsiveModal>
  )
}
