// components/tarefas-kanban-board.tsx
'use client'

import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { TarefasColumn } from '@/components/tarefas-column'
import { TarefasCard } from '@/components/tarefas-card'
import type { TarefasBoard, TarefasColumn as TarefasColumnType, TarefasTask } from '@/lib/services/tarefas'

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
}

export function TarefasKanbanBoard({
  columns, tasks, onCardClick, onAddTask, onMoveTask,
  onMoveColumn, onRenameColumn, onDeleteColumn, onAddColumn,
}: TarefasKanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<TarefasTask | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  )

  const columnIds = columns.map(c => `col-${c.id}`)

  function getTasksForColumn(columnId: string) {
    return tasks
      .filter(t => t.column_id === columnId)
      .sort((a, b) => a.posicao - b.posicao)
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id)
    // Only track task drags (not columns)
    if (!id.startsWith('col-')) {
      const task = tasks.find(t => t.id === id)
      if (task) setActiveTask(task)
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTask(null)
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    // Task moved to a different column
    if (!activeId.startsWith('col-') && !overId.startsWith('col-')) {
      const task = tasks.find(t => t.id === activeId)
      const overTask = tasks.find(t => t.id === overId)
      if (task && overTask && task.column_id !== overTask.column_id) {
        onMoveTask(activeId, overTask.column_id)
      }
    }

    // Task dropped onto column header area
    if (!activeId.startsWith('col-') && overId.startsWith('col-')) {
      const task = tasks.find(t => t.id === activeId)
      const targetColumnId = overId.replace('col-', '')
      if (task && task.column_id !== targetColumnId) {
        onMoveTask(activeId, targetColumnId)
      }
    }

    // Column reordered
    if (activeId.startsWith('col-') && overId.startsWith('col-')) {
      const fromIndex = columns.findIndex(c => `col-${c.id}` === activeId)
      const toIndex = columns.findIndex(c => `col-${c.id}` === overId)
      if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
        onMoveColumn(activeId.replace('col-', ''), toIndex)
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 h-full items-start pt-1 px-1">
        <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
          {columns.map(column => (
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

        {/* Add column */}
        <button
          onClick={onAddColumn}
          className="flex-shrink-0 w-48 h-16 border-2 border-dashed border-neutral-700 rounded-xl flex items-center justify-center gap-2 text-neutral-500 hover:text-neutral-300 hover:border-neutral-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="text-xs font-medium">Nova Coluna</span>
        </button>
      </div>

      {/* Drag overlay (ghost card while dragging) */}
      <DragOverlay>
        {activeTask && (
          <TarefasCard task={activeTask} onClick={() => {}} isDragOverlay />
        )}
      </DragOverlay>
    </DndContext>
  )
}
