'use client'

import React, { useState, useEffect } from 'react'
import { ChevronDown, X, Filter } from 'lucide-react'
import { useTarefasFilters } from '@/lib/context/tarefas-filters-context'
import { getTeamUsers } from '@/lib/services/tarefas'
import { TAREFAS_PRIORIDADES } from '@/lib/tarefas-constants'
import type { TarefasColumn, TarefasUser } from '@/lib/services/tarefas'
import type { FilterState } from '@/lib/context/tarefas-filters-context'
import type { TarefaPrioridade } from '@/lib/tarefas-constants'

interface TarefasFiltersPanelProps {
  columns: TarefasColumn[]
  onFiltersChange?: () => void
}

interface TarefasFiltersPanelMobileProps extends TarefasFiltersPanelProps {
  isOpen: boolean
  onClose: () => void
}

type ExpandedSection = 'priority' | 'responsible' | 'date' | 'status' | 'column'

// ─── Desktop Sidebar Component ────────────────────────────────────────────

export function TarefasFiltersPanel({
  columns,
  onFiltersChange,
}: TarefasFiltersPanelProps) {
  const { filters, setFilters, clearFilters, hasActiveFilters } = useTarefasFilters()
  const [expandedSections, setExpandedSections] = useState<Set<ExpandedSection>>(
    new Set(['priority', 'status', 'column'])
  )
  const [teamUsers, setTeamUsers] = useState<TarefasUser[]>([])
  const [usersLoading, setUsersLoading] = useState(true)

  // Load team users
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const users = await getTeamUsers()
        setTeamUsers(users)
      } catch (error) {
        console.error('[tarefas-filters] Failed to load team users:', error)
      } finally {
        setUsersLoading(false)
      }
    }
    loadUsers()
  }, [])

  const toggleSection = (section: ExpandedSection) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  const handlePriorityChange = (priority: TarefaPrioridade) => {
    const newPriorities = filters.priorities.includes(priority)
      ? filters.priorities.filter(p => p !== priority)
      : [...filters.priorities, priority]

    const newFilters: FilterState = { ...filters, priorities: newPriorities }
    setFilters(newFilters)
    onFiltersChange?.()
  }

  const handleResponsibleChange = (userId: string) => {
    const newResponsibles = filters.responsavelIds.includes(userId)
      ? filters.responsavelIds.filter(id => id !== userId)
      : [...filters.responsavelIds, userId]

    const newFilters: FilterState = { ...filters, responsavelIds: newResponsibles }
    setFilters(newFilters)
    onFiltersChange?.()
  }

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    const newDateRange = {
      ...filters.dateRange,
      [type]: value || null,
    }

    const newFilters: FilterState = { ...filters, dateRange: newDateRange }
    setFilters(newFilters)
    onFiltersChange?.()
  }

  const handleStatusChange = (status: 'pending' | 'completed') => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter(s => s !== status)
      : [...filters.statuses, status]

    const newFilters: FilterState = { ...filters, statuses: newStatuses }
    setFilters(newFilters)
    onFiltersChange?.()
  }

  const handleColumnChange = (columnId: string) => {
    const newColumns = filters.columnIds.includes(columnId)
      ? filters.columnIds.filter(id => id !== columnId)
      : [...filters.columnIds, columnId]

    const newFilters: FilterState = { ...filters, columnIds: newColumns }
    setFilters(newFilters)
    onFiltersChange?.()
  }

  const handleClearFilters = () => {
    clearFilters()
    onFiltersChange?.()
  }

  const activeFilterCount = [
    filters.priorities.length,
    filters.responsavelIds.length,
    filters.dateRange.start ? 1 : 0,
    filters.dateRange.end ? 1 : 0,
    filters.statuses.length,
    filters.columnIds.length,
  ].reduce((a, b) => a + b, 0)

  return (
    <div className="hidden md:flex md:flex-col w-64 bg-neutral-900 border-r border-neutral-800 p-4 max-h-screen overflow-y-auto">
      {/* Header with filter badge */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-orange-500" />
          <h2 className="text-sm font-semibold text-white">Filtros</h2>
        </div>
        {hasActiveFilters && (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-300">
            {activeFilterCount}
          </span>
        )}
      </div>

      {/* Priority Section */}
      <div className="mb-4 border-b border-neutral-700">
        <button
          onClick={() => toggleSection('priority')}
          className="w-full flex items-center justify-between py-3 px-2 hover:bg-neutral-800 rounded transition-colors text-left"
        >
          <span className="text-sm font-medium text-white">Prioridade</span>
          <ChevronDown
            className={`w-4 h-4 text-neutral-400 transition-transform ${
              expandedSections.has('priority') ? '' : '-rotate-90'
            }`}
          />
        </button>
        {expandedSections.has('priority') && (
          <div className="px-2 pb-3 space-y-2">
            {TAREFAS_PRIORIDADES.map(priority => (
              <label
                key={priority.id}
                className="flex items-center gap-2 cursor-pointer hover:bg-neutral-800 px-2 py-1 rounded transition-colors"
              >
                <input
                  type="checkbox"
                  checked={filters.priorities.includes(priority.id)}
                  onChange={() => handlePriorityChange(priority.id)}
                  className="w-4 h-4 rounded bg-neutral-700 border-neutral-600 checked:bg-orange-500 checked:border-orange-500 cursor-pointer"
                />
                <span className="text-sm text-neutral-300">{priority.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Responsible User Section */}
      <div className="mb-4 border-b border-neutral-700">
        <button
          onClick={() => toggleSection('responsible')}
          className="w-full flex items-center justify-between py-3 px-2 hover:bg-neutral-800 rounded transition-colors text-left"
        >
          <span className="text-sm font-medium text-white">Responsável</span>
          <ChevronDown
            className={`w-4 h-4 text-neutral-400 transition-transform ${
              expandedSections.has('responsible') ? '' : '-rotate-90'
            }`}
          />
        </button>
        {expandedSections.has('responsible') && (
          <div className="px-2 pb-3 space-y-2">
            {usersLoading ? (
              <p className="text-xs text-neutral-500 py-2">Carregando...</p>
            ) : teamUsers.length === 0 ? (
              <p className="text-xs text-neutral-500 py-2">Nenhum usuário disponível</p>
            ) : (
              teamUsers.map(user => (
                <label
                  key={user.id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-neutral-800 px-2 py-1 rounded transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={filters.responsavelIds.includes(user.id)}
                    onChange={() => handleResponsibleChange(user.id)}
                    className="w-4 h-4 rounded bg-neutral-700 border-neutral-600 checked:bg-orange-500 checked:border-orange-500 cursor-pointer"
                  />
                  <span className="text-sm text-neutral-300">{user.full_name}</span>
                </label>
              ))
            )}
          </div>
        )}
      </div>

      {/* Date Range Section */}
      <div className="mb-4 border-b border-neutral-700">
        <button
          onClick={() => toggleSection('date')}
          className="w-full flex items-center justify-between py-3 px-2 hover:bg-neutral-800 rounded transition-colors text-left"
        >
          <span className="text-sm font-medium text-white">Data de Entrega</span>
          <ChevronDown
            className={`w-4 h-4 text-neutral-400 transition-transform ${
              expandedSections.has('date') ? '' : '-rotate-90'
            }`}
          />
        </button>
        {expandedSections.has('date') && (
          <div className="px-2 pb-3 space-y-2">
            <div>
              <label className="text-xs text-neutral-400 block mb-1">De</label>
              <input
                type="date"
                value={filters.dateRange.start || ''}
                onChange={e => handleDateChange('start', e.target.value)}
                className="w-full px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
                placeholder="De"
              />
            </div>
            <div>
              <label className="text-xs text-neutral-400 block mb-1">Até</label>
              <input
                type="date"
                value={filters.dateRange.end || ''}
                onChange={e => handleDateChange('end', e.target.value)}
                className="w-full px-2 py-1 rounded bg-neutral-800 border border-neutral-700 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500"
                placeholder="Até"
              />
            </div>
          </div>
        )}
      </div>

      {/* Status Section */}
      <div className="mb-4 border-b border-neutral-700">
        <button
          onClick={() => toggleSection('status')}
          className="w-full flex items-center justify-between py-3 px-2 hover:bg-neutral-800 rounded transition-colors text-left"
        >
          <span className="text-sm font-medium text-white">Status</span>
          <ChevronDown
            className={`w-4 h-4 text-neutral-400 transition-transform ${
              expandedSections.has('status') ? '' : '-rotate-90'
            }`}
          />
        </button>
        {expandedSections.has('status') && (
          <div className="px-2 pb-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer hover:bg-neutral-800 px-2 py-1 rounded transition-colors">
              <input
                type="checkbox"
                checked={filters.statuses.includes('pending')}
                onChange={() => handleStatusChange('pending')}
                className="w-4 h-4 rounded bg-neutral-700 border-neutral-600 checked:bg-orange-500 checked:border-orange-500 cursor-pointer"
              />
              <span className="text-sm text-neutral-300">Pendente</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer hover:bg-neutral-800 px-2 py-1 rounded transition-colors">
              <input
                type="checkbox"
                checked={filters.statuses.includes('completed')}
                onChange={() => handleStatusChange('completed')}
                className="w-4 h-4 rounded bg-neutral-700 border-neutral-600 checked:bg-orange-500 checked:border-orange-500 cursor-pointer"
              />
              <span className="text-sm text-neutral-300">Concluída</span>
            </label>
          </div>
        )}
      </div>

      {/* Column Section */}
      <div className="mb-6 border-b border-neutral-700">
        <button
          onClick={() => toggleSection('column')}
          className="w-full flex items-center justify-between py-3 px-2 hover:bg-neutral-800 rounded transition-colors text-left"
        >
          <span className="text-sm font-medium text-white">Coluna</span>
          <ChevronDown
            className={`w-4 h-4 text-neutral-400 transition-transform ${
              expandedSections.has('column') ? '' : '-rotate-90'
            }`}
          />
        </button>
        {expandedSections.has('column') && (
          <div className="px-2 pb-3 space-y-2">
            {columns.map(column => (
              <label
                key={column.id}
                className="flex items-center gap-2 cursor-pointer hover:bg-neutral-800 px-2 py-1 rounded transition-colors"
              >
                <input
                  type="checkbox"
                  checked={filters.columnIds.includes(column.id)}
                  onChange={() => handleColumnChange(column.id)}
                  className="w-4 h-4 rounded bg-neutral-700 border-neutral-600 checked:bg-orange-500 checked:border-orange-500 cursor-pointer"
                />
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: column.cor }}
                  />
                  <span className="text-sm text-neutral-300">{column.nome}</span>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <button
          onClick={handleClearFilters}
          className="w-full py-2 px-3 text-sm font-medium text-orange-400 hover:bg-orange-500/10 rounded border border-orange-500/30 transition-colors"
        >
          Limpar Filtros
        </button>
      )}
    </div>
  )
}

// ─── Mobile Overlay Component ──────────────────────────────────────────────

export function TarefasFiltersPanelMobile({
  columns,
  isOpen,
  onClose,
  onFiltersChange,
}: TarefasFiltersPanelMobileProps) {
  const { filters, setFilters, clearFilters, hasActiveFilters } = useTarefasFilters()
  const [expandedSections, setExpandedSections] = useState<Set<ExpandedSection>>(
    new Set(['priority'])
  )
  const [teamUsers, setTeamUsers] = useState<TarefasUser[]>([])
  const [usersLoading, setUsersLoading] = useState(true)

  // Load team users
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const users = await getTeamUsers()
        setTeamUsers(users)
      } catch (error) {
        console.error('[tarefas-filters] Failed to load team users:', error)
      } finally {
        setUsersLoading(false)
      }
    }
    loadUsers()
  }, [])

  const toggleSection = (section: ExpandedSection) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  const handlePriorityChange = (priority: TarefaPrioridade) => {
    const newPriorities = filters.priorities.includes(priority)
      ? filters.priorities.filter(p => p !== priority)
      : [...filters.priorities, priority]

    const newFilters: FilterState = { ...filters, priorities: newPriorities }
    setFilters(newFilters)
    onFiltersChange?.()
  }

  const handleResponsibleChange = (userId: string) => {
    const newResponsibles = filters.responsavelIds.includes(userId)
      ? filters.responsavelIds.filter(id => id !== userId)
      : [...filters.responsavelIds, userId]

    const newFilters: FilterState = { ...filters, responsavelIds: newResponsibles }
    setFilters(newFilters)
    onFiltersChange?.()
  }

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    const newDateRange = {
      ...filters.dateRange,
      [type]: value || null,
    }

    const newFilters: FilterState = { ...filters, dateRange: newDateRange }
    setFilters(newFilters)
    onFiltersChange?.()
  }

  const handleStatusChange = (status: 'pending' | 'completed') => {
    const newStatuses = filters.statuses.includes(status)
      ? filters.statuses.filter(s => s !== status)
      : [...filters.statuses, status]

    const newFilters: FilterState = { ...filters, statuses: newStatuses }
    setFilters(newFilters)
    onFiltersChange?.()
  }

  const handleColumnChange = (columnId: string) => {
    const newColumns = filters.columnIds.includes(columnId)
      ? filters.columnIds.filter(id => id !== columnId)
      : [...filters.columnIds, columnId]

    const newFilters: FilterState = { ...filters, columnIds: newColumns }
    setFilters(newFilters)
    onFiltersChange?.()
  }

  const handleClearFilters = () => {
    clearFilters()
    onFiltersChange?.()
  }

  const activeFilterCount = [
    filters.priorities.length,
    filters.responsavelIds.length,
    filters.dateRange.start ? 1 : 0,
    filters.dateRange.end ? 1 : 0,
    filters.statuses.length,
    filters.columnIds.length,
  ].reduce((a, b) => a + b, 0)

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
      />

      {/* Slide-in Panel */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-full max-w-sm bg-neutral-900 border-r border-neutral-800 overflow-y-auto transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } pb-[env(safe-area-inset-bottom)]`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-neutral-900 border-b border-neutral-800 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-orange-500" />
            <h2 className="text-sm font-semibold text-white">Filtros</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-neutral-800 rounded transition-colors"
          >
            <X className="w-5 h-5 text-neutral-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Priority Section */}
          <div className="mb-4 border-b border-neutral-700">
            <button
              onClick={() => toggleSection('priority')}
              className="w-full flex items-center justify-between py-3 px-2 hover:bg-neutral-800 rounded transition-colors text-left"
            >
              <span className="text-sm font-medium text-white">Prioridade</span>
              <ChevronDown
                className={`w-4 h-4 text-neutral-400 transition-transform ${
                  expandedSections.has('priority') ? '' : '-rotate-90'
                }`}
              />
            </button>
            {expandedSections.has('priority') && (
              <div className="px-2 pb-3 space-y-2">
                {TAREFAS_PRIORIDADES.map(priority => (
                  <label
                    key={priority.id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-neutral-800 px-2 py-1 rounded transition-colors min-h-[44px]"
                  >
                    <input
                      type="checkbox"
                      checked={filters.priorities.includes(priority.id)}
                      onChange={() => handlePriorityChange(priority.id)}
                      className="w-5 h-5 rounded bg-neutral-700 border-neutral-600 checked:bg-orange-500 checked:border-orange-500 cursor-pointer"
                    />
                    <span className="text-sm text-neutral-300">{priority.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Responsible User Section */}
          <div className="mb-4 border-b border-neutral-700">
            <button
              onClick={() => toggleSection('responsible')}
              className="w-full flex items-center justify-between py-3 px-2 hover:bg-neutral-800 rounded transition-colors text-left"
            >
              <span className="text-sm font-medium text-white">Responsável</span>
              <ChevronDown
                className={`w-4 h-4 text-neutral-400 transition-transform ${
                  expandedSections.has('responsible') ? '' : '-rotate-90'
                }`}
              />
            </button>
            {expandedSections.has('responsible') && (
              <div className="px-2 pb-3 space-y-2">
                {usersLoading ? (
                  <p className="text-xs text-neutral-500 py-2">Carregando...</p>
                ) : teamUsers.length === 0 ? (
                  <p className="text-xs text-neutral-500 py-2">Nenhum usuário disponível</p>
                ) : (
                  teamUsers.map(user => (
                    <label
                      key={user.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-neutral-800 px-2 py-1 rounded transition-colors min-h-[44px]"
                    >
                      <input
                        type="checkbox"
                        checked={filters.responsavelIds.includes(user.id)}
                        onChange={() => handleResponsibleChange(user.id)}
                        className="w-5 h-5 rounded bg-neutral-700 border-neutral-600 checked:bg-orange-500 checked:border-orange-500 cursor-pointer"
                      />
                      <span className="text-sm text-neutral-300">{user.full_name}</span>
                    </label>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Date Range Section */}
          <div className="mb-4 border-b border-neutral-700">
            <button
              onClick={() => toggleSection('date')}
              className="w-full flex items-center justify-between py-3 px-2 hover:bg-neutral-800 rounded transition-colors text-left"
            >
              <span className="text-sm font-medium text-white">Data de Entrega</span>
              <ChevronDown
                className={`w-4 h-4 text-neutral-400 transition-transform ${
                  expandedSections.has('date') ? '' : '-rotate-90'
                }`}
              />
            </button>
            {expandedSections.has('date') && (
              <div className="px-2 pb-3 space-y-2">
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">De</label>
                  <input
                    type="date"
                    value={filters.dateRange.start || ''}
                    onChange={e => handleDateChange('start', e.target.value)}
                    className="w-full px-3 py-2 rounded bg-neutral-800 border border-neutral-700 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 min-h-[44px]"
                    placeholder="De"
                  />
                </div>
                <div>
                  <label className="text-xs text-neutral-400 block mb-1">Até</label>
                  <input
                    type="date"
                    value={filters.dateRange.end || ''}
                    onChange={e => handleDateChange('end', e.target.value)}
                    className="w-full px-3 py-2 rounded bg-neutral-800 border border-neutral-700 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500 min-h-[44px]"
                    placeholder="Até"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Status Section */}
          <div className="mb-4 border-b border-neutral-700">
            <button
              onClick={() => toggleSection('status')}
              className="w-full flex items-center justify-between py-3 px-2 hover:bg-neutral-800 rounded transition-colors text-left"
            >
              <span className="text-sm font-medium text-white">Status</span>
              <ChevronDown
                className={`w-4 h-4 text-neutral-400 transition-transform ${
                  expandedSections.has('status') ? '' : '-rotate-90'
                }`}
              />
            </button>
            {expandedSections.has('status') && (
              <div className="px-2 pb-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer hover:bg-neutral-800 px-2 py-1 rounded transition-colors min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={filters.statuses.includes('pending')}
                    onChange={() => handleStatusChange('pending')}
                    className="w-5 h-5 rounded bg-neutral-700 border-neutral-600 checked:bg-orange-500 checked:border-orange-500 cursor-pointer"
                  />
                  <span className="text-sm text-neutral-300">Pendente</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer hover:bg-neutral-800 px-2 py-1 rounded transition-colors min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={filters.statuses.includes('completed')}
                    onChange={() => handleStatusChange('completed')}
                    className="w-5 h-5 rounded bg-neutral-700 border-neutral-600 checked:bg-orange-500 checked:border-orange-500 cursor-pointer"
                  />
                  <span className="text-sm text-neutral-300">Concluída</span>
                </label>
              </div>
            )}
          </div>

          {/* Column Section */}
          <div className="mb-6 border-b border-neutral-700">
            <button
              onClick={() => toggleSection('column')}
              className="w-full flex items-center justify-between py-3 px-2 hover:bg-neutral-800 rounded transition-colors text-left"
            >
              <span className="text-sm font-medium text-white">Coluna</span>
              <ChevronDown
                className={`w-4 h-4 text-neutral-400 transition-transform ${
                  expandedSections.has('column') ? '' : '-rotate-90'
                }`}
              />
            </button>
            {expandedSections.has('column') && (
              <div className="px-2 pb-3 space-y-2">
                {columns.map(column => (
                  <label
                    key={column.id}
                    className="flex items-center gap-2 cursor-pointer hover:bg-neutral-800 px-2 py-1 rounded transition-colors min-h-[44px]"
                  >
                    <input
                      type="checkbox"
                      checked={filters.columnIds.includes(column.id)}
                      onChange={() => handleColumnChange(column.id)}
                      className="w-5 h-5 rounded bg-neutral-700 border-neutral-600 checked:bg-orange-500 checked:border-orange-500 cursor-pointer"
                    />
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: column.cor }}
                      />
                      <span className="text-sm text-neutral-300">{column.nome}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer with buttons */}
        <div className="sticky bottom-0 bg-neutral-900 border-t border-neutral-800 p-4 space-y-2">
          {hasActiveFilters && (
            <button
              onClick={handleClearFilters}
              className="w-full py-2 px-3 text-sm font-medium text-orange-400 hover:bg-orange-500/10 rounded border border-orange-500/30 transition-colors"
            >
              Limpar Filtros
            </button>
          )}
          <button
            onClick={onClose}
            className="w-full py-2.5 px-3 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded transition-colors min-h-[44px]"
          >
            Aplicar
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 px-3 text-sm font-medium text-neutral-300 hover:bg-neutral-800 rounded border border-neutral-700 transition-colors min-h-[44px]"
          >
            Cancelar
          </button>
        </div>
      </div>
    </>
  )
}
