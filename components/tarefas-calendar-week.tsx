'use client'

import React, { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, startOfWeek, formatISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { TarefasTask } from '@/lib/services/tarefas'

interface TarefasCalendarWeekProps {
  tasks: TarefasTask[]
  onTaskClick: (taskId: string) => void
}

const PRIORITY_COLORS: Record<string, string> = {
  urgente: 'bg-red-100 border-red-400 text-red-800',
  alta: 'bg-orange-100 border-orange-400 text-orange-800',
  media: 'bg-purple-100 border-purple-400 text-purple-800',
  baixa: 'bg-blue-100 border-blue-400 text-blue-800',
}

const PRIORITY_DOT: Record<string, string> = {
  urgente: 'bg-red-600',
  alta: 'bg-orange-500',
  media: 'bg-purple-500',
  baixa: 'bg-blue-500',
}

export const TarefasCalendarWeek: React.FC<TarefasCalendarWeekProps> = ({ tasks, onTaskClick }) => {
  const [weekStart, setWeekStart] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 0 })
  )

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  }, [weekStart])

  const tasksByDay = useMemo(() => {
    const grouped: Record<string, TarefasTask[]> = {}
    weekDays.forEach(day => {
      const key = formatISO(day, { representation: 'date' })
      grouped[key] = tasks.filter(t => {
        if (!t.data_entrega) return false
        const taskDateStr = t.data_entrega.includes('T')
          ? t.data_entrega.split('T')[0]
          : t.data_entrega
        return taskDateStr === key
      })
    })
    return grouped
  }, [weekDays, tasks])

  const prevWeek = () => setWeekStart(addDays(weekStart, -7))
  const nextWeek = () => setWeekStart(addDays(weekStart, 7))

  const weekLabel = `${weekDays[0].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} – ${weekDays[6].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}`

  const isToday = (day: Date) => new Date().toDateString() === day.toDateString()

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-gray-200">
        <h2 className="text-base md:text-lg font-semibold text-gray-900">{weekLabel}</h2>
        <div className="flex gap-1">
          <button
            onClick={prevWeek}
            aria-label="Semana anterior"
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <button
            onClick={nextWeek}
            aria-label="Próxima semana"
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ChevronRight className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      </div>

      {/* Day columns - desktop: side by side, mobile: stacked */}
      <div className="flex-1 overflow-auto">
        {/* Desktop: 7-column grid */}
        <div className="hidden md:grid md:grid-cols-7 h-full">
          {weekDays.map((day, idx) => {
            const key = formatISO(day, { representation: 'date' })
            const dayTasks = tasksByDay[key] || []
            const today = isToday(day)

            return (
              <div key={idx} className="flex flex-col border-r border-gray-200 last:border-r-0">
                {/* Day header */}
                <div
                  className={`px-2 py-3 text-center border-b border-gray-200 ${today ? 'bg-orange-50' : 'bg-gray-50'}`}
                >
                  <div
                    className={`text-xs font-semibold uppercase tracking-wide ${today ? 'text-orange-600' : 'text-gray-500'}`}
                  >
                    {day.toLocaleDateString('pt-BR', { weekday: 'short' })}
                  </div>
                  <div
                    className={`mt-0.5 text-xl font-bold w-8 h-8 flex items-center justify-center mx-auto rounded-full ${
                      today ? 'bg-orange-500 text-white' : 'text-gray-900'
                    }`}
                  >
                    {day.getDate()}
                  </div>
                  {dayTasks.length > 0 && (
                    <div className="text-xs text-gray-500 mt-1">{dayTasks.length} tarefa{dayTasks.length > 1 ? 's' : ''}</div>
                  )}
                </div>

                {/* Tasks */}
                <div className="flex-1 p-2 space-y-1.5 overflow-y-auto">
                  {dayTasks.map(task => (
                    <div
                      key={task.id}
                      onClick={() => onTaskClick(task.id)}
                      className={`p-2 rounded-lg border cursor-pointer hover:shadow-sm transition text-xs ${
                        PRIORITY_COLORS[task.prioridade] || 'bg-gray-50 border-gray-300 text-gray-800'
                      } ${task.concluida ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full mt-0.5 flex-shrink-0 ${PRIORITY_DOT[task.prioridade] || 'bg-gray-400'}`} />
                        <div className="flex-1 min-w-0">
                          <div className={`font-medium truncate ${task.concluida ? 'line-through' : ''}`}>
                            {task.titulo}
                          </div>
                          {task.responsavel_nome && (
                            <div className="opacity-70 mt-0.5 truncate">{task.responsavel_nome}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Mobile: stacked list */}
        <div className="md:hidden divide-y divide-gray-200">
          {weekDays.map((day, idx) => {
            const key = formatISO(day, { representation: 'date' })
            const dayTasks = tasksByDay[key] || []
            const today = isToday(day)

            return (
              <div key={idx}>
                <div className={`px-4 py-2 flex items-center gap-3 ${today ? 'bg-orange-50' : 'bg-gray-50'}`}>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      today ? 'bg-orange-500 text-white' : 'bg-white border border-gray-300 text-gray-900'
                    }`}
                  >
                    {day.getDate()}
                  </div>
                  <div>
                    <div className={`text-sm font-medium capitalize ${today ? 'text-orange-700' : 'text-gray-900'}`}>
                      {day.toLocaleDateString('pt-BR', { weekday: 'long' })}
                    </div>
                    <div className="text-xs text-gray-500">
                      {dayTasks.length > 0 ? `${dayTasks.length} tarefa${dayTasks.length > 1 ? 's' : ''}` : 'Sem tarefas'}
                    </div>
                  </div>
                </div>

                {dayTasks.length > 0 && (
                  <div className="px-4 py-2 space-y-2">
                    {dayTasks.map(task => (
                      <div
                        key={task.id}
                        onClick={() => onTaskClick(task.id)}
                        className={`p-3 rounded-lg border cursor-pointer active:scale-[0.98] transition ${
                          PRIORITY_COLORS[task.prioridade] || 'bg-gray-50 border-gray-300'
                        } ${task.concluida ? 'opacity-60' : ''}`}
                      >
                        <div className="flex items-start gap-2">
                          <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${PRIORITY_DOT[task.prioridade] || 'bg-gray-400'}`} />
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium ${task.concluida ? 'line-through' : ''}`}>{task.titulo}</div>
                            {task.responsavel_nome && (
                              <div className="text-xs opacity-70 mt-0.5">{task.responsavel_nome}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
