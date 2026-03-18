import React from 'react'
import { renderHook, act } from '@testing-library/react'
import { TarefasFiltersProvider, useTarefasFilters } from '../tarefas-filters-context'
import type { FilterState } from '../tarefas-filters-context'
import type { TarefasTask } from '@/lib/services/tarefas'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString()
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

// Helper to create test tasks
const createTestTask = (overrides?: Partial<TarefasTask>): TarefasTask => ({
  id: 'task-1',
  column_id: 'col-1',
  board_id: 'board-1',
  titulo: 'Test Task',
  descricao: null,
  prioridade: 'media',
  responsavel_id: 'user-1',
  responsavel_nome: 'John Doe',
  data_entrega: '2026-03-25',
  posicao: 0,
  concluida: false,
  checklist: [],
  criado_em: '2026-03-18T00:00:00Z',
  atualizado_em: '2026-03-18T00:00:00Z',
  ...overrides,
})

// Wrapper component
const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <TarefasFiltersProvider>{children}</TarefasFiltersProvider>
)

describe('TarefasFiltersContext', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('Initial state', () => {
    it('should provide default filter state', () => {
      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      expect(result.current.filters).toEqual({
        priorities: [],
        responsavelIds: [],
        dateRange: { start: null, end: null },
        statuses: [],
        columnIds: [],
      })
      expect(result.current.hasActiveFilters).toBe(false)
    })
  })

  describe('Filter setting', () => {
    it('should update filters', () => {
      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      const newFilters: FilterState = {
        priorities: ['alta', 'urgente'],
        responsavelIds: [],
        dateRange: { start: null, end: null },
        statuses: [],
        columnIds: [],
      }

      act(() => {
        result.current.setFilters(newFilters)
      })

      expect(result.current.filters).toEqual(newFilters)
    })
  })

  describe('hasActiveFilters', () => {
    it('should be false with default filters', () => {
      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      expect(result.current.hasActiveFilters).toBe(false)
    })

    it('should be true when priorities are set', () => {
      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      act(() => {
        result.current.setFilters({
          priorities: ['alta'],
          responsavelIds: [],
          dateRange: { start: null, end: null },
          statuses: [],
          columnIds: [],
        })
      })

      expect(result.current.hasActiveFilters).toBe(true)
    })

    it('should be true when responsible users are set', () => {
      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      act(() => {
        result.current.setFilters({
          priorities: [],
          responsavelIds: ['user-1'],
          dateRange: { start: null, end: null },
          statuses: [],
          columnIds: [],
        })
      })

      expect(result.current.hasActiveFilters).toBe(true)
    })

    it('should be true when date range is set', () => {
      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      act(() => {
        result.current.setFilters({
          priorities: [],
          responsavelIds: [],
          dateRange: { start: '2026-03-01', end: null },
          statuses: [],
          columnIds: [],
        })
      })

      expect(result.current.hasActiveFilters).toBe(true)
    })

    it('should be true when statuses are set', () => {
      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      act(() => {
        result.current.setFilters({
          priorities: [],
          responsavelIds: [],
          dateRange: { start: null, end: null },
          statuses: ['completed'],
          columnIds: [],
        })
      })

      expect(result.current.hasActiveFilters).toBe(true)
    })

    it('should be true when columns are set', () => {
      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      act(() => {
        result.current.setFilters({
          priorities: [],
          responsavelIds: [],
          dateRange: { start: null, end: null },
          statuses: [],
          columnIds: ['col-1'],
        })
      })

      expect(result.current.hasActiveFilters).toBe(true)
    })
  })

  describe('clearFilters', () => {
    it('should reset filters to default', () => {
      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      act(() => {
        result.current.setFilters({
          priorities: ['alta'],
          responsavelIds: ['user-1'],
          dateRange: { start: '2026-03-01', end: '2026-03-31' },
          statuses: ['pending'],
          columnIds: ['col-1'],
        })
      })

      expect(result.current.hasActiveFilters).toBe(true)

      act(() => {
        result.current.clearFilters()
      })

      expect(result.current.filters).toEqual({
        priorities: [],
        responsavelIds: [],
        dateRange: { start: null, end: null },
        statuses: [],
        columnIds: [],
      })
      expect(result.current.hasActiveFilters).toBe(false)
    })
  })

  describe('applyFilters - Priority filtering', () => {
    it('should filter by single priority', () => {
      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      const tasks = [
        createTestTask({ id: 'task-1', prioridade: 'alta' }),
        createTestTask({ id: 'task-2', prioridade: 'media' }),
        createTestTask({ id: 'task-3', prioridade: 'urgente' }),
      ]

      act(() => {
        result.current.setFilters({
          priorities: ['alta'],
          responsavelIds: [],
          dateRange: { start: null, end: null },
          statuses: [],
          columnIds: [],
        })
      })

      const filtered = result.current.applyFilters(tasks)

      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('task-1')
    })

    it('should filter by multiple priorities (OR logic)', () => {
      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      const tasks = [
        createTestTask({ id: 'task-1', prioridade: 'alta' }),
        createTestTask({ id: 'task-2', prioridade: 'media' }),
        createTestTask({ id: 'task-3', prioridade: 'urgente' }),
      ]

      act(() => {
        result.current.setFilters({
          priorities: ['alta', 'urgente'],
          responsavelIds: [],
          dateRange: { start: null, end: null },
          statuses: [],
          columnIds: [],
        })
      })

      const filtered = result.current.applyFilters(tasks)

      expect(filtered).toHaveLength(2)
      expect(filtered.map((t) => t.id)).toEqual(['task-1', 'task-3'])
    })

    it('should return all tasks when no priority filter is set', () => {
      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      const tasks = [
        createTestTask({ id: 'task-1', prioridade: 'alta' }),
        createTestTask({ id: 'task-2', prioridade: 'media' }),
      ]

      const filtered = result.current.applyFilters(tasks)

      expect(filtered).toHaveLength(2)
    })
  })

  describe('applyFilters - Status filtering', () => {
    it('should filter by completed status', () => {
      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      const tasks = [
        createTestTask({ id: 'task-1', concluida: true }),
        createTestTask({ id: 'task-2', concluida: false }),
        createTestTask({ id: 'task-3', concluida: true }),
      ]

      act(() => {
        result.current.setFilters({
          priorities: [],
          responsavelIds: [],
          dateRange: { start: null, end: null },
          statuses: ['completed'],
          columnIds: [],
        })
      })

      const filtered = result.current.applyFilters(tasks)

      expect(filtered).toHaveLength(2)
      expect(filtered.map((t) => t.id)).toEqual(['task-1', 'task-3'])
    })

    it('should filter by pending status', () => {
      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      const tasks = [
        createTestTask({ id: 'task-1', concluida: true }),
        createTestTask({ id: 'task-2', concluida: false }),
        createTestTask({ id: 'task-3', concluida: false }),
      ]

      act(() => {
        result.current.setFilters({
          priorities: [],
          responsavelIds: [],
          dateRange: { start: null, end: null },
          statuses: ['pending'],
          columnIds: [],
        })
      })

      const filtered = result.current.applyFilters(tasks)

      expect(filtered).toHaveLength(2)
      expect(filtered.map((t) => t.id)).toEqual(['task-2', 'task-3'])
    })

    it('should filter by both completed and pending statuses (OR logic)', () => {
      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      const tasks = [
        createTestTask({ id: 'task-1', concluida: true }),
        createTestTask({ id: 'task-2', concluida: false }),
      ]

      act(() => {
        result.current.setFilters({
          priorities: [],
          responsavelIds: [],
          dateRange: { start: null, end: null },
          statuses: ['completed', 'pending'],
          columnIds: [],
        })
      })

      const filtered = result.current.applyFilters(tasks)

      expect(filtered).toHaveLength(2)
    })
  })

  describe('applyFilters - Date range filtering', () => {
    it('should filter by start date (inclusive)', () => {
      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      const tasks = [
        createTestTask({ id: 'task-1', data_entrega: '2026-03-20' }),
        createTestTask({ id: 'task-2', data_entrega: '2026-03-25' }),
        createTestTask({ id: 'task-3', data_entrega: '2026-03-30' }),
      ]

      act(() => {
        result.current.setFilters({
          priorities: [],
          responsavelIds: [],
          dateRange: { start: '2026-03-25', end: null },
          statuses: [],
          columnIds: [],
        })
      })

      const filtered = result.current.applyFilters(tasks)

      expect(filtered).toHaveLength(2)
      expect(filtered.map((t) => t.id)).toEqual(['task-2', 'task-3'])
    })

    it('should filter by end date (inclusive)', () => {
      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      const tasks = [
        createTestTask({ id: 'task-1', data_entrega: '2026-03-20' }),
        createTestTask({ id: 'task-2', data_entrega: '2026-03-25' }),
        createTestTask({ id: 'task-3', data_entrega: '2026-03-30' }),
      ]

      act(() => {
        result.current.setFilters({
          priorities: [],
          responsavelIds: [],
          dateRange: { start: null, end: '2026-03-25' },
          statuses: [],
          columnIds: [],
        })
      })

      const filtered = result.current.applyFilters(tasks)

      expect(filtered).toHaveLength(2)
      expect(filtered.map((t) => t.id)).toEqual(['task-1', 'task-2'])
    })

    it('should filter by date range (inclusive on both ends)', () => {
      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      const tasks = [
        createTestTask({ id: 'task-1', data_entrega: '2026-03-20' }),
        createTestTask({ id: 'task-2', data_entrega: '2026-03-25' }),
        createTestTask({ id: 'task-3', data_entrega: '2026-03-30' }),
      ]

      act(() => {
        result.current.setFilters({
          priorities: [],
          responsavelIds: [],
          dateRange: { start: '2026-03-25', end: '2026-03-30' },
          statuses: [],
          columnIds: [],
        })
      })

      const filtered = result.current.applyFilters(tasks)

      expect(filtered).toHaveLength(2)
      expect(filtered.map((t) => t.id)).toEqual(['task-2', 'task-3'])
    })

    it('should exclude tasks without due date when date filter is set', () => {
      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      const tasks = [
        createTestTask({ id: 'task-1', data_entrega: null }),
        createTestTask({ id: 'task-2', data_entrega: '2026-03-25' }),
      ]

      act(() => {
        result.current.setFilters({
          priorities: [],
          responsavelIds: [],
          dateRange: { start: '2026-03-01', end: null },
          statuses: [],
          columnIds: [],
        })
      })

      const filtered = result.current.applyFilters(tasks)

      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('task-2')
    })

    it('should handle datetime format in data_entrega', () => {
      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      const tasks = [
        createTestTask({ id: 'task-1', data_entrega: '2026-03-25T10:00:00Z' }),
        createTestTask({ id: 'task-2', data_entrega: '2026-03-30T14:30:00Z' }),
      ]

      act(() => {
        result.current.setFilters({
          priorities: [],
          responsavelIds: [],
          dateRange: { start: '2026-03-25', end: null },
          statuses: [],
          columnIds: [],
        })
      })

      const filtered = result.current.applyFilters(tasks)

      expect(filtered).toHaveLength(2)
    })
  })

  describe('applyFilters - Responsible user filtering', () => {
    it('should filter by single responsible user', () => {
      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      const tasks = [
        createTestTask({ id: 'task-1', responsavel_id: 'user-1' }),
        createTestTask({ id: 'task-2', responsavel_id: 'user-2' }),
        createTestTask({ id: 'task-3', responsavel_id: 'user-1' }),
      ]

      act(() => {
        result.current.setFilters({
          priorities: [],
          responsavelIds: ['user-1'],
          dateRange: { start: null, end: null },
          statuses: [],
          columnIds: [],
        })
      })

      const filtered = result.current.applyFilters(tasks)

      expect(filtered).toHaveLength(2)
      expect(filtered.map((t) => t.id)).toEqual(['task-1', 'task-3'])
    })

    it('should filter by multiple responsible users (OR logic)', () => {
      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      const tasks = [
        createTestTask({ id: 'task-1', responsavel_id: 'user-1' }),
        createTestTask({ id: 'task-2', responsavel_id: 'user-2' }),
        createTestTask({ id: 'task-3', responsavel_id: 'user-3' }),
      ]

      act(() => {
        result.current.setFilters({
          priorities: [],
          responsavelIds: ['user-1', 'user-3'],
          dateRange: { start: null, end: null },
          statuses: [],
          columnIds: [],
        })
      })

      const filtered = result.current.applyFilters(tasks)

      expect(filtered).toHaveLength(2)
      expect(filtered.map((t) => t.id)).toEqual(['task-1', 'task-3'])
    })

    it('should exclude tasks without responsible user when filter is set', () => {
      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      const tasks = [
        createTestTask({ id: 'task-1', responsavel_id: null }),
        createTestTask({ id: 'task-2', responsavel_id: 'user-1' }),
      ]

      act(() => {
        result.current.setFilters({
          priorities: [],
          responsavelIds: ['user-1'],
          dateRange: { start: null, end: null },
          statuses: [],
          columnIds: [],
        })
      })

      const filtered = result.current.applyFilters(tasks)

      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('task-2')
    })
  })

  describe('applyFilters - Column filtering', () => {
    it('should filter by single column', () => {
      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      const tasks = [
        createTestTask({ id: 'task-1', column_id: 'col-1' }),
        createTestTask({ id: 'task-2', column_id: 'col-2' }),
        createTestTask({ id: 'task-3', column_id: 'col-1' }),
      ]

      act(() => {
        result.current.setFilters({
          priorities: [],
          responsavelIds: [],
          dateRange: { start: null, end: null },
          statuses: [],
          columnIds: ['col-1'],
        })
      })

      const filtered = result.current.applyFilters(tasks)

      expect(filtered).toHaveLength(2)
      expect(filtered.map((t) => t.id)).toEqual(['task-1', 'task-3'])
    })

    it('should filter by multiple columns (OR logic)', () => {
      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      const tasks = [
        createTestTask({ id: 'task-1', column_id: 'col-1' }),
        createTestTask({ id: 'task-2', column_id: 'col-2' }),
        createTestTask({ id: 'task-3', column_id: 'col-3' }),
      ]

      act(() => {
        result.current.setFilters({
          priorities: [],
          responsavelIds: [],
          dateRange: { start: null, end: null },
          statuses: [],
          columnIds: ['col-1', 'col-3'],
        })
      })

      const filtered = result.current.applyFilters(tasks)

      expect(filtered).toHaveLength(2)
      expect(filtered.map((t) => t.id)).toEqual(['task-1', 'task-3'])
    })
  })

  describe('applyFilters - Combined filters (AND logic between categories)', () => {
    it('should apply priority AND status filters', () => {
      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      const tasks = [
        createTestTask({ id: 'task-1', prioridade: 'alta', concluida: true }),
        createTestTask({ id: 'task-2', prioridade: 'alta', concluida: false }),
        createTestTask({ id: 'task-3', prioridade: 'media', concluida: false }),
      ]

      act(() => {
        result.current.setFilters({
          priorities: ['alta'],
          responsavelIds: [],
          dateRange: { start: null, end: null },
          statuses: ['pending'],
          columnIds: [],
        })
      })

      const filtered = result.current.applyFilters(tasks)

      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('task-2')
    })

    it('should apply priority AND responsible AND column filters', () => {
      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      const tasks = [
        createTestTask({
          id: 'task-1',
          prioridade: 'alta',
          responsavel_id: 'user-1',
          column_id: 'col-1',
        }),
        createTestTask({
          id: 'task-2',
          prioridade: 'alta',
          responsavel_id: 'user-2',
          column_id: 'col-1',
        }),
        createTestTask({
          id: 'task-3',
          prioridade: 'media',
          responsavel_id: 'user-1',
          column_id: 'col-1',
        }),
      ]

      act(() => {
        result.current.setFilters({
          priorities: ['alta'],
          responsavelIds: ['user-1'],
          dateRange: { start: null, end: null },
          statuses: [],
          columnIds: ['col-1'],
        })
      })

      const filtered = result.current.applyFilters(tasks)

      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('task-1')
    })

    it('should apply all filter types together', () => {
      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      const tasks = [
        createTestTask({
          id: 'task-1',
          prioridade: 'alta',
          responsavel_id: 'user-1',
          column_id: 'col-1',
          data_entrega: '2026-03-25',
          concluida: false,
        }),
        createTestTask({
          id: 'task-2',
          prioridade: 'alta',
          responsavel_id: 'user-1',
          column_id: 'col-1',
          data_entrega: '2026-04-10',
          concluida: false,
        }),
        createTestTask({
          id: 'task-3',
          prioridade: 'media',
          responsavel_id: 'user-1',
          column_id: 'col-1',
          data_entrega: '2026-03-25',
          concluida: false,
        }),
      ]

      act(() => {
        result.current.setFilters({
          priorities: ['alta'],
          responsavelIds: ['user-1'],
          dateRange: { start: '2026-03-01', end: '2026-03-31' },
          statuses: ['pending'],
          columnIds: ['col-1'],
        })
      })

      const filtered = result.current.applyFilters(tasks)

      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('task-1')
    })
  })

  describe('localStorage persistence', () => {
    it('should persist filters to localStorage on change', () => {
      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      const newFilters: FilterState = {
        priorities: ['alta'],
        responsavelIds: ['user-1'],
        dateRange: { start: '2026-03-01', end: null },
        statuses: ['pending'],
        columnIds: ['col-1'],
      }

      act(() => {
        result.current.setFilters(newFilters)
      })

      const stored = localStorage.getItem('tarefas-filters')
      expect(stored).toBe(JSON.stringify(newFilters))
    })

    it('should load filters from localStorage on mount', () => {
      const storedFilters: FilterState = {
        priorities: ['urgente'],
        responsavelIds: ['user-2'],
        dateRange: { start: '2026-03-15', end: '2026-03-31' },
        statuses: ['completed'],
        columnIds: ['col-2'],
      }

      localStorage.setItem('tarefas-filters', JSON.stringify(storedFilters))

      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      expect(result.current.filters).toEqual(storedFilters)
    })

    it('should handle corrupted localStorage data gracefully', () => {
      localStorage.setItem('tarefas-filters', 'invalid json')

      const { result } = renderHook(() => useTarefasFilters(), { wrapper: Wrapper })

      expect(result.current.filters).toEqual({
        priorities: [],
        responsavelIds: [],
        dateRange: { start: null, end: null },
        statuses: [],
        columnIds: [],
      })
    })
  })

  describe('Error handling', () => {
    it('should throw error if hook is used outside provider', () => {
      expect(() => {
        renderHook(() => useTarefasFilters())
      }).toThrow('useTarefasFilters must be used within a TarefasFiltersProvider')
    })
  })
})
