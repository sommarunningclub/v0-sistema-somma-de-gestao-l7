'use client'

import * as React from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { EmptyState, Panel, SectionTitle } from '@/components/somma'
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
 * Visão de mês.
 *
 * A grade sozinha não cabe no celular sem virar um amontoado de pontinhos, por
 * isso ali ela funciona como seletor: cada dia é um alvo de 44px e as tarefas
 * do dia escolhido aparecem numa lista logo abaixo. No desktop os títulos são
 * mostrados dentro da própria célula.
 */

interface TarefasCalendarProps {
  tasks: TarefasTask[]
  onTaskClick: (taskId: string) => void
}

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MAX_VISIBLE = 3

function toDayKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export const TarefasCalendar: React.FC<TarefasCalendarProps> = ({ tasks, onTaskClick }) => {
  const [currentDate, setCurrentDate] = React.useState(() => new Date())
  const [selectedDay, setSelectedDay] = React.useState<number | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const days = React.useMemo(() => {
    const total = new Date(year, month + 1, 0).getDate()
    const firstDay = new Date(year, month, 1).getDay()
    const result: (number | null)[] = []
    for (let i = 0; i < firstDay; i++) result.push(null)
    for (let i = 1; i <= total; i++) result.push(i)
    while (result.length % 7 !== 0) result.push(null)
    return result
  }, [year, month])

  const tasksByDate = React.useMemo(() => {
    const grouped: Record<string, TarefasTask[]> = {}
    tasks.forEach((task) => {
      if (!task.data_entrega) return
      const dateStr = task.data_entrega.includes('T')
        ? task.data_entrega.split('T')[0]
        : task.data_entrega
      ;(grouped[dateStr] ||= []).push(task)
    })
    return grouped
  }, [tasks])

  const getDayTasks = React.useCallback(
    (day: number | null) => (day ? tasksByDate[toDayKey(year, month, day)] || [] : []),
    [tasksByDate, year, month],
  )

  const today = new Date()
  const isToday = (day: number | null) =>
    day !== null &&
    day === today.getDate() &&
    month === today.getMonth() &&
    year === today.getFullYear()

  const goTo = (delta: number) => {
    setSelectedDay(null)
    setCurrentDate(new Date(year, month + delta, 1))
  }

  const monthLabel = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  const selectedTasks = getDayTasks(selectedDay)
  const monthTaskCount = days.reduce<number>((sum, d) => sum + getDayTasks(d).length, 0)

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-ink-strong first-letter:uppercase sm:text-lg">
            {monthLabel}
          </h2>
          <p className="text-meta text-ink-muted">
            {monthTaskCount} tarefa{monthTaskCount === 1 ? '' : 's'} com prazo neste mês
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button variant="secondary" size="icon" onClick={() => goTo(-1)} aria-label="Mês anterior">
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSelectedDay(null)
              setCurrentDate(new Date())
            }}
          >
            Hoje
          </Button>
          <Button variant="secondary" size="icon" onClick={() => goTo(1)} aria-label="Próximo mês">
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>

      <Panel className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="grid grid-cols-7 border-b border-line bg-surface-sunken">
          {DAYS_OF_WEEK.map((d) => (
            <div
              key={d}
              className="py-2 text-center text-micro font-semibold uppercase tracking-wide text-ink-muted"
            >
              <span aria-hidden="true">{d}</span>
              <span className="sr-only">{d}</span>
            </div>
          ))}
        </div>

        <div className="grid flex-1 auto-rows-fr grid-cols-7">
          {days.map((day, idx) => {
            const dayTasks = getDayTasks(day)
            const marked = isToday(day)
            const selected = day !== null && day === selectedDay

            if (day === null) {
              return <div key={idx} aria-hidden="true" className="border-b border-r border-line-soft" />
            }

            const dateLabel = formatLongDate(new Date(year, month, day))

            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedDay(selected ? null : day)}
                aria-pressed={selected}
                aria-label={`${dateLabel}${marked ? ', hoje' : ''}. ${dayTasks.length} tarefa${dayTasks.length === 1 ? '' : 's'}.`}
                className={cn(
                  'flex min-h-[3.25rem] flex-col items-stretch border-b border-r border-line-soft p-1 text-left transition-colors sm:min-h-[6rem] sm:p-2',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand',
                  selected ? 'bg-brand-soft' : 'hover:bg-surface-hover',
                )}
              >
                <span className="flex items-center gap-1">
                  <span
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums',
                      marked
                        ? 'bg-brand font-bold text-white ring-2 ring-brand-border ring-offset-2 ring-offset-surface-raised'
                        : 'text-ink',
                    )}
                  >
                    {day}
                  </span>
                  {marked ? (
                    <span className="hidden text-micro font-semibold uppercase text-brand sm:inline">
                      Hoje
                    </span>
                  ) : null}
                </span>

                <span className="mt-1 hidden min-h-0 flex-1 flex-col gap-0.5 overflow-hidden sm:flex">
                  {dayTasks.slice(0, MAX_VISIBLE).map((task) => (
                    <span
                      key={task.id}
                      className="flex items-center gap-1 truncate rounded bg-surface-sunken px-1 py-0.5 text-micro text-ink"
                    >
                      <span
                        aria-hidden="true"
                        className={cn('h-2.5 w-0.5 shrink-0 rounded', priorityMeta(task.prioridade).bar)}
                      />
                      <span className={cn('truncate', task.concluida && 'line-through text-ink-muted')}>
                        {task.titulo}
                      </span>
                    </span>
                  ))}
                  {dayTasks.length > MAX_VISIBLE ? (
                    <span className="px-1 text-micro text-ink-muted">
                      +{dayTasks.length - MAX_VISIBLE} mais
                    </span>
                  ) : null}
                </span>

                {dayTasks.length > 0 ? (
                  <span className="mt-auto flex items-center gap-0.5 pt-1 sm:hidden">
                    {dayTasks.slice(0, 4).map((task) => (
                      <span
                        key={task.id}
                        aria-hidden="true"
                        className={cn('h-1.5 w-1.5 rounded-full', priorityMeta(task.prioridade).bar)}
                      />
                    ))}
                    {dayTasks.length > 4 ? (
                      <span className="text-micro leading-none text-ink-muted">+</span>
                    ) : null}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </Panel>

      {selectedDay !== null ? (
        <Panel inset>
          <SectionTitle
            title={
              <span className="inline-block first-letter:uppercase">{formatLongDate(new Date(year, month, selectedDay))}</span>
            }
            meta={`${selectedTasks.length} tarefa${selectedTasks.length === 1 ? '' : 's'}`}
          />
          {selectedTasks.length === 0 ? (
            <EmptyState
              compact
              icon={CalendarDays}
              title="Nenhuma tarefa neste dia"
              description="Nenhuma tarefa do quadro tem prazo para esta data."
            />
          ) : (
            <ul className="space-y-2">
              {selectedTasks.map((task) => {
                const overdue = isOverdue(task.data_entrega) && !task.concluida
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => onTaskClick(task.id)}
                      className="ds-tap flex w-full items-start gap-3 rounded-lg border border-line bg-surface-raised p-3 text-left transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'mt-1 h-8 w-1 shrink-0 rounded-full',
                          priorityMeta(task.prioridade).bar,
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'block text-sm font-semibold',
                            task.concluida ? 'text-ink-muted line-through' : 'text-ink-strong',
                          )}
                        >
                          {task.titulo}
                        </span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-2">
                          <PriorityPill prioridade={task.prioridade} />
                          {task.responsavel_nome ? (
                            <span className="text-micro text-ink-muted">
                              {initialsOf(task.responsavel_nome)} · {task.responsavel_nome}
                            </span>
                          ) : null}
                          {overdue ? (
                            <span className="text-micro font-semibold text-danger">Vencida</span>
                          ) : null}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      ) : null}
    </div>
  )
}
