import { createClient } from '@supabase/supabase-js'
import type { TarefaPrioridade } from '@/lib/tarefas-constants'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TarefasBoard {
  id: string
  nome: string
  descricao: string | null
  criado_por: string | null
  criado_em: string
}

export interface TarefasColumn {
  id: string
  board_id: string
  nome: string
  cor: string
  posicao: number
  criado_por: string | null
  criado_em: string
}

export interface ChecklistItem {
  id: string
  texto: string
  concluido: boolean
}

export interface TarefasTask {
  id: string
  column_id: string
  board_id: string
  titulo: string
  descricao: string | null
  prioridade: TarefaPrioridade
  responsavel_id: string | null
  responsavel_nome: string | null
  data_entrega: string | null
  posicao: number
  concluida: boolean
  checklist: ChecklistItem[]
  criado_em: string
  atualizado_em: string
}

export interface TarefasUser {
  id: string
  full_name: string
  email: string
}

// ─── Boards ───────────────────────────────────────────────────────────────────

export async function getBoards(): Promise<TarefasBoard[]> {
  const { data, error } = await getSupabase()
    .from('tarefas_boards')
    .select('*')
    .order('criado_em', { ascending: true })
  if (error) { console.error('[v0] tarefas getBoards:', error); return [] }
  return data || []
}

export async function createBoard(board: Pick<TarefasBoard, 'nome' | 'descricao' | 'criado_por'>): Promise<TarefasBoard | null> {
  const { data, error } = await getSupabase()
    .from('tarefas_boards')
    .insert(board)
    .select()
    .single()
  if (error) { console.error('[v0] tarefas createBoard:', error); return null }
  return data
}

export async function updateBoard(id: string, updates: Partial<Pick<TarefasBoard, 'nome' | 'descricao'>>): Promise<TarefasBoard | null> {
  const { data, error } = await getSupabase()
    .from('tarefas_boards')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) { console.error('[v0] tarefas updateBoard:', error); return null }
  return data
}

export async function deleteBoard(id: string): Promise<boolean> {
  const { error } = await getSupabase()
    .from('tarefas_boards')
    .delete()
    .eq('id', id)
  if (error) { console.error('[v0] tarefas deleteBoard:', error); return false }
  return true
}

// ─── Columns ──────────────────────────────────────────────────────────────────

export async function getColumns(boardId: string): Promise<TarefasColumn[]> {
  const { data, error } = await getSupabase()
    .from('tarefas_columns')
    .select('*')
    .eq('board_id', boardId)
    .order('posicao', { ascending: true })
  if (error) { console.error('[v0] tarefas getColumns:', error); return [] }
  return data || []
}

export async function createColumn(col: Pick<TarefasColumn, 'board_id' | 'nome' | 'cor' | 'posicao' | 'criado_por'>): Promise<TarefasColumn | null> {
  const { data, error } = await getSupabase()
    .from('tarefas_columns')
    .insert(col)
    .select()
    .single()
  if (error) { console.error('[v0] tarefas createColumn:', error); return null }
  return data
}

export async function updateColumn(id: string, updates: Partial<Pick<TarefasColumn, 'nome' | 'cor' | 'posicao'>>): Promise<TarefasColumn | null> {
  const { data, error } = await getSupabase()
    .from('tarefas_columns')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) { console.error('[v0] tarefas updateColumn:', error); return null }
  return data
}

export async function countTasksInColumn(columnId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from('tarefas_tasks')
    .select('id', { count: 'exact', head: true })
    .eq('column_id', columnId)
  if (error) { console.error('[v0] tarefas countTasksInColumn:', error); return 0 }
  return count ?? 0
}

