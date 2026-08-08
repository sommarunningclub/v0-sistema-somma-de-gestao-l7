'use client'

import * as React from 'react'
import { useTarefasFilters } from '@/lib/context/tarefas-filters-context'
import { getTeamUsers } from '@/lib/services/tarefas'
import { TAREFAS_PRIORIDADES } from '@/lib/tarefas-constants'
import { PriorityPill } from '@/components/tarefas-card'
import { SectionTitle } from '@/components/somma'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { FilterState } from '@/lib/context/tarefas-filters-context'
import type { TarefaPrioridade } from '@/lib/tarefas-constants'
import type { TarefasColumn, TarefasUser } from '@/lib/services/tarefas'

/**
 * Filtros de tarefas.
 *
 * Os controles vivem em `TarefasFiltersFields`, um só bloco reutilizado pelo
 * bottom sheet (`ResponsiveModal`, montado pela página) e pelos dois wrappers
 * históricos abaixo. Assim os critérios não divergem entre celular e desktop.
 * A API do contexto de filtros é consumida como está — este componente não
 * guarda estado de filtro próprio.
 */

export interface TarefasFiltersPanelProps {
  columns: TarefasColumn[]
  onFiltersChange?: () => void
}

const STATUS_OPTIONS: { id: 'pending' | 'completed'; label: string }[] = [
  { id: 'pending', label: 'Pendente' },
  { id: 'completed', label: 'Concluída' },
]

/** Carrega o time uma vez; a página pode injetar a lista que já possui. */
function useTeamUsers(provided?: TarefasUser[]) {
  const [users, setUsers] = React.useState<TarefasUser[]>(provided ?? [])
  const [loading, setLoading] = React.useState(!provided)

  React.useEffect(() => {
    if (provided) {
      setUsers(provided)
      setLoading(false)
      return
    }
    let cancelled = false
    const load = async () => {
      try {
        const list = await getTeamUsers()
        if (!cancelled) setUsers(list)
      } catch (error) {
        console.error('[tarefas-filters] Failed to load team users:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [provided])

  return { users, loading }
}

function CheckOption({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: () => void
  children: React.ReactNode
}) {
  return (
    <label
      className={cn(
        'flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 transition-colors',
        checked
          ? 'border-brand-border bg-brand-soft'
          : 'border-line bg-surface-raised hover:border-line-strong',
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-5 w-5 shrink-0 cursor-pointer rounded border-line-strong bg-surface-sunken accent-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      />
      <span className="min-w-0 flex-1 text-sm text-ink">{children}</span>
    </label>
  )
}

/** Bloco de controles de filtro — usado no sheet e nos wrappers. */
export function TarefasFiltersFields({
  columns,
  users: providedUsers,
  onFiltersChange,
}: TarefasFiltersPanelProps & { users?: TarefasUser[] }) {
  const { filters, setFilters } = useTarefasFilters()
  const { users, loading } = useTeamUsers(providedUsers)
  const startId = React.useId()
  const endId = React.useId()

  const patch = (next: Partial<FilterState>) => {
    setFilters({ ...filters, ...next })
    onFiltersChange?.()
  }

  const togglePriority = (priority: TarefaPrioridade) =>
    patch({
      priorities: filters.priorities.includes(priority)
        ? filters.priorities.filter((p) => p !== priority)
        : [...filters.priorities, priority],
    })

  const toggleResponsible = (userId: string) =>
    patch({
      responsavelIds: filters.responsavelIds.includes(userId)
        ? filters.responsavelIds.filter((id) => id !== userId)
        : [...filters.responsavelIds, userId],
    })

  const toggleStatus = (status: 'pending' | 'completed') =>
    patch({
      statuses: filters.statuses.includes(status)
        ? filters.statuses.filter((s) => s !== status)
        : [...filters.statuses, status],
    })

  const toggleColumn = (columnId: string) =>
    patch({
      columnIds: filters.columnIds.includes(columnId)
        ? filters.columnIds.filter((id) => id !== columnId)
        : [...filters.columnIds, columnId],
    })

  const setDate = (key: 'start' | 'end', value: string) =>
    patch({ dateRange: { ...filters.dateRange, [key]: value || null } })

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle as="h3" title="Prioridade" />
        <div className="grid gap-2 sm:grid-cols-2">
          {TAREFAS_PRIORIDADES.map((priority) => (
            <CheckOption
              key={priority.id}
              checked={filters.priorities.includes(priority.id)}
              onChange={() => togglePriority(priority.id)}
            >
              <PriorityPill prioridade={priority.id} />
            </CheckOption>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle as="h3" title="Status" />
        <div className="grid gap-2 sm:grid-cols-2">
          {STATUS_OPTIONS.map((status) => (
            <CheckOption
              key={status.id}
              checked={filters.statuses.includes(status.id)}
              onChange={() => toggleStatus(status.id)}
            >
              {status.label}
            </CheckOption>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle as="h3" title="Responsável" />
        {loading ? (
          <div className="space-y-2" aria-busy="true">
            <div className="ds-skeleton h-11 rounded-lg" />
            <div className="ds-skeleton h-11 rounded-lg" />
          </div>
        ) : users.length === 0 ? (
          <p className="text-meta text-ink-muted">Nenhum usuário disponível.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {users.map((user) => (
              <CheckOption
                key={user.id}
                checked={filters.responsavelIds.includes(user.id)}
                onChange={() => toggleResponsible(user.id)}
              >
                <span className="truncate">{user.full_name || user.email}</span>
              </CheckOption>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle as="h3" title="Coluna" />
        {columns.length === 0 ? (
          <p className="text-meta text-ink-muted">Este quadro ainda não tem colunas.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {columns.map((column) => (
              <CheckOption
                key={column.id}
                checked={filters.columnIds.includes(column.id)}
                onChange={() => toggleColumn(column.id)}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: column.cor }}
                  />
                  <span className="truncate">{column.nome}</span>
                </span>
              </CheckOption>
            ))}
          </div>
        )}
      </section>

      <section>
        <SectionTitle as="h3" title="Data de Entrega" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={startId} className="mb-1 block text-meta text-ink-muted">
              De
            </label>
            <Input
              id={startId}
              type="date"
              value={filters.dateRange.start || ''}
              onChange={(e) => setDate('start', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={endId} className="mb-1 block text-meta text-ink-muted">
              Até
            </label>
            <Input
              id={endId}
              type="date"
              value={filters.dateRange.end || ''}
              onChange={(e) => setDate('end', e.target.value)}
            />
          </div>
        </div>
      </section>
    </div>
  )
}
