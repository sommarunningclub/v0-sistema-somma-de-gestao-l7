// components/tarefas-card.tsx
'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Calendar, AlertTriangle } from 'lucide-react'
import { TAREFAS_PRIORIDADES } from '@/lib/tarefas-constants'
import type { TarefasTask } from '@/lib/services/tarefas'

interface TarefasCardProps {
  task: TarefasTask
  onClick: (task: TarefasTask) => void
  isDragOverlay?: boolean
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  return new Date(dateStr + 'T23:59:59') < new Date()
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}`
}

export function TarefasCard({ task, onClick, isDragOverlay = false }: TarefasCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const prioridade = TAREFAS_PRIORIDADES.find(p => p.id === task.prioridade)
  const done = task.checklist.filter(i => i.concluido).length
  const total = task.checklist.length
  const progress = total > 0 ? Math.round((done / total) * 100) : 0
  const overdue = isOverdue(task.data_entrega) && !task.concluida

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group bg-neutral-800/80 border rounded-lg mb-2 cursor-pointer select-none transition-colors
        ${isDragOverlay ? 'border-orange-500/60 shadow-lg shadow-orange-500/10 rotate-2' : 'border-neutral-700/60 hover:border-neutral-600'}
        ${task.concluida ? 'opacity-60' : ''}
      `}
      onClick={() => onClick(task)}
    >
      <div className="p-3">
        {/* Top row: priority + drag handle */}
        <div className="flex items-center justify-between mb-2">
          {prioridade && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${prioridade.badgeBg} ${prioridade.badgeText}`}>
              {prioridade.label.toUpperCase()}
            </span>
          )}
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 -mr-1 text-neutral-600 hover:text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={e => e.stopPropagation()}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Title */}
        <p className={`text-sm font-semibold leading-snug mb-2 ${task.concluida ? 'line-through text-neutral-500' : 'text-white'}`}>
          {task.titulo}
        </p>

        {/* Checklist progress */}
        {total > 0 && (
          <div className="mb-2">
            <div className="flex justify-between mb-1">
              <span className="text-neutral-500 text-[10px]">{done}/{total} itens</span>
              <span className="text-[10px] font-semibold text-orange-400">{progress}%</span>
            </div>
            <div className="h-1 bg-neutral-700 rounded-full">
              <div
                className="h-1 bg-orange-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer: assignee + due date */}
        <div className="flex items-center justify-between mt-1">
          {task.responsavel_nome ? (
            <div className="w-6 h-6 rounded-full bg-neutral-700 flex items-center justify-center text-[9px] font-bold text-neutral-300 flex-shrink-0">
              {getInitials(task.responsavel_nome)}
            </div>
          ) : <div />}

          <div className="flex items-center gap-1">
            {overdue && <AlertTriangle className="w-3 h-3 text-red-400" />}
            {task.data_entrega && (
              <span className={`text-[10px] flex items-center gap-0.5 ${overdue ? 'text-red-400 font-semibold' : 'text-neutral-500'}`}>
                <Calendar className="w-2.5 h-2.5" />
                {formatDate(task.data_entrega)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
