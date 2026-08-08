'use client'

import * as React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, formatISO, startOfWeek } from 'date-fns'
import { Panel } from '@/components/somma'
import { Button } from '@/components/ui/button'
import {
  PriorityPill,
  formatLongDate,
  initialsOf,
  isOverdue,
  priorityMeta,
} from '@/components/tarefas-card'
import { cn } from '@/lib/utils'
import type { TarefasTask } from '@/lib/services/tarefas'

/**
 * Visão de semana.
 *
 * No desktop são sete colunas; no celular a mesma semana vira uma lista
 * vertical por dia — mais legível que sete colunas de 50px e mantendo o
 * mesmo cabeçalho de navegação.
 */

interface TarefasCalendarWeekProps {
  tasks: TarefasTask[]
  onTaskClick: (taskId: string) => void
}

function TaskButton({
  task,
  onTaskClick,
  compact = false,
}: {
  task: TarefasTask
  onTaskClick: (taskId: string) => void
  compact?: boolean
}) {
  const overdue = isOverdue(task.data_entrega) && !task.concluida

  return (
    <button
      type="button"
      onClick={() => onTaskClick(task.id)}
      className={cn(
        'flex w-full items-start gap-2 rounded-lg border border-line bg-surface-raised p-2.5 text-left transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
        !compact && 'ds-tap',
        task.concluida && 'opacity-70',
      )}
    >
      <span
        aria-hidden="true"
        className={cn('mt-0.5 h-full min-h-[1.75rem] w-1 shrink-0 rounded-full', priorityMeta(task.prioridade).bar)}
      />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-[0.8125rem] font-medium leading-snug',
            task.concluida ? 'text-ink-muted line-through' : 'text-ink-strong',
          )}
        >
          {task.titulo}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <PriorityPill prioridade={task.prioridade} />
          {overdue ? <span className="text-micro font-semibold text-danger">Vencida</span> : null}
        </span>
        {task.responsavel_nome ? (
          <span className="mt-1 block truncate text-micro text-ink-muted">
            {initialsOf(task.responsavel_nome)} · {task.responsavel_nome}
          </span>
        ) : null}
      </span>
    </button>
  )
}

export const TarefasCalendarWeek: React.FC<TarefasCalendarWeekProps> = ({ tasks, onTaskClick }) => {
  const [weekStart, setWeekStart] = React.useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }))

  const weekDays = React.useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  const tasksByDay = React.useMemo(() => {
    const grouped: Record<string, TarefasTask[]> = {}
    weekDays.forEach((day) => {
      const key = formatISO(day, { representation: 'date' })
      grouped[key] = tasks.filter((t) => {
        if (!t.data_entrega) return false
        const taskDateStr = t.data_entrega.includes('T')
          ? t.data_entrega.split('T')[0]
          : t.data_entrega
        return taskDateStr === key
      })
    })
    return grouped
  }, [weekDays, tasks])

  const weekLabel = `${weekDays[0].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} – ${weekDays[6].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}`
  const isToday = (day: Date) => new Date().toDateString() === day.toDateString()

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-ink-strong sm:text-lg">{weekLabel}</h2>
          <p className="text-meta text-ink-muted">Semana de domingo a sábado</p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            aria-label="Semana anterior"
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))}
          >
            Hoje
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            aria-label="Próxima semana"
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Desktop: sete colunas */}
      <Panel className="hidden min-h-0 flex-1 overflow-hidden md:block">
        <div className="grid h-full grid-cols-7">
          {weekDays.map((day) => {
            const key = formatISO(day, { representation: 'date' })
            const dayTasks = tasksByDay[key] || []
            const marked = isToday(day)

            return (
              <section
                key={key}
                aria-label={`${formatLongDate(day)}${marked ? ', hoje' : ''}, ${dayTasks.length} tarefa${dayTasks.length === 1 ? '' : 's'}`}
                className="flex min-w-0 flex-col border-r border-line last:border-r-0"
              >
                <div
                  className={cn(
                    'border-b border-line px-2 py-3 text-center',
                    marked ? 'bg-brand-soft' : 'bg-surface-sunken',
                  )}
                >
                  <div
                    className={cn(
                      'text-micro font-semibold uppercase tracking-wide',
                      marked ? 'text-brand-strong' : 'text-ink-muted',
                    )}
                  >
                    {day.toLocaleDateString('pt-BR', { weekday: 'short' })}
                  </div>
                  <div
                    className={cn(
                      'mx-auto mt-1 flex h-9 w-9 items-center justify-center rounded-full text-lg font-bold tabular-nums',
                      marked
                        ? 'bg-brand text-white ring-2 ring-brand-border ring-offset-2 ring-offset-surface-sunken'
                        : 'text-ink-strong',
                    )}
                  >
                    {day.getDate()}
                  </div>
                  {marked ? (
                    <div className="mt-1 text-micro font-semibold uppercase text-brand">Hoje</div>
                  ) : null}
                  <div className="mt-1 text-micro text-ink-muted">
                    {dayTasks.length > 0
                      ? `${dayTasks.length} tarefa${dayTasks.length === 1 ? '' : 's'}`
                      : 'Sem tarefas'}
                  </div>
                </div>

                <div className="scroll-touch flex-1 space-y-1.5 overflow-y-auto p-2">
                  {dayTasks.map((task) => (
                    <TaskButton key={task.id} task={task} onTaskClick={onTaskClick} compact />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </Panel>

      {/* Mobile: lista vertical por dia */}
      <div className="scroll-touch min-h-0 flex-1 space-y-3 overflow-y-auto md:hidden">
        {weekDays.map((day) => {
          const key = formatISO(day, { representation: 'date' })
          const dayTasks = tasksByDay[key] || []
          const marked = isToday(day)

          return (
            <Panel
              key={key}
              aria-label={`${formatLongDate(day)}${marked ? ', hoje' : ''}`}
              className={cn('overflow-hidden', marked && 'border-brand-border')}
            >
              <div
                className={cn(
                  'flex items-center gap-3 border-b border-line px-3 py-2.5',
                  marked ? 'bg-brand-soft' : 'bg-surface-sunken',
                )}
              >
                <span
                  className={cn(
                    'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums',
                    marked
                      ? 'bg-brand text-white'
                      : 'border border-line bg-surface text-ink-strong',
                  )}
                >
                  {day.getDate()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink-strong first-letter:uppercase">
                    {day.toLocaleDateString('pt-BR', { weekday: 'long' })}
                    {marked ? <span className="ml-1.5 text-brand">· Hoje</span> : null}
                  </span>
                  <span className="block text-micro text-ink-muted">
                    {dayTasks.length > 0
                      ? `${dayTasks.length} tarefa${dayTasks.length === 1 ? '' : 's'}`
                      : 'Sem tarefas'}
                  </span>
                </span>
              </div>

              {dayTasks.length > 0 ? (
                <div className="space-y-2 p-2">
                  {dayTasks.map((task) => (
                    <TaskButton key={task.id} task={task} onTaskClick={onTaskClick} />
                  ))}
                </div>
              ) : null}
            </Panel>
          )
        })}
      </div>
    </div>
  )
}
