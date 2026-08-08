'use client'

import { useRef, useState } from 'react'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Check, GripVertical, Pencil, Plus, Trash2, X } from 'lucide-react'
import { TarefasCard } from '@/components/tarefas-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { COLUMN_COLORS } from '@/lib/tarefas-constants'
import { cn } from '@/lib/utils'
import type { TarefasColumn as TarefasColumnType, TarefasTask } from '@/lib/services/tarefas'

/**
 * Coluna do kanban.
 *
 * No celular a coluna ocupa quase toda a largura e o container faz snap, para
 * que o gesto de "passar para a próxima etapa" seja discreto em vez de um
 * scroll livre que sempre para no meio de duas colunas.
 */

interface TarefasColumnProps {
  column: TarefasColumnType
  tasks: TarefasTask[]
  onCardClick: (task: TarefasTask) => void
  onAddTask: (columnId: string) => void
  onRenameColumn: (id: string, nome: string, cor: string) => void
  onDeleteColumn: (column: TarefasColumnType) => void
}

export function TarefasColumn({
  column,
  tasks,
  onCardClick,
  onAddTask,
  onRenameColumn,
  onDeleteColumn,
}: TarefasColumnProps) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(column.nome)
  const [editColor, setEditColor] = useState(column.cor)
  const inputRef = useRef<HTMLInputElement>(null)

  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
    useSortable({ id: `col-${column.id}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const handleStartEdit = () => {
    setEditName(column.nome)
    setEditColor(column.cor)
    setEditing(true)
    window.setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleSaveEdit = () => {
    if (editName.trim()) onRenameColumn(column.id, editName.trim(), editColor)
    setEditing(false)
  }

  const taskIds = tasks.map((t) => t.id)

  return (
    <section
      ref={setNodeRef}
      style={style}
      aria-label={`Coluna ${column.nome}, ${tasks.length} tarefa${tasks.length === 1 ? '' : 's'}`}
      className="flex w-[85vw] max-w-[20rem] shrink-0 snap-start flex-col rounded-xl border border-line bg-surface sm:w-72"
    >
      <header className="flex items-center gap-1.5 border-b border-line px-2 py-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reordenar coluna ${column.nome}`}
          className="flex h-11 w-8 shrink-0 cursor-grab items-center justify-center rounded-md text-ink-subtle transition-colors hover:text-ink active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <GripVertical aria-hidden="true" className="h-4 w-4" />
        </button>

        {editing ? (
          <div className="flex flex-1 flex-col gap-2 py-1">
            <Input
              ref={inputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveEdit()
                if (e.key === 'Escape') setEditing(false)
              }}
              aria-label="Nome da coluna"
            />
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Cor da coluna">
              {COLUMN_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setEditColor(c.value)}
                  aria-label={c.label}
                  aria-pressed={editColor === c.value}
                  className="flex h-11 w-11 items-center justify-center rounded-lg transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-transform',
                      editColor === c.value ? 'scale-110 border-ink-strong' : 'border-transparent',
                    )}
                    style={{ backgroundColor: c.value }}
                  >
                    {editColor === c.value ? (
                      <Check className="h-3 w-3 text-white drop-shadow" />
                    ) : null}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSaveEdit}>
                <Check aria-hidden="true" /> Salvar
              </Button>
              <Button variant="ghost" onClick={() => setEditing(false)}>
                <X aria-hidden="true" /> Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: column.cor }}
            />
            <h3 className="min-w-0 flex-1 truncate text-eyebrow font-bold uppercase tracking-wide text-ink">
              {column.nome}
            </h3>
            <span className="shrink-0 rounded-full bg-surface-sunken px-2 py-0.5 font-mono text-micro tabular-nums text-ink-muted">
              {tasks.length}
            </span>
            <Button
              size="icon"
              variant="ghost"
              onClick={handleStartEdit}
              aria-label={`Renomear coluna ${column.nome}`}
            >
              <Pencil aria-hidden="true" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => onDeleteColumn(column)}
              aria-label={`Excluir coluna ${column.nome}`}
              className="hover:text-danger"
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </>
        )}
      </header>

      <div
        className={cn(
          'scroll-touch min-h-[5rem] flex-1 overflow-y-auto p-2 transition-colors',
          isOver && 'bg-brand-soft',
        )}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TarefasCard key={task.id} task={task} onClick={onCardClick} />
          ))}
        </SortableContext>

        {tasks.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-meta text-ink-subtle">
            <span className="lg:hidden">Nenhuma tarefa nesta coluna.</span>
            <span className="hidden lg:inline">
              Nenhuma tarefa aqui. Arraste um cartão ou crie a primeira.
            </span>
          </p>
        ) : null}
      </div>

      <div className="border-t border-line p-2">
        <Button variant="ghost" block onClick={() => onAddTask(column.id)}>
          <Plus aria-hidden="true" />
          Adicionar tarefa
          <span className="sr-only">em {column.nome}</span>
        </Button>
      </div>
    </section>
  )
}
