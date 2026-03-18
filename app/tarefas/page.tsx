// app/tarefas/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Settings, Plus, KanbanSquare } from 'lucide-react'
import { TarefasKanbanBoard } from '@/components/tarefas-kanban-board'
import { TarefasTaskModal } from '@/components/tarefas-task-modal'
import { TarefasBoardModal } from '@/components/tarefas-board-modal'
import type { TarefasBoard, TarefasColumn, TarefasTask, TarefasUser } from '@/lib/services/tarefas'
import { getSession } from '@/components/protected-route'
import { TAREFAS_PRIORIDADES } from '@/lib/tarefas-constants'

// Priority lookup map (used in mobile card list)
const TAREFAS_PRIORIDADES_MAP = Object.fromEntries(TAREFAS_PRIORIDADES.map(p => [p.id, p]))

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
  const [refreshing, setRefreshing] = useState(false)
  const [mobileActiveColumnId, setMobileActiveColumnId] = useState<string | null>(null)

  // Modal state
  const [taskModal, setTaskModal] = useState<{ open: boolean; task: Partial<TarefasTask> | null; isNew: boolean; defaultColumnId?: string }>({
    open: false, task: null, isNew: false
  })
  const [boardModal, setBoardModal] = useState<{ open: boolean; board: Partial<TarefasBoard> | null; isNew: boolean }>({
    open: false, board: null, isNew: false
  })
  const [columnDeleteConfirm, setColumnDeleteConfirm] = useState<{ column: TarefasColumn; taskCount: number } | null>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchBoards = useCallback(async () => {
    const res = await fetch('/api/tarefas/boards')
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
      fetch(`/api/tarefas/columns?board_id=${boardId}`),
      fetch(`/api/tarefas/tasks?board_id=${boardId}`),
    ])
    if (colRes.ok) {
      const cols: TarefasColumn[] = await colRes.json()
      setColumns(cols)
      if (!mobileActiveColumnId && cols.length > 0) setMobileActiveColumnId(cols[0].id)
    }
    if (taskRes.ok) setTasks(await taskRes.json())
  }, [mobileActiveColumnId])

  const fetchUsers = useCallback(async () => {
    const res = await fetch('/api/tarefas/users')
    if (res.ok) setUsers(await res.json())
  }, [])

  useEffect(() => {
    const container = document.getElementById('main-content-scroll')
    if (container) container.scrollTop = 0
  }, [])

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      const [boardData] = await Promise.all([fetchBoards(), fetchUsers()])
      setLoading(false)
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedBoardId) {
      fetchBoardData(selectedBoardId)
    }
  }, [selectedBoardId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => {
    setRefreshing(true)
    if (selectedBoardId) {
      fetchBoardData(selectedBoardId).finally(() => setRefreshing(false))
    }
  }

  // ── Board actions ──────────────────────────────────────────────────────────

  const handleSaveBoard = async (boardData: Partial<TarefasBoard>) => {
    const session = getSession()
    if (boardData.id) {
      const res = await fetch(`/api/tarefas/boards/${boardData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: boardData.nome, descricao: boardData.descricao }),
      })
      if (res.ok) {
        const updated = await res.json()
        setBoards(prev => prev.map(b => b.id === updated.id ? updated : b))
      }
    } else {
      const res = await fetch('/api/tarefas/boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...boardData, criado_por: session?.id }),
      })
      if (res.ok) {
        const newBoard = await res.json()
        setBoards(prev => [...prev, newBoard])
        setSelectedBoardId(newBoard.id)
      }
    }
  }

  const handleDeleteBoard = async (id: string) => {
    const res = await fetch(`/api/tarefas/boards/${id}`, { method: 'DELETE' })
    if (res.ok) {
      const remaining = boards.filter(b => b.id !== id)
      setBoards(remaining)
      setSelectedBoardId(remaining[0]?.id || null)
    }
  }

  // ── Column actions ─────────────────────────────────────────────────────────

  const handleAddColumn = async () => {
    if (!selectedBoardId) return
    const session = getSession()
    const nextPos = columns.length
    const res = await fetch('/api/tarefas/columns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ board_id: selectedBoardId, nome: 'Nova Coluna', cor: '#6b7280', posicao: nextPos, criado_por: session?.id }),
    })
    if (res.ok) {
      const col = await res.json()
      setColumns(prev => [...prev, col])
    }
  }

  const handleRenameColumn = async (id: string, nome: string, cor: string) => {
    const res = await fetch(`/api/tarefas/columns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, cor }),
    })
    if (res.ok) {
      const updated = await res.json()
      setColumns(prev => prev.map(c => c.id === updated.id ? updated : c))
    }
  }

  const handleDeleteColumnRequest = async (column: TarefasColumn) => {
    const taskCount = tasks.filter(t => t.column_id === column.id).length
    if (taskCount > 0) {
      setColumnDeleteConfirm({ column, taskCount })
    } else {
      const res = await fetch(`/api/tarefas/columns/${column.id}`, { method: 'DELETE' })
      if (res.ok) setColumns(prev => prev.filter(c => c.id !== column.id))
    }
  }

  const handleMoveColumn = async (columnId: string, newIndex: number) => {
    const newColumns = [...columns]
    const oldIndex = newColumns.findIndex(c => c.id === columnId)
    if (oldIndex === -1) return
    const [moved] = newColumns.splice(oldIndex, 1)
    newColumns.splice(newIndex, 0, moved)
    // Optimistic update
    setColumns(newColumns.map((c, i) => ({ ...c, posicao: i })))
    // Persist
    await Promise.all(newColumns.map((c, i) =>
      fetch(`/api/tarefas/columns/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ posicao: i }),
      })
    ))
  }

  // ── Task actions ───────────────────────────────────────────────────────────

  const handleAddTask = (columnId: string) => {
    setTaskModal({ open: true, task: { board_id: selectedBoardId || undefined }, isNew: true, defaultColumnId: columnId })
  }

  const handleCardClick = (task: TarefasTask) => {
    setTaskModal({ open: true, task, isNew: false })
  }

  const handleSaveTask = async (taskData: Partial<TarefasTask>) => {
    if (taskData.id) {
      const res = await fetch(`/api/tarefas/tasks/${taskData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      })
      if (res.ok) {
        const updated = await res.json()
        setTasks(prev => prev.map(t => t.id === updated.id ? updated : t))
      }
    } else {
      const res = await fetch('/api/tarefas/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      })
      if (res.ok) {
        const created = await res.json()
        setTasks(prev => [...prev, created])
      }
    }
  }

  const handleDeleteTask = async (id: string) => {
    const res = await fetch(`/api/tarefas/tasks/${id}`, { method: 'DELETE' })
    if (res.ok) setTasks(prev => prev.filter(t => t.id !== id))
  }

  const handleMoveTask = async (taskId: string, newColumnId: string) => {
    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, column_id: newColumnId } : t))
    const res = await fetch(`/api/tarefas/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ column_id: newColumnId, board_id: selectedBoardId }),
    })
    if (!res.ok) {
      // Revert
      if (selectedBoardId) fetchBoardData(selectedBoardId)
    }
  }

  const selectedBoard = boards.find(b => b.id === selectedBoardId)
  const activeColumn = columns.find(c => c.id === mobileActiveColumnId)
  const mobileTasks = tasks.filter(t => t.column_id === mobileActiveColumnId).sort((a, b) => a.posicao - b.posicao)

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-3" />
          <p className="text-neutral-400 text-sm">Carregando Tarefas...</p>
        </div>
      </div>
    )
  }

  // ── Empty state (no boards) ────────────────────────────────────────────────

  if (boards.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
          <KanbanSquare className="w-12 h-12 text-neutral-600" />
          <div>
            <p className="text-white font-semibold">Nenhum quadro ainda</p>
            <p className="text-neutral-500 text-sm mt-1">Crie seu primeiro quadro para começar</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setBoardModal({ open: true, board: null, isNew: true })}
              className="px-4 py-2 bg-orange-500 text-black text-sm font-bold rounded-lg hover:bg-orange-400"
            >
              Criar quadro
            </button>
          )}
          {!isAdmin && (
            <p className="text-neutral-500 text-sm">Solicite ao administrador a criação de um quadro.</p>
          )}
        </div>

        {boardModal.open && (
          <TarefasBoardModal
            board={boardModal.board}
            isNew={boardModal.isNew}
            onClose={() => setBoardModal(s => ({ ...s, open: false }))}
            onSave={handleSaveBoard}
            onDelete={handleDeleteBoard}
          />
        )}
      </>
    )
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-white" style={{ minHeight: '100dvh' }}>

      {/* ── Header ── */}
      <div className="bg-neutral-900 border-b border-neutral-800 px-4 py-3 flex flex-col gap-3">
        {/* Row 1: title + actions */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <KanbanSquare className="w-4 h-4 text-orange-500 flex-shrink-0" />
            <span className="text-orange-500 font-bold text-sm tracking-widest uppercase">Tarefas</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={handleRefresh}
              className="p-2 text-neutral-400 hover:text-white bg-neutral-800 rounded-lg border border-neutral-700 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            {isAdmin && (
              <button
                onClick={() => setBoardModal({ open: true, board: selectedBoard || null, isNew: false })}
                className="p-2 text-neutral-400 hover:text-white bg-neutral-800 rounded-lg border border-neutral-700 transition-colors"
                title="Gerenciar quadro"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => taskModal.open || setTaskModal({ open: true, task: { board_id: selectedBoardId || undefined }, isNew: true, defaultColumnId: columns[0]?.id })}
              className="flex items-center gap-1.5 px-3 py-2 bg-orange-500 text-black text-xs font-bold rounded-lg hover:bg-orange-400"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nova Tarefa</span>
              <span className="sm:hidden">Nova</span>
            </button>
          </div>
        </div>

        {/* Row 2: board selector */}
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {boards.map(board => (
            <button
              key={board.id}
              onClick={() => setSelectedBoardId(board.id)}
              className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                selectedBoardId === board.id
                  ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                  : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500'
              }`}
            >
              {board.nome}
            </button>
          ))}
          {isAdmin && (
            <button
              onClick={() => setBoardModal({ open: true, board: null, isNew: true })}
              className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg border border-dashed border-neutral-700 text-neutral-600 hover:text-neutral-400 hover:border-neutral-500 transition-colors flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Quadro
            </button>
          )}
        </div>

        {/* Row 3 (mobile only): column tabs */}
        <div className="md:hidden flex gap-2 overflow-x-auto pb-0.5">
          {columns.map(col => {
            const count = tasks.filter(t => t.column_id === col.id).length
            return (
              <button
                key={col.id}
                onClick={() => setMobileActiveColumnId(col.id)}
                className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  mobileActiveColumnId === col.id
                    ? 'border-transparent text-black font-bold'
                    : 'bg-neutral-800 border-neutral-700 text-neutral-400'
                }`}
                style={mobileActiveColumnId === col.id ? { backgroundColor: col.cor } : {}}
              >
                {col.nome} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Content ── */}

      {/* Desktop Kanban */}
      <div className="hidden md:flex flex-1 overflow-hidden px-4 py-4">
        {selectedBoard && (
          <TarefasKanbanBoard
            board={selectedBoard}
            columns={columns}
            tasks={tasks}
            onCardClick={handleCardClick}
            onAddTask={handleAddTask}
            onMoveTask={handleMoveTask}
            onMoveColumn={handleMoveColumn}
            onRenameColumn={handleRenameColumn}
            onDeleteColumn={handleDeleteColumnRequest}
            onAddColumn={handleAddColumn}
          />
        )}
      </div>

      {/* Mobile list */}
      <div className="md:hidden flex-1 overflow-y-auto">
        {columns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3 text-center px-6">
            <p className="text-neutral-500 text-sm">Nenhuma coluna neste quadro</p>
            <button onClick={handleAddColumn} className="text-xs text-orange-400 border border-orange-500/30 px-3 py-1.5 rounded-lg">
              + Adicionar coluna
            </button>
          </div>
        ) : (
          <div className="px-4 py-3 space-y-2">
            {mobileTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
                <p className="text-neutral-600 text-sm">Nenhuma tarefa nesta coluna</p>
                <button
                  onClick={() => mobileActiveColumnId && handleAddTask(mobileActiveColumnId)}
                  className="text-xs text-orange-400 border border-orange-500/30 px-3 py-1.5 rounded-lg"
                >
                  + Adicionar tarefa
                </button>
              </div>
            ) : (
              mobileTasks.map(task => {
                const prioItem = (TAREFAS_PRIORIDADES_MAP as any)[task.prioridade]
                const done = task.checklist.filter(i => i.concluido).length
                const total = task.checklist.length
                const overdue = task.data_entrega && new Date(task.data_entrega + 'T23:59:59') < new Date() && !task.concluida

                return (
                  <div
                    key={task.id}
                    onClick={() => handleCardClick(task)}
                    className="bg-neutral-800/80 border border-neutral-700/60 rounded-xl p-3.5 cursor-pointer active:bg-neutral-700/80 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      {prioItem && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${prioItem.badgeBg} ${prioItem.badgeText}`}>
                          {prioItem.label.toUpperCase()}
                        </span>
                      )}
                      {task.data_entrega && (
                        <span className={`text-[10px] ${overdue ? 'text-red-400 font-semibold' : 'text-neutral-500'}`}>
                          📅 {task.data_entrega.split('-').reverse().slice(0, 2).join('/')}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm font-semibold ${task.concluida ? 'line-through text-neutral-500' : 'text-white'}`}>
                      {task.titulo}
                    </p>
                    {total > 0 && (
                      <div className="mt-2">
                        <div className="h-1 bg-neutral-700 rounded-full">
                          <div className="h-1 bg-orange-500 rounded-full" style={{ width: `${Math.round((done/total)*100)}%` }} />
                        </div>
                        <span className="text-[10px] text-neutral-500 mt-0.5 block">{done}/{total} itens</span>
                      </div>
                    )}
                    {task.responsavel_nome && (
                      <p className="text-[10px] text-neutral-500 mt-1.5">{task.responsavel_nome}</p>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}
        <div className="h-24" />
      </div>

      {/* ── Column delete confirmation ── */}
      {columnDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 max-w-sm w-full shadow-2xl">
            <p className="text-white font-semibold mb-2">Não é possível excluir</p>
            <p className="text-neutral-400 text-sm mb-4">
              A coluna <strong className="text-white">"{columnDeleteConfirm.column.nome}"</strong> tem{' '}
              <strong className="text-orange-400">{columnDeleteConfirm.taskCount} tarefa(s)</strong>.
              Mova ou exclua as tarefas antes de remover a coluna.
            </p>
            <button
              onClick={() => setColumnDeleteConfirm(null)}
              className="w-full py-2 bg-neutral-800 text-white text-sm font-medium rounded-lg hover:bg-neutral-700"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {taskModal.open && (
        <TarefasTaskModal
          task={taskModal.task}
          isNew={taskModal.isNew}
          columns={columns}
          users={users}
          defaultColumnId={taskModal.defaultColumnId}
          onClose={() => setTaskModal(s => ({ ...s, open: false }))}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
        />
      )}

      {boardModal.open && (
        <TarefasBoardModal
          board={boardModal.board}
          isNew={boardModal.isNew}
          onClose={() => setBoardModal(s => ({ ...s, open: false }))}
          onSave={handleSaveBoard}
          onDelete={handleDeleteBoard}
        />
      )}
    </div>
  )
}
