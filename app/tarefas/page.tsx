// app/tarefas/page.tsx
'use client'

import { useCallback, useEffect, useMemo, useState, type ElementType } from 'react'
import {
  CalendarDays,
  CalendarRange,
  KanbanSquare,
  Plus,
  RefreshCw,
  Settings,
} from 'lucide-react'
import {
  EmptyState,
  FilterButton,
  FilterChip,
  NoResultsState,
  PageHeader,
  PageShell,
  ResponsiveModal,
  SearchInput,
  SegmentedControl,
  Skeleton,
  Toolbar,
  confirmAction,
  notify,
} from '@/components/somma'
import { Button } from '@/components/ui/button'
import { ErrorBanner } from '@/components/ui/error-banner'
import { TarefasKanbanBoard } from '@/components/tarefas-kanban-board'
import { TarefasTaskModal } from '@/components/tarefas-task-modal'
import { TarefasBoardModal } from '@/components/tarefas-board-modal'
import { TarefasCalendar } from '@/components/tarefas-calendar'
import { TarefasCalendarWeek } from '@/components/tarefas-calendar-week'
import { TarefasFiltersFields } from '@/components/tarefas-filters-panel'
import { isOverdue } from '@/components/tarefas-card'
import { useTarefasFilters } from '@/lib/context/tarefas-filters-context'
import { getSession } from '@/components/protected-route'
import { TAREFAS_PRIORIDADES } from '@/lib/tarefas-constants'
import { matchesTextSearch } from '@/lib/search-utils'
import { apiFetch } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import type { TarefasBoard, TarefasColumn, TarefasTask, TarefasUser } from '@/lib/services/tarefas'

type TarefasView = 'kanban' | 'calendar-month' | 'calendar-week'

/*
 * `shortLabel` mantém o texto no celular. Os dois ícones de calendário
 * (`CalendarDays` e `CalendarRange`) são praticamente idênticos a 16px — sem
 * rótulo, "Mês" e "Semana" viravam dois botões indistinguíveis.
 */
const VIEW_OPTIONS: Array<{
  value: TarefasView
  label: string
  shortLabel: string
  icon: ElementType
}> = [
  { value: 'kanban', label: 'Kanban', shortLabel: 'Quadro', icon: KanbanSquare },
  { value: 'calendar-month', label: 'Mês', shortLabel: 'Mês', icon: CalendarDays },
  { value: 'calendar-week', label: 'Semana', shortLabel: 'Sem.', icon: CalendarRange },
]

const STATUS_LABEL: Record<'pending' | 'completed', string> = {
  pending: 'Pendente',
  completed: 'Concluída',
}

