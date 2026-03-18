# Tarefas Filtering and Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a global filtering system and dual-view calendar for the Tarefas task management module.

**Architecture:** The filtering system uses React Context for global state management with localStorage persistence. Filters apply across all views (Kanban, List, Calendar) via a shared `applyFilters()` function. The calendar provides month and week views, both respecting the global filter state. The filter panel is a collapsible sidebar on desktop (md+) and a full-screen overlay on mobile (sm:).

**Tech Stack:** React, Next.js, TypeScript, TailwindCSS, date-fns, Lucide React icons

---

## File Structure

### New Files (Create)
- `lib/context/tarefas-filters-context.tsx` - Global filter state management
- `lib/context/__tests__/tarefas-filters-context.test.ts` - Context unit tests
- `components/tarefas-filters-panel.tsx` - Filter panel UI (desktop + mobile)
- `components/__tests__/tarefas-filters-panel.test.tsx` - Filter panel tests
- `components/tarefas-calendar.tsx` - Calendar month view
- `components/__tests__/tarefas-calendar.test.tsx` - Calendar month tests
- `components/tarefas-calendar-week.tsx` - Calendar week view
- `components/__tests__/tarefas-calendar-week.test.tsx` - Calendar week tests

### Modified Files
- `app/tarefas/layout.tsx` - Wrap with `TarefasFiltersProvider`
- `app/tarefas/page.tsx` - Add filter panel, calendar views, view toggle

---

## Task 1: Create Filter Context

**Files:**
- Create: `lib/context/tarefas-filters-context.tsx`
- Create: `lib/context/__tests__/tarefas-filters-context.test.ts`
- Modify: `app/tarefas/layout.tsx`

### Context Implementation

- [ ] **Step 1: Create filter context file with types and provider**

Create `lib/context/tarefas-filters-context.tsx`:

```typescript
'use client'

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react'
import type { TarefasTask, TarefaPrioridade } from '@/lib/services/tarefas'

export interface FilterState {
  priorities: TarefaPrioridade[]
  responsavelIds: string[]
  dateRange: {
    start: string | null
    end: string | null
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

const INITIAL_FILTERS: FilterState = {
  priorities: [],
  responsavelIds: [],
  dateRange: { start: null, end: null },
  statuses: [],
  columnIds: [],
}

const TarefasFiltersContext = createContext<TarefasFiltersContextType | undefined>(undefined)

export const TarefasFiltersProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [filters, setFilters] = useState<FilterState>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tarefas-filters')
      return saved ? JSON.parse(saved) : INITIAL_FILTERS
    }
    return INITIAL_FILTERS
  })

  useEffect(() => {
    localStorage.setItem('tarefas-filters', JSON.stringify(filters))
  }, [filters])

  const getTaskStatus = (task: TarefasTask): 'completed' | 'pending' => {
    return task.concluida ? 'completed' : 'pending'
  }

  const applyFilters = useCallback((tasks: TarefasTask[]) => {
    return tasks.filter(task => {
      const matchPriority = filters.priorities.length === 0 || filters.priorities.includes(task.prioridade)
      const matchResponsavel = filters.responsavelIds.length === 0 || filters.responsavelIds.includes(task.responsavel_id || '')
      const matchStatus = filters.statuses.length === 0 || filters.statuses.includes(getTaskStatus(task))
      const matchColumn = filters.columnIds.length === 0 || filters.columnIds.includes(task.column_id)

      const matchDate = (!filters.dateRange.start && !filters.dateRange.end) ||
        (task.data_entrega &&
         (!filters.dateRange.start || task.data_entrega >= filters.dateRange.start) &&
         (!filters.dateRange.end || task.data_entrega <= filters.dateRange.end))

      return matchPriority && matchResponsavel && matchStatus && matchColumn && matchDate
    })
  }, [filters])

  const hasActiveFilters = filters.priorities.length > 0 ||
    filters.responsavelIds.length > 0 ||
    filters.statuses.length > 0 ||
    filters.columnIds.length > 0 ||
    !!filters.dateRange.start ||
    !!filters.dateRange.end

  const value: TarefasFiltersContextType = {
    filters,
    setFilters,
    clearFilters: () => setFilters(INITIAL_FILTERS),
    hasActiveFilters,
    applyFilters,
  }

  return (
    <TarefasFiltersContext.Provider value={value}>
      {children}
    </TarefasFiltersContext.Provider>
  )
}

export const useTarefasFilters = () => {
  const context = useContext(TarefasFiltersContext)
  if (!context) throw new Error('useTarefasFilters must be used within TarefasFiltersProvider')
  return context
}
```

- [ ] **Step 2: Write unit tests for filter context**

Create `lib/context/__tests__/tarefas-filters-context.test.ts`:

