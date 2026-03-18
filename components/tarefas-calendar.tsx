'use client'

import React, { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { TarefasTask } from '@/lib/services/tarefas'

interface TarefasCalendarProps {
  tasks: TarefasTask[]
  onTaskClick: (taskId: string) => void
}

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const PRIORITY_COLORS: Record<string, string> = {
  urgente: 'bg-red-600',
  alta: 'bg-orange-500',
  media: 'bg-purple-500',
  baixa: 'bg-blue-500',
}

const PRIORITY_BORDER: Record<string, string> = {
  urgente: 'border-l-red-600',
  alta: 'border-l-orange-500',
  media: 'border-l-purple-500',
  baixa: 'border-l-blue-500',
}

export const TarefasCalendar: React.FC<TarefasCalendarProps> = ({ tasks, onTaskClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDayTasks, setSelectedDayTasks] = useState<{ day: number; tasks: TarefasTask[] } | null>(null)

  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay()

  const days = useMemo(() => {
    const total = daysInMonth(currentDate)
    const firstDay = firstDayOfMonth(currentDate)
    const result: (number | null)[] = []
    for (let i = 0; i < firstDay; i++) result.push(null)
    for (let i = 1; i <= total; i++) result.push(i)
    // Pad to complete last row
    while (result.length % 7 !== 0) result.push(null)
    return result
  }, [currentDate])

  const tasksByDate = useMemo(() => {
    const grouped: Record<string, TarefasTask[]> = {}
    tasks.forEach(task => {
      if (!task.data_entrega) return
      const dateStr = task.data_entrega.includes('T')
        ? task.data_entrega.split('T')[0]
        : task.data_entrega
      if (!grouped[dateStr]) grouped[dateStr] = []
      grouped[dateStr].push(task)
    })
    return grouped
  }, [tasks])

  const getDayKey = (day: number) => {
    const year = currentDate.getFullYear()
    const month = String(currentDate.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}-${String(day).padStart(2, '0')}`
  }

  const getDayTasks = (day: number | null) => {
    if (!day) return []
    return tasksByDate[getDayKey(day)] || []
  }

  const isToday = (day: number | null) => {
    if (!day) return false
    const today = new Date()
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    )
  }

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))

  const monthLabel = currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="w-full h-full flex flex-col bg-white p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl md:text-2xl font-bold text-gray-900 capitalize">{monthLabel}</h2>
        <div className="flex gap-1">
          <button
            onClick={prevMonth}
            aria-label="Mês anterior"
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ChevronLeft className="w-5 h-5 text-gray-700" />
          </button>
          <button
            onClick={nextMonth}
            aria-label="Próximo mês"
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ChevronRight className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      </div>

      {/* Days of week header */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_OF_WEEK.map(d => (
          <div key={d} className="text-center text-xs font-semibold text-gray-500 py-2 uppercase tracking-wide">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden border border-gray-200">
        {days.map((day, idx) => {
          const dayTasks = getDayTasks(day)
          const today = isToday(day)
          const MAX_VISIBLE = 3

          return (
            <div
              key={idx}
              onClick={() => day && dayTasks.length > 0 && setSelectedDayTasks({ day, tasks: dayTasks })}
              className={`bg-white flex flex-col min-h-20 md:min-h-24 p-1 md:p-2 transition ${
                day === null
                  ? 'opacity-0 pointer-events-none'
                  : dayTasks.length > 0
                    ? 'cursor-pointer hover:bg-orange-50'
                    : ''
              }`}
            >
              {day !== null && (
                <>
                  <div
                    className={`text-sm font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                      today
                        ? 'bg-orange-500 text-white'
                        : 'text-gray-900'
                    }`}
                  >
                    {day}
                  </div>

                  {/* Task chips (desktop) */}
                  <div className="hidden md:flex flex-col gap-0.5 flex-1">
                    {dayTasks.slice(0, MAX_VISIBLE).map(task => (
                      <div
                        key={task.id}
                        onClick={e => { e.stopPropagation(); onTaskClick(task.id) }}
                        className={`text-xs px-1 py-0.5 rounded border-l-2 bg-gray-50 hover:bg-gray-100 cursor-pointer truncate ${PRIORITY_BORDER[task.prioridade] || 'border-l-gray-400'}`}
                        title={task.titulo}
                      >
                        {task.concluida ? '✓ ' : ''}{task.titulo}
                      </div>
                    ))}
                    {dayTasks.length > MAX_VISIBLE && (
                      <div className="text-xs text-gray-500 px-1">
                        +{dayTasks.length - MAX_VISIBLE} mais
                      </div>
                    )}
                  </div>

                  {/* Dots (mobile) */}
                  <div className="md:hidden flex flex-wrap gap-0.5 mt-0.5">
                    {dayTasks.slice(0, 4).map(task => (
                      <div
                        key={task.id}
                        className={`w-1.5 h-1.5 rounded-full ${PRIORITY_COLORS[task.prioridade] || 'bg-gray-400'}`}
                      />
                    ))}
                    {dayTasks.length > 4 && (
                      <div className="text-xs text-gray-500 leading-none">+</div>
                    )}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Selected day modal */}
      {selectedDayTasks && (
        <div
          className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50"
          onClick={() => setSelectedDayTasks(null)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl p-6 w-full sm:max-w-md mx-0 sm:mx-4 pb-[env(safe-area-inset-bottom)] sm:pb-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">
                {new Date(
                  currentDate.getFullYear(),
                  currentDate.getMonth(),
                  selectedDayTasks.day
                ).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <button
                onClick={() => setSelectedDayTasks(null)}
                className="p-1 hover:bg-gray-100 rounded-lg text-gray-500"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto">
              {selectedDayTasks.tasks.map(task => (
                <div
                  key={task.id}
                  onClick={() => { onTaskClick(task.id); setSelectedDayTasks(null) }}
                  className={`p-3 border rounded-lg hover:bg-gray-50 cursor-pointer border-l-4 ${PRIORITY_BORDER[task.prioridade] || 'border-l-gray-300'}`}
                >
                  <div className={`font-medium text-sm text-gray-900 ${task.concluida ? 'line-through text-gray-500' : ''}`}>
                    {task.titulo}
                  </div>
                  {task.responsavel_nome && (
                    <div className="text-xs text-gray-500 mt-0.5">{task.responsavel_nome}</div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => setSelectedDayTasks(null)}
              className="mt-4 w-full px-3 py-2 bg-gray-100 text-gray-900 rounded-lg text-sm hover:bg-gray-200 transition"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