function BoardSkeleton() {
  return (
    <div aria-hidden="true" className="flex gap-3 overflow-hidden">
      {[0, 1, 2].map((i) => (
        <div key={i} className="w-[85vw] max-w-[20rem] shrink-0 rounded-xl border border-line bg-surface p-3 sm:w-72">
          <div className="mb-3 flex items-center gap-2">
            <Skeleton className="h-2.5 w-2.5 rounded-full" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="space-y-2">
            {[0, 1, 2].map((j) => (
              <div key={j} className="rounded-xl border border-line bg-surface-raised p-3">
                <Skeleton className="h-4 w-16 rounded-full" />
                <Skeleton className="mt-2.5 h-3.5 w-4/5" />
                <Skeleton className="mt-2.5 h-3 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function TarefasPage() {
  // Check if current user is admin (board create/edit/delete is admin-only)
  const isAdmin = getSession()?.role === 'admin'

  // Data state
  const [boards, setBoards] = useState<TarefasBoard[]>([])
  const [columns, setColumns] = useState<TarefasColumn[]>([])
  const [tasks, setTasks] = useState<TarefasTask[]>([])
  const [users, setUsers] = useState<TarefasUser[]>([])
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null)

  // UI state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [view, setView] = useState<TarefasView>('kanban')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Filters
  const { filters, setFilters, clearFilters, applyFilters, hasActiveFilters } = useTarefasFilters()

  const activeFilterCount =
    filters.priorities.length +
    filters.responsavelIds.length +
    filters.statuses.length +
    filters.columnIds.length +
    (filters.dateRange.start ? 1 : 0) +
    (filters.dateRange.end ? 1 : 0)

  // Modal state
  const [taskModal, setTaskModal] = useState<{
    open: boolean
    task: Partial<TarefasTask> | null
    isNew: boolean
    defaultColumnId?: string
  }>({ open: false, task: null, isNew: false })
  const [boardModal, setBoardModal] = useState<{
    open: boolean
    board: Partial<TarefasBoard> | null
    isNew: boolean
  }>({ open: false, board: null, isNew: false })

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchBoards = useCallback(async () => {
    const res = await apiFetch('/api/tarefas/boards')
    if (res.ok) {
      const data: TarefasBoard[] = await res.json()
      setBoards(data)
      if (!selectedBoardId && data.length > 0) {
        setSelectedBoardId(data[0].id)
      }
      return data
    }
    return []
  }, [selectedBoardId])

  const fetchBoardData = useCallback(async (boardId: string) => {
    const [colRes, taskRes] = await Promise.all([
      apiFetch(`/api/tarefas/columns?board_id=${boardId}`),
      apiFetch(`/api/tarefas/tasks?board_id=${boardId}`),
    ])
    if (colRes.ok) setColumns(await colRes.json())
    if (taskRes.ok) setTasks(await taskRes.json())
  }, [])

  const fetchUsers = useCallback(async () => {
    const res = await apiFetch('/api/tarefas/users')
    if (res.ok) setUsers(await res.json())
  }, [])

  useEffect(() => {
    const container = document.getElementById('main-content-scroll')
    if (container) container.scrollTop = 0
  }, [])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      setError(null)
      try {
        const boardsRes = await apiFetch('/api/tarefas/boards')
        if (!boardsRes.ok) throw new Error('Erro ao carregar quadros')
        const boardData: TarefasBoard[] = await boardsRes.json()
        setBoards(boardData)
        if (!selectedBoardId && boardData.length > 0) {
          setSelectedBoardId(boardData[0].id)
        }
        await fetchUsers()
      } catch {
        setError('Erro ao carregar tarefas')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedBoardId) {
      fetchBoardData(selectedBoardId)
    }
  }, [selectedBoardId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => {
    if (!selectedBoardId) return
    setRefreshing(true)
    fetchBoardData(selectedBoardId).finally(() => setRefreshing(false))
  }

  // ── Board actions ──────────────────────────────────────────────────────────

  const handleSaveBoard = async (boardData: Partial<TarefasBoard>) => {
    const session = getSession()
    if (boardData.id) {
      const res = await apiFetch(`/api/tarefas/boards/${boardData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: boardData.nome, descricao: boardData.descricao }),
      })
      if (res.ok) {
        const updated = await res.json()
        setBoards((prev) => prev.map((b) => (b.id === updated.id ? updated : b)))
      }
    } else {
      const res = await apiFetch('/api/tarefas/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...boardData, criado_por: session?.id }),
      })
      if (res.ok) {
        const newBoard = await res.json()
        setBoards((prev) => [...prev, newBoard])
        setSelectedBoardId(newBoard.id)
      }
    }
  }

  const handleDeleteBoard = async (id: string) => {
    const res = await apiFetch(`/api/tarefas/boards/${id}`, { method: 'DELETE' })
    if (res.ok) {
      const remaining = boards.filter((b) => b.id !== id)
      setBoards(remaining)
      setSelectedBoardId(remaining[0]?.id || null)
    }
  }

  // ── Column actions ─────────────────────────────────────────────────────────

  const handleAddColumn = async () => {
    if (!selectedBoardId) return
    const session = getSession()
    const nextPos = columns.length
    const res = await apiFetch('/api/tarefas/columns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        board_id: selectedBoardId,
        nome: 'Nova Coluna',
        cor: '#6b7280',
        posicao: nextPos,
        criado_por: session?.id,
      }),
    })
    if (res.ok) {
      const col = await res.json()
      setColumns((prev) => [...prev, col])
    } else {
      notify.error('Não foi possível criar a coluna.')
    }
  }

  const handleRenameColumn = async (id: string, nome: string, cor: string) => {
    const res = await apiFetch(`/api/tarefas/columns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, cor }),
    })
    if (res.ok) {
      const updated = await res.json()
      setColumns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    } else {
      notify.error('Não foi possível renomear a coluna.')
    }
  }

  const handleDeleteColumnRequest = async (column: TarefasColumn) => {
    const taskCount = tasks.filter((t) => t.column_id === column.id).length
    if (taskCount > 0) {
      notify.warning(`A coluna “${column.nome}” ainda tem ${taskCount} tarefa(s).`, {
        description: 'Mova ou exclua as tarefas antes de remover a coluna.',
      })
      return
    }
    const confirmed = await confirmAction({
      title: 'Excluir esta coluna?',
      description: 'A coluna sai do quadro. Esta ação não pode ser desfeita.',
      detail: column.nome,
      tone: 'danger',
    })
    if (!confirmed) return
    const res = await apiFetch(`/api/tarefas/columns/${column.id}`, { method: 'DELETE' })
    if (res.ok) {
      setColumns((prev) => prev.filter((c) => c.id !== column.id))
      notify.success('Coluna excluída.')
    } else {
      notify.error('Não foi possível excluir a coluna.')
    }
  }

  const handleMoveColumn = async (columnId: string, newIndex: number) => {
    const newColumns = [...columns]
    const oldIndex = newColumns.findIndex((c) => c.id === columnId)
    if (oldIndex === -1) return
    const [moved] = newColumns.splice(oldIndex, 1)
    newColumns.splice(newIndex, 0, moved)
    // Optimistic update
    setColumns(newColumns.map((c, i) => ({ ...c, posicao: i })))
    // Persist
    await Promise.all(
      newColumns.map((c, i) =>
        apiFetch(`/api/tarefas/columns/${c.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ posicao: i }),
        }),
      ),
    )
  }

  // ── Task actions ───────────────────────────────────────────────────────────

  const handleAddTask = (columnId: string) => {
    setTaskModal({
      open: true,
      task: { board_id: selectedBoardId || undefined },
      isNew: true,
      defaultColumnId: columnId,
    })
  }

  const handleCardClick = (task: TarefasTask) => {
    setTaskModal({ open: true, task, isNew: false })
  }

  const handleSaveTask = async (taskData: Partial<TarefasTask>) => {
    if (taskData.id) {
      const res = await apiFetch(`/api/tarefas/tasks/${taskData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      })
      if (res.ok) {
        const updated = await res.json()
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
      }
    } else {
      const res = await apiFetch('/api/tarefas/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      })
      if (res.ok) {
        const created = await res.json()
        setTasks((prev) => [...prev, created])
      }
    }
  }

  const handleDeleteTask = async (id: string) => {
    const res = await apiFetch(`/api/tarefas/tasks/${id}`, { method: 'DELETE' })
    if (res.ok) setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  const handleMoveTask = async (taskId: string, newColumnId: string) => {
    // Optimistic update
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, column_id: newColumnId } : t)))
    const res = await apiFetch(`/api/tarefas/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ column_id: newColumnId, board_id: selectedBoardId }),
    })
    if (!res.ok) {
      // Revert
      notify.error('Não foi possível mover a tarefa.')
      if (selectedBoardId) fetchBoardData(selectedBoardId)
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const selectedBoard = boards.find((b) => b.id === selectedBoardId)

  const filteredTasks = useMemo(
    () =>
      applyFilters(tasks).filter((task) =>
        matchesTextSearch(searchQuery, [task.titulo, task.descricao, task.responsavel_nome]),
      ),
    [applyFilters, tasks, searchQuery],
  )

  const overdueCount = filteredTasks.filter(
    (t) => isOverdue(t.data_entrega) && !t.concluida,
  ).length
  const doneCount = filteredTasks.filter((t) => t.concluida).length

  const clearAll = () => {
    clearFilters()
    setSearchQuery('')
  }

  const removePriority = (id: string) =>
    setFilters({ ...filters, priorities: filters.priorities.filter((p) => p !== id) })
  const removeStatus = (id: 'pending' | 'completed') =>
    setFilters({ ...filters, statuses: filters.statuses.filter((s) => s !== id) })
  const removeResponsavel = (id: string) =>
    setFilters({ ...filters, responsavelIds: filters.responsavelIds.filter((r) => r !== id) })
  const removeColumn = (id: string) =>
    setFilters({ ...filters, columnIds: filters.columnIds.filter((c) => c !== id) })
  const removeDate = (key: 'start' | 'end') =>
    setFilters({ ...filters, dateRange: { ...filters.dateRange, [key]: null } })

  const openNewTask = () =>
    setTaskModal({
      open: true,
      task: { board_id: selectedBoardId || undefined },
      isNew: true,
      defaultColumnId: columns[0]?.id,
    })

  // ── Error ──────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <PageShell>
        <div className="pt-6">
          <ErrorBanner
            message={error}
            onRetry={() => {
              setLoading(true)
              setError(null)
              void Promise.all([fetchBoards(), fetchUsers()]).finally(() => setLoading(false))
            }}
          />
        </div>
      </PageShell>
    )
  }

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <PageShell>
        <PageHeader eyebrow="Gestão" title="Tarefas" description="Carregando quadros..." />
        <div aria-busy="true">
          <BoardSkeleton />
        </div>
      </PageShell>
    )
  }

  // ── Empty state (no boards) ────────────────────────────────────────────────

  if (boards.length === 0) {
    return (
      <PageShell>
        <PageHeader eyebrow="Gestão" title="Tarefas" />
        <EmptyState
          icon={KanbanSquare}
          title="Nenhum quadro ainda"
          description={
            isAdmin
              ? 'Crie o primeiro quadro para organizar as tarefas do time em colunas.'
              : 'Solicite ao administrador a criação de um quadro para começar.'
          }
          action={
            isAdmin ? (
              <Button onClick={() => setBoardModal({ open: true, board: null, isNew: true })}>
                <Plus aria-hidden="true" />
                Criar quadro
              </Button>
            ) : undefined
          }
        />

        {boardModal.open ? (
          <TarefasBoardModal
            board={boardModal.board}
            isNew={boardModal.isNew}
            onClose={() => setBoardModal((s) => ({ ...s, open: false }))}
            onSave={handleSaveBoard}
            onDelete={handleDeleteBoard}
          />
        ) : null}
      </PageShell>
    )
  }

  // ── Main render ────────────────────────────────────────────────────────────

  const filtersActive = hasActiveFilters || searchQuery.trim().length > 0
  const noResults = tasks.length > 0 && filteredTasks.length === 0 && filtersActive

  return (
    <PageShell>
      <PageHeader
        eyebrow="Gestão"
        title="Tarefas"
        description={selectedBoard?.descricao || undefined}
        meta={
          <>
            <span>
              {filteredTasks.length} de {tasks.length} tarefa
              {tasks.length === 1 ? '' : 's'}
            </span>
            <span>{doneCount} concluída{doneCount === 1 ? '' : 's'}</span>
            {overdueCount > 0 ? (
              <span className="font-semibold text-danger">
                {overdueCount} vencida{overdueCount === 1 ? '' : 's'}
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="icon"
              onClick={handleRefresh}
              loading={refreshing}
              aria-label="Atualizar quadro"
            >
              <RefreshCw aria-hidden="true" />
            </Button>
            {isAdmin ? (
              <Button
                variant="secondary"
                size="icon"
                onClick={() =>
                  setBoardModal({ open: true, board: selectedBoard || null, isNew: false })
                }
                aria-label="Gerenciar quadro"
              >
                <Settings aria-hidden="true" />
              </Button>
            ) : null}
          </>
        }
        primaryAction={
          <Button onClick={openNewTask}>
            <Plus aria-hidden="true" />
            Nova tarefa
          </Button>
        }
      >
        <div className="space-y-3">
          {/* Seletor de quadro */}
          <div
            role="tablist"
            aria-label="Quadros"
            className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5"
          >
            {boards.map((board) => {
              const selected = board.id === selectedBoardId
              return (
                <button
                  key={board.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setSelectedBoardId(board.id)}
                  className={cn(
                    'ds-tap shrink-0 rounded-lg border px-3.5 text-sm font-medium transition-colors',
                    selected
                      ? 'border-brand-border bg-brand-soft text-brand-strong'
                      : 'border-line bg-surface-raised text-ink-muted hover:border-line-strong hover:text-ink-strong',
                  )}
                >
                  {board.nome}
                </button>
              )
            })}
            {isAdmin ? (
              <button
                type="button"
                onClick={() => setBoardModal({ open: true, board: null, isNew: true })}
                className="ds-tap shrink-0 rounded-lg border border-dashed border-line px-3.5 text-sm font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink-strong"
              >
                <Plus aria-hidden="true" className="mr-1 inline h-3.5 w-3.5" />
                Quadro
              </button>
            ) : null}
          </div>

          {/* Busca, visão e filtros */}
          <Toolbar>
            <SearchInput
              value={searchQuery}
              onValueChange={setSearchQuery}
              placeholder="Buscar tarefas..."
              label="Buscar tarefas"
            />
            <SegmentedControl<TarefasView>
              label="Modo de visualização"
              value={view}
              onChange={setView}
              options={VIEW_OPTIONS}
            />
            <FilterButton count={activeFilterCount} onClick={() => setFiltersOpen(true)} />
          </Toolbar>

          {/* Filtros aplicados */}
          {activeFilterCount > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {filters.priorities.map((p) => (
                <FilterChip
                  key={`p-${p}`}
                  label="Prioridade"
                  value={TAREFAS_PRIORIDADES.find((x) => x.id === p)?.label ?? p}
                  onRemove={() => removePriority(p)}
                />
              ))}
              {filters.statuses.map((s) => (
                <FilterChip
                  key={`s-${s}`}
                  label="Status"
                  value={STATUS_LABEL[s]}
                  onRemove={() => removeStatus(s)}
                />
              ))}
              {filters.responsavelIds.map((id) => (
                <FilterChip
                  key={`u-${id}`}
                  label="Responsável"
                  value={users.find((u) => u.id === id)?.full_name ?? 'Usuário'}
                  onRemove={() => removeResponsavel(id)}
                />
              ))}
              {filters.columnIds.map((id) => (
                <FilterChip
                  key={`c-${id}`}
                  label="Coluna"
                  value={columns.find((c) => c.id === id)?.nome ?? 'Coluna'}
                  onRemove={() => removeColumn(id)}
                />
              ))}
              {filters.dateRange.start ? (
                <FilterChip
                  label="De"
                  value={filters.dateRange.start.split('-').reverse().join('/')}
                  onRemove={() => removeDate('start')}
                />
              ) : null}
              {filters.dateRange.end ? (
                <FilterChip
                  label="Até"
                  value={filters.dateRange.end.split('-').reverse().join('/')}
                  onRemove={() => removeDate('end')}
                />
              ) : null}
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Limpar filtros
              </Button>
            </div>
          ) : null}
        </div>
      </PageHeader>

      {/* ── Conteúdo ── */}
      {noResults ? (
        <NoResultsState query={searchQuery || 'os filtros aplicados'} onClear={clearAll} />
      ) : (
        <div className="min-h-[24rem]">
          {view === 'kanban' && selectedBoard ? (
            <TarefasKanbanBoard
              board={selectedBoard}
              columns={columns}
              tasks={filteredTasks}
              onCardClick={handleCardClick}
              onAddTask={handleAddTask}
              onMoveTask={handleMoveTask}
              onMoveColumn={handleMoveColumn}
              onRenameColumn={handleRenameColumn}
              onDeleteColumn={handleDeleteColumnRequest}
              onAddColumn={handleAddColumn}
            />
          ) : null}

          {view === 'calendar-month' ? (
            <TarefasCalendar
              tasks={filteredTasks}
              onTaskClick={(id) => {
                const task = tasks.find((t) => t.id === id)
                if (task) handleCardClick(task)
              }}
            />
          ) : null}

          {view === 'calendar-week' ? (
            <TarefasCalendarWeek
              tasks={filteredTasks}
              onTaskClick={(id) => {
                const task = tasks.find((t) => t.id === id)
                if (task) handleCardClick(task)
              }}
            />
          ) : null}
        </div>
      )}

      {/* ── Filtros (bottom sheet no mobile, diálogo no desktop) ── */}
      <ResponsiveModal
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title="Filtros"
        description="Combine critérios para focar em um recorte do quadro."
        size="lg"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
            >
              Limpar filtros
            </Button>
            <Button onClick={() => setFiltersOpen(false)}>Ver resultados</Button>
          </>
        }
      >
        <TarefasFiltersFields columns={columns} users={users} />
      </ResponsiveModal>

      {/* ── Modais ── */}
      {taskModal.open ? (
        <TarefasTaskModal
          task={taskModal.task}
          isNew={taskModal.isNew}
          columns={columns}
          users={users}
          defaultColumnId={taskModal.defaultColumnId}
          onClose={() => setTaskModal((s) => ({ ...s, open: false }))}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
        />
      ) : null}

      {boardModal.open ? (
        <TarefasBoardModal
          board={boardModal.board}
          isNew={boardModal.isNew}
          onClose={() => setBoardModal((s) => ({ ...s, open: false }))}
          onSave={handleSaveBoard}
          onDelete={handleDeleteBoard}
        />
      ) : null}
    </PageShell>
  )
}