export async function deleteColumn(id: string): Promise<boolean> {
  const { error } = await getSupabase()
    .from('tarefas_columns')
    .delete()
    .eq('id', id)
  if (error) { console.error('[v0] tarefas deleteColumn:', error); return false }
  return true
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function getTasks(boardId: string): Promise<TarefasTask[]> {
  const { data, error } = await getSupabase()
    .from('tarefas_tasks')
    .select('*')
    .eq('board_id', boardId)
    .order('posicao', { ascending: true })
  if (error) { console.error('[v0] tarefas getTasks:', error); return [] }
  return (data || []).map(row => ({
    ...row,
    checklist: Array.isArray(row.checklist) ? row.checklist : [],
  }))
}

export async function createTask(task: Omit<TarefasTask, 'id' | 'criado_em' | 'atualizado_em'>): Promise<TarefasTask | null> {
  // Note: two-step max(posicao)+1 pattern has a race condition under concurrent inserts.
  // posicao collisions cause silent ordering issues (no error). Drag-and-drop bulk-updates
  // in the DnD layer are the authoritative source of order and will overwrite this value.
  const { data: existing } = await getSupabase()
    .from('tarefas_tasks')
    .select('posicao')
    .eq('column_id', task.column_id)
    .order('posicao', { ascending: false })
    .limit(1)
  const nextPos = existing && existing.length > 0 ? existing[0].posicao + 1 : 0

  const { data, error } = await getSupabase()
    .from('tarefas_tasks')
    .insert({ ...task, posicao: nextPos })
    .select()
    .single()
  if (error) { console.error('[v0] tarefas createTask:', error); return null }
  return { ...data, checklist: Array.isArray(data.checklist) ? data.checklist : [] }
}

export async function updateTask(id: string, updates: Partial<Omit<TarefasTask, 'id' | 'criado_em' | 'atualizado_em'>>): Promise<TarefasTask | null> {
  const { data, error } = await getSupabase()
    .from('tarefas_tasks')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) { console.error('[v0] tarefas updateTask:', error); return null }
  return { ...data, checklist: Array.isArray(data.checklist) ? data.checklist : [] }
}

export async function moveTask(id: string, newColumnId: string, newBoardId: string): Promise<boolean> {
  // Same race condition as createTask — see comment there. DnD bulk-update is authoritative.
  const { data: existing } = await getSupabase()
    .from('tarefas_tasks')
    .select('posicao')
    .eq('column_id', newColumnId)
    .order('posicao', { ascending: false })
    .limit(1)
  const nextPos = existing && existing.length > 0 ? existing[0].posicao + 1 : 0

  const { error } = await getSupabase()
    .from('tarefas_tasks')
    .update({ column_id: newColumnId, board_id: newBoardId, posicao: nextPos })
    .eq('id', id)
  if (error) { console.error('[v0] tarefas moveTask:', error); return false }
  return true
}

export async function deleteTask(id: string): Promise<boolean> {
  const { error } = await getSupabase()
    .from('tarefas_tasks')
    .delete()
    .eq('id', id)
  if (error) { console.error('[v0] tarefas deleteTask:', error); return false }
  return true
}

// ─── Attachments ──────────────────────────────────────────────────────────────

export interface TarefasAnexo {
  id: string
  task_id: string
  file_name: string
  file_url: string
  file_type: string
  file_size: number
  uploaded_by: string
  criado_em: string
}

export async function getTaskAttachments(taskId: string): Promise<TarefasAnexo[]> {
  const { data, error } = await getSupabase()
    .from('tarefas_anexos')
    .select('*')
    .eq('task_id', taskId)
    .order('criado_em', { ascending: true })
  if (error) { console.error('[v0] tarefas getTaskAttachments:', error); return [] }
  return data || []
}

export async function createTaskAttachment(a: Omit<TarefasAnexo, 'id' | 'criado_em'>): Promise<TarefasAnexo | null> {
  const { data, error } = await getSupabase()
    .from('tarefas_anexos')
    .insert(a)
    .select()
    .single()
  if (error) { console.error('[v0] tarefas createTaskAttachment:', error); return null }
  return data
}

export async function deleteTaskAttachment(id: string): Promise<boolean> {
  const { error } = await getSupabase()
    .from('tarefas_anexos')
    .delete()
    .eq('id', id)
  if (error) { console.error('[v0] tarefas deleteTaskAttachment:', error); return false }
  return true
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function getTeamUsers(): Promise<TarefasUser[]> {
  const { data, error } = await getSupabase()
    .from('users')
    .select('id, full_name, email')
    .eq('is_active', true)
    .order('full_name', { ascending: true })
  if (error) { console.error('[v0] tarefas getTeamUsers:', error); return [] }
  return data || []
}