```typescript
import { renderHook, act } from '@testing-library/react'
import { TarefasFiltersProvider, useTarefasFilters, FilterState } from '../tarefas-filters-context'
import type { TarefasTask } from '@/lib/services/tarefas'

describe('TarefasFiltersContext', () => {
  const mockTask: TarefasTask = {
    id: '1',
    column_id: 'col-1',
    board_id: 'board-1',
    titulo: 'Test Task',
    descricao: null,
    prioridade: 'alta',
    responsavel_id: 'user-1',
    responsavel_nome: 'John Doe',
    data_entrega: '2026-03-25',
    posicao: 0,
    concluida: false,
    checklist: [],
    criado_em: '2026-03-18T00:00:00Z',
    atualizado_em: '2026-03-18T00:00:00Z',
  }

  it('filters by priority', () => {
    const { result } = renderHook(() => useTarefasFilters(), {
      wrapper: TarefasFiltersProvider,
    })

    act(() => {
      result.current.setFilters({ ...result.current.filters, priorities: ['alta'] })
    })

    const filtered = result.current.applyFilters([mockTask, { ...mockTask, id: '2', prioridade: 'baixa' }])
    expect(filtered).toHaveLength(1)
    expect(filtered[0].prioridade).toBe('alta')
  })

  it('filters by status (completed)', () => {
    const { result } = renderHook(() => useTarefasFilters(), {
      wrapper: TarefasFiltersProvider,
    })

    act(() => {
      result.current.setFilters({ ...result.current.filters, statuses: ['completed'] })
    })

    const filtered = result.current.applyFilters([
      mockTask,
      { ...mockTask, id: '2', concluida: true },
    ])
    expect(filtered).toHaveLength(1)
    expect(filtered[0].concluida).toBe(true)
  })

  it('filters by date range (inclusive)', () => {
    const { result } = renderHook(() => useTarefasFilters(), {
      wrapper: TarefasFiltersProvider,
    })

    act(() => {
      result.current.setFilters({
        ...result.current.filters,
        dateRange: { start: '2026-03-20', end: '2026-03-30' },
      })
    })

    const tasks = [
      mockTask, // 2026-03-25
      { ...mockTask, id: '2', data_entrega: '2026-03-19' }, // before range
      { ...mockTask, id: '3', data_entrega: '2026-03-20' }, // on start
      { ...mockTask, id: '4', data_entrega: '2026-03-30' }, // on end
      { ...mockTask, id: '5', data_entrega: '2026-03-31' }, // after range
    ]

    const filtered = result.current.applyFilters(tasks)
    expect(filtered).toHaveLength(3) // 2026-03-25, 2026-03-20, 2026-03-30
  })

  it('combines filters with AND logic', () => {
    const { result } = renderHook(() => useTarefasFilters(), {
      wrapper: TarefasFiltersProvider,
    })

    act(() => {
      result.current.setFilters({
        ...result.current.filters,
        priorities: ['alta'],
        statuses: ['pending'],
      })
    })

    const tasks = [
      mockTask, // alta, pending ✓
      { ...mockTask, id: '2', prioridade: 'baixa', concluida: false }, // baixa, pending ✗
      { ...mockTask, id: '3', prioridade: 'alta', concluida: true }, // alta, completed ✗
    ]

    const filtered = result.current.applyFilters(tasks)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('1')
  })

  it('persists filters to localStorage', () => {
    const { result } = renderHook(() => useTarefasFilters(), {
      wrapper: TarefasFiltersProvider,
    })

    act(() => {
      result.current.setFilters({ ...result.current.filters, priorities: ['urgente'] })
    })

    const saved = localStorage.getItem('tarefas-filters')
    expect(saved).toBeDefined()
    const parsed = JSON.parse(saved!)
    expect(parsed.priorities).toContain('urgente')
  })

  it('clears all filters', () => {
    const { result } = renderHook(() => useTarefasFilters(), {
      wrapper: TarefasFiltersProvider,
    })

    act(() => {
      result.current.setFilters({
        priorities: ['alta'],
        responsavelIds: ['user-1'],
        dateRange: { start: '2026-03-01', end: '2026-03-31' },
        statuses: ['completed'],
        columnIds: ['col-1'],
      })
    })

    act(() => {
      result.current.clearFilters()
    })

    expect(result.current.filters.priorities).toHaveLength(0)
    expect(result.current.filters.responsavelIds).toHaveLength(0)
    expect(result.current.filters.dateRange.start).toBeNull()
    expect(result.current.hasActiveFilters).toBe(false)
  })
})
```

- [ ] **Step 3: Update app/tarefas/layout.tsx to wrap with provider**

Modify `app/tarefas/layout.tsx`:

```typescript
import { TarefasFiltersProvider } from '@/lib/context/tarefas-filters-context'

export default function TarefasLayout({ children }: { children: React.ReactNode }) {
  return (
    <TarefasFiltersProvider>
      {children}
    </TarefasFiltersProvider>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/context/tarefas-filters-context.tsx \
        lib/context/__tests__/tarefas-filters-context.test.ts \
        app/tarefas/layout.tsx
git commit -m "feat: add global filter context with localStorage persistence and filter logic"
```

---

## Task 2: Create Filter Panel Component

**Files:**
- Create: `components/tarefas-filters-panel.tsx`
- Create: `components/__tests__/tarefas-filters-panel.test.tsx`

- [ ] **Step 1: Create filter panel component (desktop sidebar)**

Create `components/tarefas-filters-panel.tsx`:

