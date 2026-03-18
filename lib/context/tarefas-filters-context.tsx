'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import type { TarefasTask } from '@/lib/services/tarefas'
import type { TarefaPrioridade } from '@/lib/tarefas-constants'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FilterState {
  priorities: TarefaPrioridade[]
  responsavelIds: string[]
  dateRange: {
    start: string | null  // ISO string (YYYY-MM-DD)
    end: string | null    // ISO string (YYYY-MM-DD)
  }
  statuses: ('completed' | 'pending')[]
  columnIds: string[]
}

export interface TarefasFiltersContextType {
  filters: FilterState
  setFilters: (filters: FilterState) => void
  clearFilters: () => void
  hasActiveFilters: boolean
  applyFilters: (tasks: TarefasTask[]) => TarefasTask[]
}

// ─── Context ──────────────────────────────────────────────────────────────────

const TarefasFiltersContext = createContext<TarefasFiltersContextType | undefined>(undefined)

const DEFAULT_FILTERS: FilterState = {
  priorities: [],
  responsavelIds: [],
  dateRange: { start: null, end: null },
  statuses: [],
  columnIds: [],
}

const STORAGE_KEY = 'tarefas-filters'

// ─── Provider ─────────────────────────────────────────────────────────────────

export function TarefasFiltersProvider({ children }: { children: React.ReactNode }) {
  const [filters, setFiltersState] = useState<FilterState>(DEFAULT_FILTERS)
  const [mounted, setMounted] = useState(false)

  // Initialize from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored) as FilterState
          setFiltersState(parsed)
        }
      } catch (e) {
        console.error('[tarefas-filters] Failed to load from localStorage:', e)
      }
    }
    setMounted(true)
  }, [])

  // Persist to localStorage on change
  useEffect(() => {
    if (mounted && typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
      } catch (e) {
        console.error('[tarefas-filters] Failed to save to localStorage:', e)
      }
    }
  }, [filters, mounted])

  const setFilters = useCallback((newFilters: FilterState) => {
    setFiltersState(newFilters)
  }, [])

  const clearFilters = useCallback(() => {
    setFiltersState(DEFAULT_FILTERS)
  }, [])

  const hasActiveFilters = !!(
    filters.priorities.length > 0 ||
    filters.responsavelIds.length > 0 ||
    filters.dateRange.start ||
    filters.dateRange.end ||
    filters.statuses.length > 0 ||
    filters.columnIds.length > 0
  )

  const applyFilters = useCallback((tasks: TarefasTask[]): TarefasTask[] => {
    return tasks.filter((task) => {
      // Priority filter: OR logic (empty = all pass)
      if (filters.priorities.length > 0) {
        if (!filters.priorities.includes(task.prioridade)) {
          return false
        }
      }

      // Responsible filter: OR logic (empty = all pass)
      if (filters.responsavelIds.length > 0) {
        if (!task.responsavel_id || !filters.responsavelIds.includes(task.responsavel_id)) {
          return false
        }
      }

      // Status filter: OR logic (empty = all pass)
      if (filters.statuses.length > 0) {
        const taskStatus = task.concluida ? 'completed' : 'pending'
        if (!filters.statuses.includes(taskStatus)) {
          return false
        }
      }

      // Column filter: OR logic (empty = all pass)
      if (filters.columnIds.length > 0) {
        if (!filters.columnIds.includes(task.column_id)) {
          return false
        }
      }

      // Date range filter: inclusive on both ends (empty = all pass)
      if (filters.dateRange.start || filters.dateRange.end) {
        const taskDate = task.data_entrega ? task.data_entrega.split('T')[0] : null

        if (!taskDate) {
          // Tasks without a date don't pass date filters
          return false
        }

        if (filters.dateRange.start && taskDate < filters.dateRange.start) {
          return false
        }

        if (filters.dateRange.end && taskDate > filters.dateRange.end) {
          return false
        }
      }

      return true
    })
  }, [filters])

  const value: TarefasFiltersContextType = {
    filters,
    setFilters,
    clearFilters,
    hasActiveFilters,
    applyFilters,
  }

  return (
    <TarefasFiltersContext.Provider value={value}>
      {children}
    </TarefasFiltersContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTarefasFilters(): TarefasFiltersContextType {
  const context = useContext(TarefasFiltersContext)
  if (!context) {
    throw new Error('useTarefasFilters must be used within a TarefasFiltersProvider')
  }
  return context
}
