'use client'

import * as React from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  AlertOctagon,
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Equal,
  GripVertical,
} from 'lucide-react'
import { StatusPill, type StatusTone } from '@/components/somma'
import { cn } from '@/lib/utils'
import type { TarefaPrioridade } from '@/lib/tarefas-constants'
import type { TarefasTask } from '@/lib/services/tarefas'

/**
 * Cartão de tarefa do kanban.
 *
 * Prioridade nunca é comunicada só por cor: cada nível carrega ícone + rótulo
 * (`PriorityPill`). O mesmo mapa é reutilizado pelos calendários para que
 * "urgente" tenha a mesma leitura em todas as visões do módulo.
 */

interface PriorityMeta {
  label: string
  tone: StatusTone
  Icon: React.ElementType
  /** Barra lateral usada nas visões de calendário. */
  bar: string
}

export const PRIORITY_META: Record<TarefaPrioridade, PriorityMeta> = {
  urgente: { label: 'Urgente', tone: 'danger', Icon: AlertOctagon, bar: 'bg-danger' },
  alta: { label: 'Alta', tone: 'warning', Icon: ArrowUp, bar: 'bg-warning' },
  media: { label: 'Média', tone: 'info', Icon: Equal, bar: 'bg-info' },
  baixa: { label: 'Baixa', tone: 'neutral', Icon: ArrowDown, bar: 'bg-ink-subtle' },
}

export function priorityMeta(prioridade: string | null | undefined): PriorityMeta {
  return PRIORITY_META[(prioridade ?? 'media') as TarefaPrioridade] ?? PRIORITY_META.media
}

export function PriorityPill({
  prioridade,
  size = 'sm',
  className,
}: {
  prioridade: string | null | undefined
  size?: 'sm' | 'md'
  className?: string
}) {
  const { label, tone, Icon } = priorityMeta(prioridade)
  return (
    <StatusPill tone={tone} size={size} dot={false} className={className}>
      <Icon aria-hidden="true" className="h-3 w-3 shrink-0" />
      <span className="sr-only">Prioridade </span>
      {label}
    </StatusPill>
  )
}

export function initialsOf(name: string | null | undefined): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** `true` quando a data de entrega já passou (fim do dia como limite). */
export function isOverdue(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const day = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr
  return new Date(`${day}T23:59:59`) < new Date()
}

/** `18/03` — rótulo curto usado nos cartões. */
export function formatShortDate(dateStr: string): string {
  const parts = (dateStr.includes('T') ? dateStr.split('T')[0] : dateStr).split('-')
  return `${parts[2]}/${parts[1]}`
}

/** `terça-feira, 18 de março de 2026` — usado em `aria-label`. */
export function formatLongDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

interface TarefasCardProps {
  task: TarefasTask
  onClick: (task: TarefasTask) => void
  isDragOverlay?: boolean
}

export function TarefasCard({ task, onClick, isDragOverlay = false }: TarefasCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const done = task.checklist.filter((i) => i.concluido).length
  const total = task.checklist.length
  const progress = total > 0 ? Math.round((done / total) * 100) : 0
  const overdue = isOverdue(task.data_entrega) && !task.concluida

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group mb-2 rounded-xl border bg-surface-raised transition-colors',
        isDragOverlay
          ? 'border-brand-border shadow-overlay'
          : 'border-line hover:border-line-strong',
        task.concluida && 'opacity-70',
      )}
    >
      <div className="flex items-start gap-1 p-1">
        <button
          type="button"
          onClick={() => onClick(task)}
          className="min-w-0 flex-1 rounded-lg px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <PriorityPill prioridade={task.prioridade} />
            {task.concluida ? (
              <StatusPill tone="success" size="sm">
                Concluída
              </StatusPill>
            ) : null}
          </div>

          <p
            className={cn(
              'mt-2 text-sm font-semibold leading-snug',
              task.concluida ? 'text-ink-muted line-through' : 'text-ink-strong',
            )}
          >
            {task.titulo}
          </p>

          {total > 0 ? (
            <div className="mt-2.5">
              <div className="mb-1 flex items-center justify-between text-micro text-ink-muted">
                <span>
                  {done}/{total} itens
                </span>
                <span className="font-semibold text-ink">{progress}%</span>
              </div>
              <div
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Checklist: ${done} de ${total} itens concluídos`}
                className="h-1 overflow-hidden rounded-full bg-surface-sunken"
              >
                <div className="h-full rounded-full bg-brand" style={{ width: `${progress}%` }} />
              </div>
            </div>
          ) : null}

          <div className="mt-2.5 flex items-center justify-between gap-2">
            {task.responsavel_nome ? (
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-active text-[0.625rem] font-bold text-ink"
                >
                  {initialsOf(task.responsavel_nome)}
                </span>
                <span className="truncate text-micro text-ink-muted">
                  {task.responsavel_nome}
                </span>
              </span>
            ) : (
              <span className="text-micro text-ink-subtle">Sem responsável</span>
            )}

            {task.data_entrega ? (
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-1 text-micro',
                  overdue ? 'font-semibold text-danger' : 'text-ink-muted',
                )}
              >
                <CalendarClock aria-hidden="true" className="h-3 w-3" />
                {formatShortDate(task.data_entrega)}
                {overdue ? <span className="sr-only">(vencida)</span> : null}
                {overdue ? <span aria-hidden="true">· vencida</span> : null}
              </span>
            ) : null}
          </div>
        </button>

        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Mover tarefa ${task.titulo}`}
          className="ds-tap flex w-9 shrink-0 cursor-grab items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
        >
          <GripVertical aria-hidden="true" className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