```typescript
'use client'

import React, { useState, useMemo } from 'react'
import { ChevronDown, X, Filter } from 'lucide-react'
import { useTarefasFilters } from '@/lib/context/tarefas-filters-context'
import { getTeamUsers } from '@/lib/services/tarefas'
import type { TarefasColumn } from '@/lib/services/tarefas'
import { TAREFAS_PRIORIDADES } from '@/lib/tarefas-constants'

interface TarefasFiltersPanelProps {
  columns: TarefasColumn[]
  onFiltersChange?: () => void
}

export const TarefasFiltersPanel: React.FC<TarefasFiltersPanelProps> = ({ columns, onFiltersChange }) => {
  const { filters, setFilters, clearFilters, hasActiveFilters } = useTarefasFilters()
  const [users, setUsers] = React.useState<any[]>([])
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    priority: true,
    responsible: true,
    dateRange: false,
    status: false,
    column: false,
  })

  React.useEffect(() => {
    getTeamUsers()
      .then(setUsers)
      .catch(err => {
        console.error('[tarefas-filters-panel] Error loading users:', err)
      })
  }, [])

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  const handlePriorityChange = (priority: any) => {
    const updated = filters.priorities.includes(priority)
      ? filters.priorities.filter(p => p !== priority)
      : [...filters.priorities, priority]
    setFilters({ ...filters, priorities: updated })
    onFiltersChange?.()
  }

  const handleResponsavelChange = (userId: string) => {
    const updated = filters.responsavelIds.includes(userId)
      ? filters.responsavelIds.filter(id => id !== userId)
      : [...filters.responsavelIds, userId]
    setFilters({ ...filters, responsavelIds: updated })
    onFiltersChange?.()
  }

  const handleStatusChange = (status: 'completed' | 'pending') => {
    const updated = filters.statuses.includes(status)
      ? filters.statuses.filter(s => s !== status)
      : [...filters.statuses, status]
    setFilters({ ...filters, statuses: updated })
    onFiltersChange?.()
  }

  const handleColumnChange = (columnId: string) => {
    const updated = filters.columnIds.includes(columnId)
      ? filters.columnIds.filter(id => id !== columnId)
      : [...filters.columnIds, columnId]
    setFilters({ ...filters, columnIds: updated })
    onFiltersChange?.()
  }

  const handleDateRangeChange = (type: 'start' | 'end', value: string | null) => {
    setFilters({
      ...filters,
      dateRange: { ...filters.dateRange, [type]: value },
    })
    onFiltersChange?.()
  }

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:flex-col md:w-64 border-r border-gray-200 bg-white h-screen sticky top-0 overflow-y-auto">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Filtros</h2>
            {hasActiveFilters && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-500 text-white text-xs font-bold">
                {[
                  filters.priorities.length,
                  filters.responsavelIds.length,
                  filters.statuses.length,
                  filters.columnIds.length,
                  filters.dateRange.start ? 1 : 0,
                  filters.dateRange.end ? 1 : 0,
                ].filter(n => n > 0).length}
              </span>
            )}
          </div>
        </div>

        {/* Filter Sections */}
        <div className="flex-1 overflow-y-auto">
          {/* Priority */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => toggleSection('priority')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
            >
              <span className="text-sm font-medium text-gray-700">
                Prioridade ({filters.priorities.length})
              </span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${expandedSections.priority ? 'rotate-180' : ''}`}
              />
            </button>
            {expandedSections.priority && (
              <div className="px-4 py-2 space-y-2 bg-gray-50">
                {TAREFAS_PRIORIDADES.map(p => (
                  <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.priorities.includes(p.id)}
                      onChange={() => handlePriorityChange(p.id)}
                      className="rounded w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">{p.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Responsible User */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => toggleSection('responsible')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
            >
              <span className="text-sm font-medium text-gray-700">
                Responsável ({filters.responsavelIds.length})
              </span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${expandedSections.responsible ? 'rotate-180' : ''}`}
              />
            </button>
            {expandedSections.responsible && (
              <div className="px-4 py-2 space-y-2 bg-gray-50 max-h-48 overflow-y-auto">
                {users.map(user => (
                  <label key={user.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.responsavelIds.includes(user.id)}
                      onChange={() => handleResponsavelChange(user.id)}
                      className="rounded w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">{user.full_name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Date Range */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => toggleSection('dateRange')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
            >
              <span className="text-sm font-medium text-gray-700">Data de Entrega</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${expandedSections.dateRange ? 'rotate-180' : ''}`}
              />
            </button>
            {expandedSections.dateRange && (
              <div className="px-4 py-2 space-y-2 bg-gray-50">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">De:</label>
                  <input
                    type="date"
                    value={filters.dateRange.start || ''}
                    onChange={e => handleDateRangeChange('start', e.target.value || null)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Até:</label>
                  <input
                    type="date"
                    value={filters.dateRange.end || ''}
                    onChange={e => handleDateRangeChange('end', e.target.value || null)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Status */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => toggleSection('status')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
            >
              <span className="text-sm font-medium text-gray-700">
                Status ({filters.statuses.length})
              </span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${expandedSections.status ? 'rotate-180' : ''}`}
              />
            </button>
            {expandedSections.status && (
              <div className="px-4 py-2 space-y-2 bg-gray-50">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.statuses.includes('pending')}
                    onChange={() => handleStatusChange('pending')}
                    className="rounded w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">Pendente</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.statuses.includes('completed')}
                    onChange={() => handleStatusChange('completed')}
                    className="rounded w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">Concluída</span>
                </label>
              </div>
            )}
          </div>

          {/* Column */}
          <div className="border-b border-gray-200">
            <button
              onClick={() => toggleSection('column')}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
            >
              <span className="text-sm font-medium text-gray-700">
                Coluna ({filters.columnIds.length})
              </span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${expandedSections.column ? 'rotate-180' : ''}`}
              />
            </button>
            {expandedSections.column && (
              <div className="px-4 py-2 space-y-2 bg-gray-50 max-h-48 overflow-y-auto">
                {columns.map(col => (
                  <label key={col.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={filters.columnIds.includes(col.id)}
                      onChange={() => handleColumnChange(col.id)}
                      className="rounded w-4 h-4"
                    />
                    <span className="text-sm text-gray-700">{col.nome}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        {hasActiveFilters && (
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={clearFilters}
              className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
            >
              Limpar Filtros
            </button>
          </div>
        )}
      </div>

      {/* Mobile Filter Button (sm:) - rendered by the page component, not here */}
      {/* The page component (app/tarefas/page.tsx) handles the mobile filter button with proper state management */}
    </>
  )
}

export const TarefasFiltersPanelMobile: React.FC<TarefasFiltersPanelProps & { isOpen: boolean; onClose: () => void }> = ({
  columns,
  onFiltersChange,
  isOpen,
  onClose,
}) => {
  const { filters, setFilters, clearFilters, hasActiveFilters } = useTarefasFilters()
  const [users, setUsers] = React.useState<any[]>([])

  React.useEffect(() => {
    getTeamUsers()
      .then(setUsers)
      .catch(err => {
        console.error('[tarefas-filters-panel] Error loading users:', err)
      })
  }, [])

  const handlePriorityChange = (priority: any) => {
    const updated = filters.priorities.includes(priority)
      ? filters.priorities.filter(p => p !== priority)
      : [...filters.priorities, priority]
    setFilters({ ...filters, priorities: updated })
  }

  const handleResponsavelChange = (userId: string) => {
    const updated = filters.responsavelIds.includes(userId)
      ? filters.responsavelIds.filter(id => id !== userId)
      : [...filters.responsavelIds, userId]
    setFilters({ ...filters, responsavelIds: updated })
  }

  const handleStatusChange = (status: 'completed' | 'pending') => {
    const updated = filters.statuses.includes(status)
      ? filters.statuses.filter(s => s !== status)
      : [...filters.statuses, status]
    setFilters({ ...filters, statuses: updated })
  }

  const handleColumnChange = (columnId: string) => {
    const updated = filters.columnIds.includes(columnId)
      ? filters.columnIds.filter(id => id !== columnId)
      : [...filters.columnIds, columnId]
    setFilters({ ...filters, columnIds: updated })
  }

  const handleDateRangeChange = (type: 'start' | 'end', value: string | null) => {
    setFilters({
      ...filters,
      dateRange: { ...filters.dateRange, [type]: value },
    })
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-900/50 z-30"
        onClick={onClose}
      />

      {/* Overlay */}
      <div
        className={`fixed inset-y-0 left-0 w-full max-w-sm bg-white z-40 overflow-y-auto transition-transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } flex flex-col`}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Filtros</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto space-y-4 p-4">
          {/* Priority */}
          <div>
            <h3 className="font-medium text-sm text-gray-900 mb-2">Prioridade</h3>
            <div className="space-y-2">
              {TAREFAS_PRIORIDADES.map(p => (
                <label key={p.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.priorities.includes(p.id)}
                    onChange={() => handlePriorityChange(p.id)}
                    className="rounded w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Responsible User */}
          <div>
            <h3 className="font-medium text-sm text-gray-900 mb-2">Responsável</h3>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {users.map(user => (
                <label key={user.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.responsavelIds.includes(user.id)}
                    onChange={() => handleResponsavelChange(user.id)}
                    className="rounded w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">{user.full_name}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Date Range */}
          <div>
            <h3 className="font-medium text-sm text-gray-900 mb-2">Data de Entrega</h3>
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">De:</label>
                <input
                  type="date"
                  value={filters.dateRange.start || ''}
                  onChange={e => handleDateRangeChange('start', e.target.value || null)}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Até:</label>
                <input
                  type="date"
                  value={filters.dateRange.end || ''}
                  onChange={e => handleDateRangeChange('end', e.target.value || null)}
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <h3 className="font-medium text-sm text-gray-900 mb-2">Status</h3>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.statuses.includes('pending')}
                  onChange={() => handleStatusChange('pending')}
                  className="rounded w-4 h-4"
                />
                <span className="text-sm text-gray-700">Pendente</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.statuses.includes('completed')}
                  onChange={() => handleStatusChange('completed')}
                  className="rounded w-4 h-4"
                />
                <span className="text-sm text-gray-700">Concluída</span>
              </label>
            </div>
          </div>

          {/* Column */}
          <div>
            <h3 className="font-medium text-sm text-gray-900 mb-2">Coluna</h3>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {columns.map(col => (
                <label key={col.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.columnIds.includes(col.id)}
                    onChange={() => handleColumnChange(col.id)}
                    className="rounded w-4 h-4"
                  />
                  <span className="text-sm text-gray-700">{col.nome}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 space-y-2 pb-[env(safe-area-inset-bottom)]">
          <button
            onClick={() => {
              onFiltersChange?.()
              onClose()
            }}
            className="w-full px-3 py-2 bg-orange-500 text-white rounded font-medium text-sm hover:bg-orange-600"
          >
            Aplicar
          </button>
          <button
            onClick={onClose}
            className="w-full px-3 py-2 border border-gray-300 text-gray-700 rounded font-medium text-sm hover:bg-gray-50"
          >
            Cancelar
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Write tests for filter panel**

Create `components/__tests__/tarefas-filters-panel.test.tsx`:

```typescript
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { TarefasFiltersPanel } from '../tarefas-filters-panel'
import { TarefasFiltersProvider } from '@/lib/context/tarefas-filters-context'
import type { TarefasColumn } from '@/lib/services/tarefas'

const mockColumns: TarefasColumn[] = [
  {
    id: 'col-1',
    board_id: 'board-1',
    nome: 'Backlog',
    cor: '#6b7280',
    posicao: 0,
    criado_por: 'user-1',
    criado_em: '2026-03-18T00:00:00Z',
  },
]

describe('TarefasFiltersPanel', () => {
  it('renders filter sections', () => {
    render(
      <TarefasFiltersProvider>
        <TarefasFiltersPanel columns={mockColumns} />
      </TarefasFiltersProvider>
    )

    expect(screen.getByText('Filtros')).toBeInTheDocument()
  })

  it('toggles filter sections', () => {
    render(
      <TarefasFiltersProvider>
        <TarefasFiltersPanel columns={mockColumns} />
      </TarefasFiltersProvider>
    )

    const priorityButton = screen.getByText(/Prioridade/)
    fireEvent.click(priorityButton)

    // Section should be visible and collapsible
    expect(screen.getByText('Baixa')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Commit**

```bash
git add components/tarefas-filters-panel.tsx \
        components/__tests__/tarefas-filters-panel.test.tsx
git commit -m "feat: add filter panel component with desktop sidebar and mobile overlay"
```

---

## Task 3: Integrate Filter Panel into Tarefas Page

**Files:**
- Modify: `app/tarefas/page.tsx`

- [ ] **Step 0: Verify TarefasListView component exists**

Before updating the page, confirm that `components/tarefas-list-view.tsx` exists. If it doesn't exist, create a minimal version or skip the 'list' view option for now. The list view is not part of this spec but referenced in the page layout.

- [ ] **Step 1: Update page to use filter panel**

Update `app/tarefas/page.tsx` to wrap with filter panel and add view toggle. See spec section "Integration Points" for layout reference. Make sure TarefasListView is properly imported or handled.

```typescript
'use client'

import React, { useState } from 'react'
import { Filter } from 'lucide-react'
import { TarefasFiltersPanel, TarefasFiltersPanelMobile } from '@/components/tarefas-filters-panel'
import { useTarefasFilters } from '@/lib/context/tarefas-filters-context'
import { TarefasCalendar } from '@/components/tarefas-calendar'
import { TarefasCalendarWeek } from '@/components/tarefas-calendar-week'
// ... other imports (TarefasKanbanBoard, TarefasListView, etc.)

export default function TarefasPage() {
  const [filtersPanelOpen, setFiltersPanelOpen] = useState(false)
  const [view, setView] = useState<'kanban' | 'list' | 'calendar-month' | 'calendar-week'>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return 'list'
    return 'kanban'
  })
  const { filters, applyFilters } = useTarefasFilters()

  // Load data
  const { board, columns, tasks } = await loadTarefasData() // existing function
  const filteredTasks = applyFilters(tasks)

  return (
    <div className="flex h-screen">
      {/* Desktop Filter Sidebar - hidden on mobile */}
      <div className="hidden md:flex">
        <TarefasFiltersPanel columns={columns} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Mobile Filter Button - only visible on mobile */}
            <button
              onClick={() => setFiltersPanelOpen(true)}
              className="md:hidden p-2 hover:bg-gray-100 rounded relative"
            >
              <Filter className="w-5 h-5 text-gray-700" />
              {filters.priorities.length > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center w-4 h-4 rounded-full bg-orange-500 text-white text-xs font-bold">
                  {Object.values(filters).filter(v => (Array.isArray(v) ? v.length > 0 : !!v)).length}
                </span>
              )}
            </button>

            {/* View Toggle */}
            <div className="flex gap-1">
              <button
                onClick={() => setView('kanban')}
                className={`px-3 py-1 rounded text-sm ${view === 'kanban' ? 'bg-orange-500 text-white' : 'bg-gray-100'}`}
              >
                Kanban
              </button>
              <button
                onClick={() => setView('list')}
                className={`px-3 py-1 rounded text-sm ${view === 'list' ? 'bg-orange-500 text-white' : 'bg-gray-100'}`}
              >
                Lista
              </button>
              <button
                onClick={() => setView('calendar-month')}
                className={`px-3 py-1 rounded text-sm ${view === 'calendar-month' ? 'bg-orange-500 text-white' : 'bg-gray-100'}`}
              >
                Mês
              </button>
              <button
                onClick={() => setView('calendar-week')}
                className={`px-3 py-1 rounded text-sm ${view === 'calendar-week' ? 'bg-orange-500 text-white' : 'bg-gray-100'}`}
              >
                Semana
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {view === 'kanban' && <TarefasKanbanBoard tasks={filteredTasks} />}
          {view === 'list' && <TarefasListView tasks={filteredTasks} />}
          {view === 'calendar-month' && (
            <TarefasCalendar
              tasks={filteredTasks}
              onTaskClick={(taskId) => {
                // Handle task click - open task modal or navigate
                console.log('Task clicked:', taskId)
              }}
            />
          )}
          {view === 'calendar-week' && (
            <TarefasCalendarWeek
              tasks={filteredTasks}
              onTaskClick={(taskId) => {
                // Handle task click - open task modal or navigate
                console.log('Task clicked:', taskId)
              }}
            />
          )}
        </div>
      </div>

      {/* Mobile Filter Overlay */}
      <TarefasFiltersPanelMobile
        columns={columns}
        isOpen={filtersPanelOpen}
        onClose={() => setFiltersPanelOpen(false)}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/tarefas/page.tsx
git commit -m "feat: integrate filter panel and view toggle into tarefas page"
```

---

## Task 4: Create Calendar Month View

**Files:**
- Create: `components/tarefas-calendar.tsx`
- Create: `components/__tests__/tarefas-calendar.test.tsx`

- [ ] **Step 1: Create calendar month view component**

Create `components/tarefas-calendar.tsx`:

```typescript
'use client'

import React, { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { TarefasTask } from '@/lib/services/tarefas'
import { TAREFAS_PRIORIDADES } from '@/lib/tarefas-constants'

interface TarefasCalendarProps {
  tasks: TarefasTask[]
  onTaskClick: (taskId: string) => void
}

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab']

export const TarefasCalendar: React.FC<TarefasCalendarProps> = ({ tasks, onTaskClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDayTasks, setSelectedDayTasks] = useState<TarefasTask[] | null>(null)

  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
  const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay()

  const days = useMemo(() => {
    const totalDays = daysInMonth(currentDate)
    const firstDay = firstDayOfMonth(currentDate)
    const result = []

    // Empty cells for days before month starts
    for (let i = 0; i < firstDay; i++) {
      result.push(null)
    }

    // Days of month
    for (let i = 1; i <= totalDays; i++) {
      result.push(i)
    }

    return result
  }, [currentDate])

  const tasksByDate = useMemo(() => {
    const grouped: Record<string, TarefasTask[]> = {}
    tasks.forEach(task => {
      if (task.data_entrega) {
        try {
          // Handle ISO format (2026-03-25T10:00:00Z) or simple date (2026-03-25)
          const dateStr = task.data_entrega.includes('T')
            ? task.data_entrega.split('T')[0]
            : task.data_entrega
          if (!grouped[dateStr]) grouped[dateStr] = []
          grouped[dateStr].push(task)
        } catch (e) {
          // Skip tasks with invalid date format
          console.warn(`Invalid date format for task ${task.id}: ${task.data_entrega}`)
        }
      }
    })
    return grouped
  }, [tasks])

  const getDayTasks = (day: number | null) => {
    if (!day) return []
    const year = currentDate.getFullYear()
    const month = String(currentDate.getMonth() + 1).padStart(2, '0')
    const dayStr = String(day).padStart(2, '0')
    const dateStr = `${year}-${month}-${dayStr}`
    return tasksByDate[dateStr] || []
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgente':
        return 'bg-red-600'
      case 'alta':
        return 'bg-orange-500'
      case 'media':
        return 'bg-purple-500'
      case 'baixa':
        return 'bg-blue-500'
      default:
        return 'bg-gray-400'
    }
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

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))
  }

  return (
    <div className="w-full h-full p-6 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          {currentDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Days of week header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAYS_OF_WEEK.map(day => (
          <div key={day} className="text-center font-semibold text-gray-700 text-sm py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 bg-gray-100 p-1 rounded">
        {days.map((day, idx) => {
          const dayTasks = getDayTasks(day)
          const isCurrentDay = isToday(day)

          return (
            <div
              key={idx}
              onClick={() => dayTasks.length > 0 && setSelectedDayTasks(dayTasks)}
              className={`min-h-24 p-2 rounded cursor-pointer transition ${
                day === null
                  ? 'bg-white'
                  : isCurrentDay
                    ? 'bg-orange-50 border-2 border-orange-500'
                    : 'bg-white hover:bg-gray-50 border border-gray-200'
              }`}
            >
              {day && (
                <>
                  <div className="text-sm font-medium text-gray-900 mb-1">{day}</div>
                  {dayTasks.length > 0 && (
                    <div className="space-y-1">
                      {dayTasks.slice(0, 4).map(task => (
                        <div
                          key={task.id}
                          className={`w-2 h-2 rounded-full ${getPriorityColor(task.prioridade)}`}
                          onClick={e => {
                            e.stopPropagation()
                            onTaskClick(task.id)
                          }}
                        />
                      ))}
                      {dayTasks.length > 4 && (
                        <div className="text-xs text-gray-600">+{dayTasks.length - 4}</div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Selected day modal */}
      {selectedDayTasks && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Tarefas para este dia</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {selectedDayTasks.map(task => (
                <div
                  key={task.id}
                  onClick={() => {
                    onTaskClick(task.id)
                    setSelectedDayTasks(null)
                  }}
                  className="p-3 border border-gray-200 rounded hover:bg-gray-50 cursor-pointer"
                >
                  <div className="font-medium text-gray-900">{task.titulo}</div>
                  <div className="text-sm text-gray-600">{task.responsavel_nome || 'Sem responsável'}</div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setSelectedDayTasks(null)}
              className="mt-4 w-full px-3 py-2 bg-gray-100 text-gray-900 rounded hover:bg-gray-200"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write tests for calendar month view**

Create `components/__tests__/tarefas-calendar.test.tsx`:

```typescript
import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { TarefasCalendar } from '../tarefas-calendar'
import type { TarefasTask } from '@/lib/services/tarefas'

const mockTask: TarefasTask = {
  id: '1',
  column_id: 'col-1',
  board_id: 'board-1',
  titulo: 'Test Task',
  descricao: null,
  prioridade: 'alta',
  responsavel_id: 'user-1',
  responsavel_nome: 'John Doe',
  data_entrega: '2026-03-25',
  posicao: 0,
  concluida: false,
  checklist: [],
  criado_em: '2026-03-18T00:00:00Z',
  atualizado_em: '2026-03-18T00:00:00Z',
}

describe('TarefasCalendar', () => {
  it('renders calendar grid', () => {
    render(
      <TarefasCalendar
        tasks={[]}
        onTaskClick={jest.fn()}
      />
    )

    expect(screen.getByText('Dom')).toBeInTheDocument()
    expect(screen.getByText('Sab')).toBeInTheDocument()
  })

  it('displays task indicators for days with tasks', () => {
    render(
      <TarefasCalendar
        tasks={[mockTask]}
        onTaskClick={jest.fn()}
      />
    )

    // Task indicator should be visible
    const indicators = screen.getAllByRole('button')
    expect(indicators.length).toBeGreaterThan(0)
  })

  it('navigates between months', () => {
    render(
      <TarefasCalendar
        tasks={[]}
        onTaskClick={jest.fn()}
      />
    )

    const nextButton = screen.getByLabelText('Next month')
    fireEvent.click(nextButton)

    // Month should have changed
    expect(screen.queryByText('March 2026')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Commit**

```bash
git add components/tarefas-calendar.tsx \
        components/__tests__/tarefas-calendar.test.tsx
git commit -m "feat: add calendar month view component with task indicators"
```

---

## Task 5: Create Calendar Week View

**Files:**
- Create: `components/tarefas-calendar-week.tsx`
- Create: `components/__tests__/tarefas-calendar-week.test.tsx`

- [ ] **Step 1: Create calendar week view component**

Create `components/tarefas-calendar-week.tsx`:

```typescript
'use client'

import React, { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, formatISO, startOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { TarefasTask } from '@/lib/services/tarefas'

interface TarefasCalendarWeekProps {
  tasks: TarefasTask[]
  onTaskClick: (taskId: string) => void
}

export const TarefasCalendarWeek: React.FC<TarefasCalendarWeekProps> = ({ tasks, onTaskClick }) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }))

  const weekDays = useMemo(() => {
    const days = []
    for (let i = 0; i < 7; i++) {
      days.push(addDays(currentWeekStart, i))
    }
    return days
  }, [currentWeekStart])

  const tasksByDay = useMemo(() => {
    const grouped: Record<string, TarefasTask[]> = {}
    weekDays.forEach(day => {
      const dayISO = formatISO(day, { representation: 'date' })
      grouped[dayISO] = tasks.filter(t => {
        if (!t.data_entrega) return false
        try {
          const taskDate = formatISO(new Date(t.data_entrega), { representation: 'date' })
          return taskDate === dayISO
        } catch {
          return false
        }
      })
    })
    return grouped
  }, [weekDays, tasks])

  const prevWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, -7))
  }

  const nextWeek = () => {
    setCurrentWeekStart(addDays(currentWeekStart, 7))
  }

  const getPriorityColorClass = (priority: string): string => {
    switch (priority) {
      case 'urgente':
        return 'bg-red-600'
      case 'alta':
        return 'bg-orange-500'
      case 'media':
        return 'bg-purple-500'
      case 'baixa':
        return 'bg-blue-500'
      default:
        return 'bg-gray-400'
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* Header with navigation */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          Semana de {weekDays[0].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })} a{' '}
          {weekDays[6].toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
        </h2>
        <div className="flex gap-2">
          <button onClick={prevWeek} className="p-2 hover:bg-gray-100 rounded">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={nextWeek} className="p-2 hover:bg-gray-100 rounded">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Week days strip */}
      <div className="border-b border-gray-200 flex overflow-x-auto">
        {weekDays.map((day, idx) => {
          const isToday = new Date().toDateString() === day.toDateString()
          const dayISO = formatISO(day, { representation: 'date' })
          const count = tasksByDay[dayISO]?.length || 0

          return (
            <div
              key={idx}
              className={`flex-1 min-w-max px-4 py-3 text-center border-r border-gray-200 last:border-r-0 ${
                isToday ? 'bg-orange-50 border-b-2 border-orange-500' : ''
              }`}
            >
              <div className="font-semibold text-gray-900">
                {day.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' })}
              </div>
              <div className="text-xs text-gray-600 mt-1">{count} tasks</div>
            </div>
          )
        })}
      </div>

      {/* Tasks by day */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-7 gap-px bg-gray-200 p-px">
          {weekDays.map((day, idx) => {
            const dayISO = formatISO(day, { representation: 'date' })
            const dayTasks = tasksByDay[dayISO] || []

            return (
              <div key={idx} className="bg-white p-4 min-h-96 overflow-y-auto">
                <div className="space-y-2">
                  {dayTasks.map(task => (
                    <div
                      key={task.id}
                      onClick={() => onTaskClick(task.id)}
                      className="p-3 bg-gray-50 border border-gray-200 rounded hover:shadow-md cursor-pointer transition"
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className={`w-2 h-2 rounded-full mt-1 ${getPriorityColorClass(task.prioridade)}`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 text-sm truncate">
                            {task.titulo}
                          </div>
                          <div className="text-xs text-gray-600 mt-1">
                            {task.responsavel_nome || 'Sem responsável'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write tests for calendar week view**

Create `components/__tests__/tarefas-calendar-week.test.tsx`:

```typescript
import React from 'react'
import { render, screen } from '@testing-library/react'
import { TarefasCalendarWeek } from '../tarefas-calendar-week'
import type { TarefasTask } from '@/lib/services/tarefas'

const mockTask: TarefasTask = {
  id: '1',
  column_id: 'col-1',
  board_id: 'board-1',
  titulo: 'Test Task',
  descricao: null,
  prioridade: 'alta',
  responsavel_id: 'user-1',
  responsavel_nome: 'John Doe',
  data_entrega: '2026-03-25',
  posicao: 0,
  concluida: false,
  checklist: [],
  criado_em: '2026-03-18T00:00:00Z',
  atualizado_em: '2026-03-18T00:00:00Z',
}

describe('TarefasCalendarWeek', () => {
  it('renders week view with 7 days', () => {
    render(
      <TarefasCalendarWeek
        tasks={[]}
        onTaskClick={jest.fn()}
      />
    )

    const dayColumns = screen.getAllByText(/tasks/)
    expect(dayColumns.length).toBe(7)
  })

  it('displays tasks for each day', () => {
    render(
      <TarefasCalendarWeek
        tasks={[mockTask]}
        onTaskClick={jest.fn()}
      />
    )

    expect(screen.getByText('Test Task')).toBeInTheDocument()
  })

  it('calls onTaskClick when task is clicked', () => {
    const onTaskClick = jest.fn()
    render(
      <TarefasCalendarWeek
        tasks={[mockTask]}
        onTaskClick={onTaskClick}
      />
    )

    fireEvent.click(screen.getByText('Test Task'))
    expect(onTaskClick).toHaveBeenCalledWith('1')
  })
})
```

- [ ] **Step 3: Commit**

```bash
git add components/tarefas-calendar-week.tsx \
        components/__tests__/tarefas-calendar-week.test.tsx
git commit -m "feat: add calendar week view component with day-based task organization"
```

---

## Task 6: Integrate Calendar Views and Test

**Files:**
- Modify: `app/tarefas/page.tsx` (already done in Task 3, this is verification)

- [ ] **Step 1: Run all tests**

```bash
npm test -- --coverage
```

Expected: All tests pass, coverage > 80%

- [ ] **Step 2: Test filter functionality manually**

- Desktop: Click filter sections, verify checkboxes work
- Mobile: Open filter overlay, verify cascade of selections
- Verify filters apply to all views (Kanban, List, Calendar Month, Calendar Week)

- [ ] **Step 3: Test calendar functionality manually**

- Month view: Navigate between months, click day to see tasks
- Week view: Navigate between weeks, click task to open detail
- Both views: Verify filters apply correctly

- [ ] **Step 4: Commit tests and polish**

```bash
git add .
git commit -m "test: add comprehensive tests for filters and calendar components"
```

---

## Success Checklist

- [ ] Filter context created and tested
- [ ] Filter panel component works on desktop and mobile
- [ ] Calendar month view displays correctly
- [ ] Calendar week view displays correctly
- [ ] Filters apply across all views
- [ ] localStorage persists filters
- [ ] All tests pass
- [ ] Touch targets are ≥44px on mobile
- [ ] No console errors or warnings
