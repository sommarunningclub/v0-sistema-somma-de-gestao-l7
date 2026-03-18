// components/tarefas-column.tsx
'use client'

import { useState, useRef } from 'react'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, GripVertical, Pencil, Check, X, Trash2 } from 'lucide-react'
import { TarefasCard } from '@/components/tarefas-card'
import { COLUMN_COLORS } from '@/lib/tarefas-constants'
import type { TarefasColumn as TarefasColumnType, TarefasTask } from '@/lib/services/tarefas'

interface TarefasColumnProps {
  column: TarefasColumnType
  tasks: TarefasTask[]
  onCardClick: (task: TarefasTask) => void
  onAddTask: (columnId: string) => void
  onRenameColumn: (id: string, nome: string, cor: string) => void
  onDeleteColumn: (column: TarefasColumnType) => void
}

export function TarefasColumn({
  column, tasks, onCardClick, onAddTask, onRenameColumn, onDeleteColumn
}: TarefasColumnProps) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(column.nome)
  const [editColor, setEditColor] = useState(column.cor)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: `col-${column.id}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const handleStartEdit = () => {
    setEditName(column.nome)
    setEditColor(column.cor)
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleSaveEdit = () => {
    if (editName.trim()) {
      onRenameColumn(column.id, editName.trim(), editColor)
    }
    setEditing(false)
  }

  const taskIds = tasks.map(t => t.id)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex-shrink-0 w-64 flex flex-col bg-neutral-900 border border-neutral-800 rounded-xl"
    >
      {/* Column header */}
      <div className="px-3 py-2.5 flex items-center gap-2 border-b border-neutral-800">
        {/* Drag handle for column */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-neutral-600 hover:text-neutral-400 flex-shrink-0"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: column.cor }}
        />

        {editing ? (
          <div className="flex-1 flex flex-col gap-1">
            <input
              ref={inputRef}
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditing(false) }}
              className="flex-1 bg-neutral-800 text-white text-xs font-semibold rounded px-2 py-1 border border-neutral-600 outline-none w-full"
            />
            <div className="flex gap-1">
              {COLUMN_COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setEditColor(c.value)}
                  className={`w-4 h-4 rounded-full border-2 transition-all ${editColor === c.value ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
            <div className="flex gap-1 mt-0.5">
              <button onClick={handleSaveEdit} className="p-1 text-green-400 hover:text-green-300"><Check className="w-3 h-3" /></button>
              <button onClick={() => setEditing(false)} className="p-1 text-neutral-500 hover:text-neutral-300"><X className="w-3 h-3" /></button>
            </div>
          </div>
        ) : (
          <>
            <span className="flex-1 text-xs font-bold text-neutral-300 uppercase tracking-wide truncate">
              {column.nome}
            </span>
            <span className="text-[10px] text-neutral-600 font-mono">{tasks.length}</span>
            <button onClick={handleStartEdit} className="p-1 text-neutral-600 hover:text-neutral-400 flex-shrink-0">
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={() => onDeleteColumn(column)}
              className="p-1 text-neutral-600 hover:text-red-400 flex-shrink-0"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 overflow-y-auto min-h-[60px]">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TarefasCard key={task.id} task={task} onClick={onCardClick} />
          ))}
        </SortableContext>
      </div>

      {/* Add card button */}
      <button
        onClick={() => onAddTask(column.id)}
        className="mx-2 mb-2 flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors text-xs"
      >
        <Plus className="w-3.5 h-3.5" />
        Adicionar tarefa
      </button>
    </div>
  )
}
