'use client'

import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type ScreenReaderInstructions,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { Columns3, Plus } from 'lucide-react'
import { EmptyState } from '@/components/somma'
import { TarefasCard } from '@/components/tarefas-card'
import { TarefasColumn } from '@/components/tarefas-column'
import { Button } from '@/components/ui/button'
import type {
  TarefasBoard,
  TarefasColumn as TarefasColumnType,
  TarefasTask,
} from '@/lib/services/tarefas'

interface TarefasKanbanBoardProps {
  board: TarefasBoard
  columns: TarefasColumnType[]
  tasks: TarefasTask[]
  onCardClick: (task: TarefasTask) => void
  onAddTask: (columnId: string) => void
  onMoveTask: (taskId: string, newColumnId: string) => void
  onMoveColumn: (columnId: string, newPosicao: number) => void
  onRenameColumn: (id: string, nome: string, cor: string) => void
  onDeleteColumn: (column: TarefasColumnType) => void
  onAddColumn: () => void
  canManageColumns?: boolean
}

const screenReaderInstructions: ScreenReaderInstructions = {
  draggable:
    'Pressione espaço para pegar o item. Use as setas para escolher o destino, espaço para soltar e escape para cancelar.',
}

export function TarefasKanbanBoard({
  columns,
  tasks,
  onCardClick,
  onAddTask,
  onMoveTask,
  onMoveColumn,
  onRenameColumn,
  onDeleteColumn,
  onAddColumn,
  canManageColumns = true,
}: TarefasKanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<TarefasTask | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const columnIds = useMemo(() => columns.map((c) => `col-${c.id}`), [columns])

  const labelFor = (id: string) => {
    if (id.startsWith('col-')) {
      return columns.find((c) => `col-${c.id}` === id)?.nome ?? 'coluna'
    }
    return tasks.find((t) => t.id === id)?.titulo ?? 'tarefa'
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Item ${labelFor(String(active.id))} pego.`,
    onDragOver: ({ active, over }) =>
      over
        ? `${labelFor(String(active.id))} está sobre ${labelFor(String(over.id))}.`
        : `${labelFor(String(active.id))} não está sobre um destino válido.`,
    onDragEnd: ({ active, over }) =>
      over
        ? `${labelFor(String(active.id))} solto em ${labelFor(String(over.id))}.`
        : `${labelFor(String(active.id))} solto sem alteração.`,
    onDragCancel: ({ active }) => `Movimentação de ${labelFor(String(active.id))} cancelada.`,
  }

  function getTasksForColumn(columnId: string) {
    return tasks.filter((t) => t.column_id === columnId).sort((a, b) => a.posicao - b.posicao)
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id)
    if (!id.startsWith('col-')) {
      const task = tasks.find((t) => t.id === id)
      if (task) setActiveTask(task)
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTask(null)
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    if (!activeId.startsWith('col-') && !overId.startsWith('col-')) {
      const task = tasks.find((t) => t.id === activeId)
      const overTask = tasks.find((t) => t.id === overId)
      if (task && overTask && task.column_id !== overTask.column_id) {
        onMoveTask(activeId, overTask.column_id)
      }
    }

    if (!activeId.startsWith('col-') && overId.startsWith('col-')) {
      const task = tasks.find((t) => t.id === activeId)
      const targetColumnId = overId.replace('col-', '')
      if (task && task.column_id !== targetColumnId) {
        onMoveTask(activeId, targetColumnId)
      }
    }

    if (activeId.startsWith('col-') && overId.startsWith('col-')) {
      const fromIndex = columns.findIndex((c) => `col-${c.id}` === activeId)
      const toIndex = columns.findIndex((c) => `col-${c.id}` === overId)
      if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
        onMoveColumn(activeId.replace('col-', ''), toIndex)
      }
    }
  }

  if (columns.length === 0) {
    return (
      <EmptyState
        icon={Columns3}
        title="Este quadro ainda não tem colunas"
        description="Colunas são as etapas do fluxo — por exemplo A fazer, Em andamento e Concluído. Crie a primeira para começar a organizar tarefas."
        action={
          canManageColumns ? (
            <Button onClick={onAddColumn}>
              <Plus aria-hidden="true" />
              Criar primeira coluna
            </Button>
          ) : undefined
        }
      />
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      accessibility={{ announcements, screenReaderInstructions }}
    >
      {/*
        `contain: paint` é obrigatório aqui, não é otimização.
        Sem ele, a largura das colunas propaga para a área de rolagem do
        documento mesmo com `overflow-x: auto` clipando visualmente: a página
        inteira passa a deslizar de lado e leva junto o cabeçalho e a barra
        inferior no celular. Com ele, a rolagem fica contida no quadro — e o
        navegador ainda ganha um limite de repintura num kanban grande.
      */}
      <div className="scroll-touch flex h-full snap-x snap-mandatory items-stretch gap-3 overflow-x-auto pb-4 pt-1 [contain:paint]">
        <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
          {columns.map((column) => (
            <TarefasColumn
              key={column.id}
              column={column}
              tasks={getTasksForColumn(column.id)}
              onCardClick={onCardClick}
              onAddTask={onAddTask}
              onRenameColumn={onRenameColumn}
              onDeleteColumn={onDeleteColumn}
            />
          ))}
        </SortableContext>

        {canManageColumns ? (
          <button
            type="button"
            onClick={onAddColumn}
            className="ds-tap flex w-48 shrink-0 snap-start items-center justify-center gap-2 self-start rounded-xl border border-dashed border-line px-4 py-4 text-sm font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <Plus aria-hidden="true" className="h-4 w-4" />
            Nova coluna
          </button>
        ) : null}
      </div>

      <DragOverlay>
        {activeTask ? <TarefasCard task={activeTask} onClick={() => {}} isDragOverlay /> : null}
      </DragOverlay>
    </DndContext>
  )
}
