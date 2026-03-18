# Tarefas Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Trello-style Kanban task management module ("Tarefas") integrated into the SOMMA admin SPA with full mobile support.

**Architecture:** Follow the exact CRM module pattern — service layer (`lib/services/tarefas.ts`) calls Supabase via service role key, API routes under `app/api/tarefas/` delegate to service functions, and the page component (`app/tarefas/page.tsx`) is a `'use client'` SPA module imported into `app/page.tsx`. Drag-and-drop uses `@dnd-kit` for mobile touch support.

**Tech Stack:** Next.js 15 App Router, TypeScript, Supabase (PostgreSQL), Tailwind CSS dark theme, @dnd-kit/core + @dnd-kit/sortable, shadcn/ui components, Lucide icons.

**IMPORTANT:** Do NOT commit or push to production. All work stays local for review first.

---

## SQL Tables (Run in Supabase SQL Editor BEFORE starting implementation)

The user must run the following SQL in the Supabase Dashboard → SQL Editor before the code is implemented. The file will also be saved to `sql/003-create-tarefas-tables.sql`.

```sql
-- ============================================================
-- Migration: Create Tarefas module tables
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Boards (admin-created)
CREATE TABLE IF NOT EXISTS tarefas_boards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  criado_por UUID,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Columns (dynamic, any member can create/rename/delete)
CREATE TABLE IF NOT EXISTS tarefas_columns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES tarefas_boards(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cor TEXT DEFAULT '#6b7280',
  posicao INT NOT NULL DEFAULT 0,
  criado_por UUID,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tarefas_columns_board ON tarefas_columns(board_id);

-- 3. Tasks (cards)
CREATE TABLE IF NOT EXISTS tarefas_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  column_id UUID NOT NULL REFERENCES tarefas_columns(id),
  board_id UUID NOT NULL REFERENCES tarefas_boards(id),
  titulo TEXT NOT NULL,
  descricao TEXT,
  prioridade TEXT DEFAULT 'media'
    CHECK (prioridade IN ('baixa', 'media', 'alta', 'urgente')),
  responsavel_id UUID,
  responsavel_nome TEXT,
  data_entrega DATE,
  posicao INT NOT NULL DEFAULT 0,
  concluida BOOLEAN DEFAULT false,
  checklist JSONB DEFAULT '[]'::jsonb,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tarefas_tasks_column ON tarefas_tasks(column_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_tasks_board ON tarefas_tasks(board_id);

-- Auto-update atualizado_em
CREATE OR REPLACE FUNCTION update_tarefas_tasks_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_tarefas_tasks_atualizado_em ON tarefas_tasks;
CREATE TRIGGER set_tarefas_tasks_atualizado_em
  BEFORE UPDATE ON tarefas_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_tarefas_tasks_atualizado_em();

-- 4. RLS Policies (service_role bypasses RLS — these protect direct client access)
ALTER TABLE tarefas_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarefas_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE tarefas_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages tarefas_boards" ON tarefas_boards
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages tarefas_columns" ON tarefas_columns
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role manages tarefas_tasks" ON tarefas_tasks
  FOR ALL USING (auth.role() = 'service_role');
```

---

## File Map

**New files to create:**
- `sql/003-create-tarefas-tables.sql` — SQL migration (shown above)
- `lib/tarefas-constants.ts` — Priority type + color definitions
- `lib/services/tarefas.ts` — All Supabase CRUD functions
- `app/api/tarefas/boards/route.ts` — GET all boards, POST create
- `app/api/tarefas/boards/[id]/route.ts` — PATCH, DELETE board
- `app/api/tarefas/columns/route.ts` — GET by board_id, POST create
- `app/api/tarefas/columns/[id]/route.ts` — PATCH rename/reorder, DELETE (blocked if has tasks)
- `app/api/tarefas/tasks/route.ts` — GET by board_id, POST create
- `app/api/tarefas/tasks/[id]/route.ts` — PATCH update/move, DELETE
- `app/api/tarefas/users/route.ts` — GET team member list for assignee dropdown
- `components/tarefas-card.tsx` — Single card with checklist progress, overdue badge
- `components/tarefas-column.tsx` — Droppable column with inline rename
- `components/tarefas-kanban-board.tsx` — DnD context wrapper (desktop)
- `components/tarefas-task-modal.tsx` — Create/edit task modal (all fields + checklist editor)
- `components/tarefas-board-modal.tsx` — Create/edit/delete board modal
- `app/tarefas/page.tsx` — Main page component ('use client' SPA module)

**Files to modify:**
- `app/page.tsx` — Add import, navigation entry, apps modal entry, content render

---

## Task 1: SQL Migration File

**Files:**
- Create: `sql/003-create-tarefas-tables.sql`

- [ ] **Step 1: Create the SQL file**

Copy the SQL from the "SQL Tables" section above into the file.

```bash
# File path
sql/003-create-tarefas-tables.sql
```

- [ ] **Step 2: Run in Supabase Dashboard**

Go to your Supabase project → SQL Editor → paste the entire SQL and click Run.
Verify: 3 tables appear in Table Editor (`tarefas_boards`, `tarefas_columns`, `tarefas_tasks`).

- [ ] **Step 3: Commit**

```bash
git add sql/003-create-tarefas-tables.sql
git commit -m "sql: add tarefas module tables (boards, columns, tasks)"
```

---

## Task 2: Constants

**Files:**
- Create: `lib/tarefas-constants.ts`

- [ ] **Step 1: Create constants file**

```typescript
// lib/tarefas-constants.ts

export type TarefaPrioridade = 'baixa' | 'media' | 'alta' | 'urgente'

export const TAREFAS_PRIORIDADES: {
  id: TarefaPrioridade
  label: string
  badgeBg: string
  badgeText: string
}[] = [
  { id: 'baixa',   label: 'Baixa',   badgeBg: 'bg-blue-900/60',   badgeText: 'text-blue-300' },
  { id: 'media',   label: 'Média',   badgeBg: 'bg-purple-900/60', badgeText: 'text-purple-300' },
  { id: 'alta',    label: 'Alta',    badgeBg: 'bg-orange-900/60', badgeText: 'text-orange-300' },
  { id: 'urgente', label: 'Urgente', badgeBg: 'bg-red-900/60',    badgeText: 'text-red-300' },
]

export const COLUMN_COLORS = [
  { label: 'Cinza',    value: '#6b7280' },
  { label: 'Azul',     value: '#3b82f6' },
  { label: 'Verde',    value: '#22c55e' },
  { label: 'Amarelo',  value: '#f59e0b' },
  { label: 'Laranja',  value: '#f97316' },
  { label: 'Vermelho', value: '#ef4444' },
  { label: 'Roxo',     value: '#8b5cf6' },
]
```

- [ ] **Step 2: Commit**

```bash
git add lib/tarefas-constants.ts
git commit -m "feat(tarefas): add constants (priorities, column colors)"
```

---

## Task 3: Service Layer

**Files:**
- Create: `lib/services/tarefas.ts`

- [ ] **Step 1: Create service file**

```typescript
// lib/services/tarefas.ts
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
  // Get next posicao in column
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

export async function updateTask(id: string, updates: Partial<TarefasTask>): Promise<TarefasTask | null> {
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
  // Get next posicao in target column
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
```

- [ ] **Step 2: Commit**

```bash
git add lib/services/tarefas.ts
git commit -m "feat(tarefas): add service layer (boards, columns, tasks, users CRUD)"
```

---

## Task 4: API Routes — Boards

**Files:**
- Create: `app/api/tarefas/boards/route.ts`
- Create: `app/api/tarefas/boards/[id]/route.ts`

- [ ] **Step 1: Create `app/api/tarefas/boards/route.ts`**

```typescript
// app/api/tarefas/boards/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getBoards, createBoard } from '@/lib/services/tarefas'

export async function GET() {
  const boards = await getBoards()
  return NextResponse.json(boards)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { nome, descricao, criado_por } = body
    if (!nome) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

    const board = await createBoard({ nome, descricao: descricao || null, criado_por: criado_por || null })
    if (!board) return NextResponse.json({ error: 'Erro ao criar quadro' }, { status: 500 })

    return NextResponse.json(board, { status: 201 })
  } catch (err) {
    console.error('[v0] boards POST:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create `app/api/tarefas/boards/[id]/route.ts`**

```typescript
// app/api/tarefas/boards/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { updateBoard, deleteBoard } from '@/lib/services/tarefas'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const board = await updateBoard(id, { nome: body.nome, descricao: body.descricao })
    if (!board) return NextResponse.json({ error: 'Erro ao atualizar quadro' }, { status: 500 })
    return NextResponse.json(board)
  } catch (err) {
    console.error('[v0] boards PATCH:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const success = await deleteBoard(id)
  if (!success) return NextResponse.json({ error: 'Erro ao deletar quadro' }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/tarefas/boards/route.ts app/api/tarefas/boards/[id]/route.ts
git commit -m "feat(tarefas): add boards API routes (GET, POST, PATCH, DELETE)"
```

---

## Task 5: API Routes — Columns

**Files:**
- Create: `app/api/tarefas/columns/route.ts`
- Create: `app/api/tarefas/columns/[id]/route.ts`

- [ ] **Step 1: Create `app/api/tarefas/columns/route.ts`**

```typescript
// app/api/tarefas/columns/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getColumns, createColumn } from '@/lib/services/tarefas'

export async function GET(req: NextRequest) {
  const boardId = req.nextUrl.searchParams.get('board_id')
  if (!boardId) return NextResponse.json({ error: 'board_id obrigatório' }, { status: 400 })
  const columns = await getColumns(boardId)
  return NextResponse.json(columns)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { board_id, nome, cor, posicao, criado_por } = body
    if (!board_id || !nome) return NextResponse.json({ error: 'board_id e nome são obrigatórios' }, { status: 400 })

    const col = await createColumn({
      board_id,
      nome,
      cor: cor || '#6b7280',
      posicao: posicao ?? 0,
      criado_por: criado_por || null,
    })
    if (!col) return NextResponse.json({ error: 'Erro ao criar coluna' }, { status: 500 })

    return NextResponse.json(col, { status: 201 })
  } catch (err) {
    console.error('[v0] columns POST:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create `app/api/tarefas/columns/[id]/route.ts`**

```typescript
// app/api/tarefas/columns/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { updateColumn, deleteColumn, countTasksInColumn } from '@/lib/services/tarefas'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const col = await updateColumn(id, {
      ...(body.nome !== undefined && { nome: body.nome }),
      ...(body.cor !== undefined && { cor: body.cor }),
      ...(body.posicao !== undefined && { posicao: body.posicao }),
    })
    if (!col) return NextResponse.json({ error: 'Erro ao atualizar coluna' }, { status: 500 })
    return NextResponse.json(col)
  } catch (err) {
    console.error('[v0] columns PATCH:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Block deletion if column has tasks
  const count = await countTasksInColumn(id)
  if (count > 0) {
    return NextResponse.json(
      { error: `Mova ou exclua as ${count} tarefa(s) antes de remover a coluna.`, taskCount: count },
      { status: 409 }
    )
  }

  const success = await deleteColumn(id)
  if (!success) return NextResponse.json({ error: 'Erro ao deletar coluna' }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/tarefas/columns/route.ts app/api/tarefas/columns/[id]/route.ts
git commit -m "feat(tarefas): add columns API routes with task-count guard on DELETE"
```

---

## Task 6: API Routes — Tasks + Users

**Files:**
- Create: `app/api/tarefas/tasks/route.ts`
- Create: `app/api/tarefas/tasks/[id]/route.ts`
- Create: `app/api/tarefas/users/route.ts`

- [ ] **Step 1: Create `app/api/tarefas/tasks/route.ts`**

```typescript
// app/api/tarefas/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getTasks, createTask } from '@/lib/services/tarefas'
import { TAREFAS_PRIORIDADES } from '@/lib/tarefas-constants'

const VALID_PRIORIDADES = TAREFAS_PRIORIDADES.map(p => p.id)

export async function GET(req: NextRequest) {
  const boardId = req.nextUrl.searchParams.get('board_id')
  if (!boardId) return NextResponse.json({ error: 'board_id obrigatório' }, { status: 400 })
  const tasks = await getTasks(boardId)
  return NextResponse.json(tasks)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { column_id, board_id, titulo, descricao, prioridade, responsavel_id, responsavel_nome, data_entrega, checklist } = body

    if (!column_id || !board_id || !titulo) {
      return NextResponse.json({ error: 'column_id, board_id e titulo são obrigatórios' }, { status: 400 })
    }

    const task = await createTask({
      column_id,
      board_id,
      titulo,
      descricao: descricao || null,
      prioridade: VALID_PRIORIDADES.includes(prioridade) ? prioridade : 'media',
      responsavel_id: responsavel_id || null,
      responsavel_nome: responsavel_nome || null,
      data_entrega: data_entrega || null,
      posicao: 0,
      concluida: false,
      checklist: Array.isArray(checklist) ? checklist : [],
    })

    if (!task) return NextResponse.json({ error: 'Erro ao criar tarefa' }, { status: 500 })
    return NextResponse.json(task, { status: 201 })
  } catch (err) {
    console.error('[v0] tasks POST:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create `app/api/tarefas/tasks/[id]/route.ts`**

```typescript
// app/api/tarefas/tasks/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { updateTask, moveTask, deleteTask } from '@/lib/services/tarefas'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()

    // Move-only shortcut (column change)
    if (body.column_id && Object.keys(body).length <= 2) {
      const success = await moveTask(id, body.column_id, body.board_id)
      if (!success) return NextResponse.json({ error: 'Erro ao mover tarefa' }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    const task = await updateTask(id, body)
    if (!task) return NextResponse.json({ error: 'Erro ao atualizar tarefa' }, { status: 500 })
    return NextResponse.json(task)
  } catch (err) {
    console.error('[v0] tasks PATCH:', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const success = await deleteTask(id)
  if (!success) return NextResponse.json({ error: 'Erro ao deletar tarefa' }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Create `app/api/tarefas/users/route.ts`**

```typescript
// app/api/tarefas/users/route.ts
import { NextResponse } from 'next/server'
import { getTeamUsers } from '@/lib/services/tarefas'

export async function GET() {
  const users = await getTeamUsers()
  return NextResponse.json(users)
}
```

- [ ] **Step 4: Commit**

```bash
git add app/api/tarefas/tasks/route.ts app/api/tarefas/tasks/[id]/route.ts app/api/tarefas/users/route.ts
git commit -m "feat(tarefas): add tasks and users API routes"
```

---

## Task 7: Install @dnd-kit

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Install packages**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Verify install**

```bash
node -e "require('@dnd-kit/core'); console.log('OK')"
```

Expected output: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat(tarefas): install @dnd-kit for drag-and-drop"
```

---

## Task 8: TarefasCard Component

**Files:**
- Create: `components/tarefas-card.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/tarefas-card.tsx
'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Calendar, AlertTriangle } from 'lucide-react'
import { TAREFAS_PRIORIDADES } from '@/lib/tarefas-constants'
import type { TarefasTask } from '@/lib/services/tarefas'

interface TarefasCardProps {
  task: TarefasTask
  onClick: (task: TarefasTask) => void
  isDragOverlay?: boolean
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false
  return new Date(dateStr + 'T23:59:59') < new Date()
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}`
}

export function TarefasCard({ task, onClick, isDragOverlay = false }: TarefasCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const prioridade = TAREFAS_PRIORIDADES.find(p => p.id === task.prioridade)
  const done = task.checklist.filter(i => i.concluido).length
  const total = task.checklist.length
  const progress = total > 0 ? Math.round((done / total) * 100) : 0
  const overdue = isOverdue(task.data_entrega) && !task.concluida

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group bg-neutral-800/80 border rounded-lg mb-2 cursor-pointer select-none transition-colors
        ${isDragOverlay ? 'border-orange-500/60 shadow-lg shadow-orange-500/10 rotate-2' : 'border-neutral-700/60 hover:border-neutral-600'}
        ${task.concluida ? 'opacity-60' : ''}
      `}
      onClick={() => onClick(task)}
    >
      <div className="p-3">
        {/* Top row: priority + drag handle */}
        <div className="flex items-center justify-between mb-2">
          {prioridade && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${prioridade.badgeBg} ${prioridade.badgeText}`}>
              {prioridade.label.toUpperCase()}
            </span>
          )}
          <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 -mr-1 text-neutral-600 hover:text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={e => e.stopPropagation()}
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>
        </div>

        {/* Title */}
        <p className={`text-sm font-semibold leading-snug mb-2 ${task.concluida ? 'line-through text-neutral-500' : 'text-white'}`}>
          {task.titulo}
        </p>

        {/* Checklist progress */}
        {total > 0 && (
          <div className="mb-2">
            <div className="flex justify-between mb-1">
              <span className="text-neutral-500 text-[10px]">{done}/{total} itens</span>
              <span className="text-[10px] font-semibold text-orange-400">{progress}%</span>
            </div>
            <div className="h-1 bg-neutral-700 rounded-full">
              <div
                className="h-1 bg-orange-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Footer: assignee + due date */}
        <div className="flex items-center justify-between mt-1">
          {task.responsavel_nome ? (
            <div className="w-6 h-6 rounded-full bg-neutral-700 flex items-center justify-center text-[9px] font-bold text-neutral-300 flex-shrink-0">
              {getInitials(task.responsavel_nome)}
            </div>
          ) : <div />}

          <div className="flex items-center gap-1">
            {overdue && <AlertTriangle className="w-3 h-3 text-red-400" />}
            {task.data_entrega && (
              <span className={`text-[10px] flex items-center gap-0.5 ${overdue ? 'text-red-400 font-semibold' : 'text-neutral-500'}`}>
                <Calendar className="w-2.5 h-2.5" />
                {formatDate(task.data_entrega)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/tarefas-card.tsx
git commit -m "feat(tarefas): add TarefasCard component with checklist progress and overdue badge"
```

---

## Task 9: TarefasColumn Component

**Files:**
- Create: `components/tarefas-column.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/tarefas-column.tsx
'use client'

import { useState, useRef } from 'react'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Plus, GripVertical, Pencil, Check, X, Trash2 } from 'lucide-react'
import { TarefasCard } from '@/components/tarefas-card'
import { COLUMN_COLORS } from '@/lib/tarefas-constants'
import type { TarefasColumn as TarefasColumnType, TarefasTask } from '@/lib/services/tarefas'

interface TarefasColumnProps {
  column: TarefasColumnType
  tasks: TarefasTask[]
  onCardClick: (task: TarefasTask) => void
  onAddTask: (columnId: string) => void
  onRenameColumn: (id: string, nome: string, cor: string) => void
  onDeleteColumn: (column: TarefasColumnType) => void
}

export function TarefasColumn({
  column, tasks, onCardClick, onAddTask, onRenameColumn, onDeleteColumn
}: TarefasColumnProps) {
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(column.nome)
  const [editColor, setEditColor] = useState(column.cor)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: `col-${column.id}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const handleStartEdit = () => {
    setEditName(column.nome)
    setEditColor(column.cor)
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const handleSaveEdit = () => {
    if (editName.trim()) {
      onRenameColumn(column.id, editName.trim(), editColor)
    }
    setEditing(false)
  }

  const taskIds = tasks.map(t => t.id)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex-shrink-0 w-64 flex flex-col bg-neutral-900 border border-neutral-800 rounded-xl"
    >
      {/* Column header */}
      <div className="px-3 py-2.5 flex items-center gap-2 border-b border-neutral-800">
        {/* Drag handle for column */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-neutral-600 hover:text-neutral-400 flex-shrink-0"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: column.cor }}
        />

        {editing ? (
          <div className="flex-1 flex flex-col gap-1">
            <input
              ref={inputRef}
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(); if (e.key === 'Escape') setEditing(false) }}
              className="flex-1 bg-neutral-800 text-white text-xs font-semibold rounded px-2 py-1 border border-neutral-600 outline-none w-full"
            />
            <div className="flex gap-1">
              {COLUMN_COLORS.map(c => (
                <button
                  key={c.value}
                  onClick={() => setEditColor(c.value)}
                  className={`w-4 h-4 rounded-full border-2 transition-all ${editColor === c.value ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
            <div className="flex gap-1 mt-0.5">
              <button onClick={handleSaveEdit} className="p-1 text-green-400 hover:text-green-300"><Check className="w-3 h-3" /></button>
              <button onClick={() => setEditing(false)} className="p-1 text-neutral-500 hover:text-neutral-300"><X className="w-3 h-3" /></button>
            </div>
          </div>
        ) : (
          <>
            <span className="flex-1 text-xs font-bold text-neutral-300 uppercase tracking-wide truncate">
              {column.nome}
            </span>
            <span className="text-[10px] text-neutral-600 font-mono">{tasks.length}</span>
            <button onClick={handleStartEdit} className="p-1 text-neutral-600 hover:text-neutral-400 flex-shrink-0">
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={() => onDeleteColumn(column)}
              className="p-1 text-neutral-600 hover:text-red-400 flex-shrink-0"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 overflow-y-auto min-h-[60px]">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <TarefasCard key={task.id} task={task} onClick={onCardClick} />
          ))}
        </SortableContext>
      </div>

      {/* Add card button */}
      <button
        onClick={() => onAddTask(column.id)}
        className="mx-2 mb-2 flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 transition-colors text-xs"
      >
        <Plus className="w-3.5 h-3.5" />
        Adicionar tarefa
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/tarefas-column.tsx
git commit -m "feat(tarefas): add TarefasColumn with inline rename, color picker, delete"
```

---

## Task 10: TarefasKanbanBoard Component

**Files:**
- Create: `components/tarefas-kanban-board.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/tarefas-kanban-board.tsx
'use client'

import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { Plus } from 'lucide-react'
import { TarefasColumn } from '@/components/tarefas-column'
import { TarefasCard } from '@/components/tarefas-card'
import type { TarefasBoard, TarefasColumn as TarefasColumnType, TarefasTask } from '@/lib/services/tarefas'

interface TarefasKanbanBoardProps {
  board: TarefasBoard
  columns: TarefasColumnType[]
  tasks: TarefasTask[]
  onCardClick: (task: TarefasTask) => void
  onAddTask: (columnId: string) => void
  onMoveTask: (taskId: string, newColumnId: string) => void
  onMoveColumn: (columnId: string, newPosicao: number) => void
  onRenameColumn: (id: string, nome: string, cor: string) => void
  onDeleteColumn: (column: TarefasColumnType) => void
  onAddColumn: () => void
}

export function TarefasKanbanBoard({
  columns, tasks, onCardClick, onAddTask, onMoveTask,
  onMoveColumn, onRenameColumn, onDeleteColumn, onAddColumn,
}: TarefasKanbanBoardProps) {
  const [activeTask, setActiveTask] = useState<TarefasTask | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  )

  const columnIds = columns.map(c => `col-${c.id}`)

  function getTasksForColumn(columnId: string) {
    return tasks
      .filter(t => t.column_id === columnId)
      .sort((a, b) => a.posicao - b.posicao)
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id)
    // Only track task drags (not columns)
    if (!id.startsWith('col-')) {
      const task = tasks.find(t => t.id === id)
      if (task) setActiveTask(task)
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTask(null)
    if (!over) return

    const activeId = String(active.id)
    const overId = String(over.id)

    // Task moved to a different column
    if (!activeId.startsWith('col-') && !overId.startsWith('col-')) {
      const task = tasks.find(t => t.id === activeId)
      const overTask = tasks.find(t => t.id === overId)
      if (task && overTask && task.column_id !== overTask.column_id) {
        onMoveTask(activeId, overTask.column_id)
      }
    }

    // Task dropped onto column header area
    if (!activeId.startsWith('col-') && overId.startsWith('col-')) {
      const task = tasks.find(t => t.id === activeId)
      const targetColumnId = overId.replace('col-', '')
      if (task && task.column_id !== targetColumnId) {
        onMoveTask(activeId, targetColumnId)
      }
    }

    // Column reordered
    if (activeId.startsWith('col-') && overId.startsWith('col-')) {
      const fromIndex = columns.findIndex(c => `col-${c.id}` === activeId)
      const toIndex = columns.findIndex(c => `col-${c.id}` === overId)
      if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
        onMoveColumn(activeId.replace('col-', ''), toIndex)
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 h-full items-start pt-1 px-1">
        <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
          {columns.map(column => (
            <TarefasColumn
              key={column.id}
              column={column}
              tasks={getTasksForColumn(column.id)}
              onCardClick={onCardClick}
              onAddTask={onAddTask}
              onRenameColumn={onRenameColumn}
              onDeleteColumn={onDeleteColumn}
            />
          ))}
        </SortableContext>

        {/* Add column */}
        <button
          onClick={onAddColumn}
          className="flex-shrink-0 w-48 h-16 border-2 border-dashed border-neutral-700 rounded-xl flex items-center justify-center gap-2 text-neutral-500 hover:text-neutral-300 hover:border-neutral-500 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="text-xs font-medium">Nova Coluna</span>
        </button>
      </div>

      {/* Drag overlay (ghost card while dragging) */}
      <DragOverlay>
        {activeTask && (
          <TarefasCard task={activeTask} onClick={() => {}} isDragOverlay />
        )}
      </DragOverlay>
    </DndContext>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/tarefas-kanban-board.tsx
git commit -m "feat(tarefas): add TarefasKanbanBoard with @dnd-kit drag-and-drop"
```

---

## Task 11: TarefasTaskModal Component

**Files:**
- Create: `components/tarefas-task-modal.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/tarefas-task-modal.tsx
'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Trash2, Check } from 'lucide-react'
import { TAREFAS_PRIORIDADES } from '@/lib/tarefas-constants'
import type { TarefasTask, TarefasColumn, TarefasUser, ChecklistItem } from '@/lib/services/tarefas'

interface TarefasTaskModalProps {
  task: Partial<TarefasTask> | null
  isNew: boolean
  columns: TarefasColumn[]
  users: TarefasUser[]
  defaultColumnId?: string
  onClose: () => void
  onSave: (task: Partial<TarefasTask>) => void
  onDelete?: (id: string) => void
}

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

export function TarefasTaskModal({
  task, isNew, columns, users, defaultColumnId, onClose, onSave, onDelete
}: TarefasTaskModalProps) {
  const [titulo, setTitulo] = useState(task?.titulo || '')
  const [descricao, setDescricao] = useState(task?.descricao || '')
  const [prioridade, setPrioridade] = useState(task?.prioridade || 'media')
  const [responsavelId, setResponsavelId] = useState(task?.responsavel_id || '')
  const [dataEntrega, setDataEntrega] = useState(task?.data_entrega || '')
  const [columnId, setColumnId] = useState(task?.column_id || defaultColumnId || '')
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task?.checklist || [])
  const [newItem, setNewItem] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const selectedUser = users.find(u => u.id === responsavelId)

  const handleAddChecklistItem = () => {
    if (!newItem.trim()) return
    setChecklist(prev => [...prev, { id: generateId(), texto: newItem.trim(), concluido: false }])
    setNewItem('')
  }

  const handleToggleItem = (id: string) => {
    setChecklist(prev => prev.map(i => i.id === id ? { ...i, concluido: !i.concluido } : i))
  }

  const handleRemoveItem = (id: string) => {
    setChecklist(prev => prev.filter(i => i.id !== id))
  }

  const handleSave = async () => {
    if (!titulo.trim() || !columnId) return
    setSaving(true)
    const col = columns.find(c => c.id === columnId)
    await onSave({
      ...(task?.id && { id: task.id }),
      titulo: titulo.trim(),
      descricao: descricao.trim() || null,
      prioridade: prioridade as TarefasTask['prioridade'],
      responsavel_id: responsavelId || null,
      responsavel_nome: selectedUser?.full_name || null,
      data_entrega: dataEntrega || null,
      column_id: columnId,
      board_id: task?.board_id || col?.board_id,
      checklist,
    })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-lg max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <h2 className="text-white font-bold text-sm">
            {isNew ? 'Nova Tarefa' : 'Editar Tarefa'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-neutral-500 hover:text-white rounded-lg hover:bg-neutral-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Título */}
          <div>
            <label className="text-neutral-400 text-xs mb-1 block">Título *</label>
            <input
              value={titulo}
              onChange={e => setTitulo(e.target.value)}
              placeholder="Nome da tarefa"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
              style={{ fontSize: '16px' }}
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="text-neutral-400 text-xs mb-1 block">Descrição</label>
            <textarea
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Detalhes opcionais..."
              rows={3}
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-orange-500"
              style={{ fontSize: '16px' }}
            />
          </div>

          {/* Prioridade + Coluna */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-neutral-400 text-xs mb-1 block">Prioridade</label>
              <select
                value={prioridade}
                onChange={e => setPrioridade(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                style={{ fontSize: '16px' }}
              >
                {TAREFAS_PRIORIDADES.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-neutral-400 text-xs mb-1 block">Coluna</label>
              <select
                value={columnId}
                onChange={e => setColumnId(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                style={{ fontSize: '16px' }}
              >
                <option value="">Selecionar...</option>
                {columns.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Responsável + Data */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-neutral-400 text-xs mb-1 block">Responsável</label>
              <select
                value={responsavelId}
                onChange={e => setResponsavelId(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                style={{ fontSize: '16px' }}
              >
                <option value="">Nenhum</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.full_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-neutral-400 text-xs mb-1 block">Data de entrega</label>
              <input
                type="date"
                value={dataEntrega}
                onChange={e => setDataEntrega(e.target.value)}
                className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
                style={{ fontSize: '16px' }}
              />
            </div>
          </div>

          {/* Checklist */}
          <div>
            <label className="text-neutral-400 text-xs mb-2 block">
              Checklist {checklist.length > 0 && `(${checklist.filter(i=>i.concluido).length}/${checklist.length})`}
            </label>
            <div className="space-y-1.5 mb-2">
              {checklist.map(item => (
                <div key={item.id} className="flex items-center gap-2 group/item">
                  <button
                    onClick={() => handleToggleItem(item.id)}
                    className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${item.concluido ? 'bg-orange-500 border-orange-500' : 'border-neutral-600 bg-neutral-800'}`}
                  >
                    {item.concluido && <Check className="w-2.5 h-2.5 text-black" />}
                  </button>
                  <span className={`flex-1 text-sm ${item.concluido ? 'line-through text-neutral-500' : 'text-neutral-300'}`}>
                    {item.texto}
                  </span>
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    className="opacity-0 group-hover/item:opacity-100 p-0.5 text-neutral-600 hover:text-red-400 transition-opacity"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newItem}
                onChange={e => setNewItem(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddChecklistItem() } }}
                placeholder="Adicionar item..."
                className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-orange-500"
                style={{ fontSize: '16px' }}
              />
              <button
                onClick={handleAddChecklistItem}
                className="p-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-400 hover:text-white hover:border-orange-500"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-neutral-800 flex items-center justify-between gap-3">
          {!isNew && onDelete && (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-red-400 text-xs">Confirmar?</span>
                <button onClick={() => { onDelete(task!.id!); onClose() }} className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded">Sim</button>
                <button onClick={() => setConfirmDelete(false)} className="text-xs text-neutral-500 px-2 py-1 rounded hover:text-white">Não</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-xs text-neutral-500 hover:text-red-400 flex items-center gap-1 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />Excluir
              </button>
            )
          )}
          {isNew && <div />}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} className="px-4 py-2 text-xs text-neutral-400 hover:text-white bg-neutral-800 border border-neutral-700 rounded-lg">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!titulo.trim() || !columnId || saving}
              className="px-4 py-2 text-xs font-bold bg-orange-500 text-black rounded-lg hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Salvando...' : isNew ? 'Criar' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/tarefas-task-modal.tsx
git commit -m "feat(tarefas): add TarefasTaskModal with checklist editor and delete confirmation"
```

---

## Task 12: TarefasBoardModal Component

**Files:**
- Create: `components/tarefas-board-modal.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/tarefas-board-modal.tsx
'use client'

import { useState } from 'react'
import { X, Trash2 } from 'lucide-react'
import type { TarefasBoard } from '@/lib/services/tarefas'

interface TarefasBoardModalProps {
  board: Partial<TarefasBoard> | null
  isNew: boolean
  onClose: () => void
  onSave: (board: Partial<TarefasBoard>) => void
  onDelete?: (id: string) => void
}

export function TarefasBoardModal({ board, isNew, onClose, onSave, onDelete }: TarefasBoardModalProps) {
  const [nome, setNome] = useState(board?.nome || '')
  const [descricao, setDescricao] = useState(board?.descricao || '')
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const handleSave = async () => {
    if (!nome.trim()) return
    setSaving(true)
    await onSave({ ...(board?.id && { id: board.id }), nome: nome.trim(), descricao: descricao.trim() || null })
    setSaving(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-neutral-900 border border-neutral-800 rounded-xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <h2 className="text-white font-bold text-sm">{isNew ? 'Novo Quadro' : 'Editar Quadro'}</h2>
          <button onClick={onClose} className="p-1.5 text-neutral-500 hover:text-white rounded-lg hover:bg-neutral-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-neutral-400 text-xs mb-1 block">Nome *</label>
            <input
              value={nome}
              onChange={e => setNome(e.target.value)}
              placeholder="Ex: Operações Somma Club"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
              style={{ fontSize: '16px' }}
              autoFocus
            />
          </div>
          <div>
            <label className="text-neutral-400 text-xs mb-1 block">Descrição</label>
            <input
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Opcional..."
              className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500"
              style={{ fontSize: '16px' }}
            />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-neutral-800 flex items-center justify-between gap-3">
          {!isNew && onDelete && (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-red-400 text-xs">Confirmar?</span>
                <button onClick={() => { onDelete(board!.id!); onClose() }} className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-1 rounded">Sim</button>
                <button onClick={() => setConfirmDelete(false)} className="text-xs text-neutral-500 px-2 py-1 rounded hover:text-white">Não</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="text-xs text-neutral-500 hover:text-red-400 flex items-center gap-1 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />Excluir
              </button>
            )
          )}
          {isNew && <div />}
          <div className="flex gap-2 ml-auto">
            <button onClick={onClose} className="px-4 py-2 text-xs text-neutral-400 hover:text-white bg-neutral-800 border border-neutral-700 rounded-lg">
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!nome.trim() || saving}
              className="px-4 py-2 text-xs font-bold bg-orange-500 text-black rounded-lg hover:bg-orange-400 disabled:opacity-40"
            >
              {saving ? 'Salvando...' : isNew ? 'Criar' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/tarefas-board-modal.tsx
git commit -m "feat(tarefas): add TarefasBoardModal (create/edit/delete board)"
```

---

## Task 13: Main Page Component

**Files:**
- Create: `app/tarefas/page.tsx`

- [ ] **Step 1: Create the main page**

```typescript
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

// (TAREFAS_PRIORIDADES import and TAREFAS_PRIORIDADES_MAP are declared at the top of the file)
```

- [ ] **Step 2: Commit**

```bash
git add app/tarefas/page.tsx
git commit -m "feat(tarefas): add main TarefasPage (SPA module with kanban + mobile list view)"
```

---

## Task 14: Register Module in app/page.tsx

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Add import at the top of the file** (after existing module imports)

```typescript
import TarefasPage from "./tarefas/page"
```

- [ ] **Step 2: Add to navigation array** (inside the `.map()` array at ~line 142, after `{ id: "crm", ... }`)

```typescript
{ id: "tarefas", icon: KanbanSquare, label: "TAREFAS", permissionKey: "tarefas" },
```

Also add `KanbanSquare` to the existing lucide-react import at the top of the file.

- [ ] **Step 3: Add to Apps Modal array** (inside the modal grid `.map()` array, after `{ id: "crm", ... }`)

```typescript
{ id: "tarefas", icon: KanbanSquare, label: "Tarefas", permissionKey: "tarefas" },
```

- [ ] **Step 4: Add to content render area** (after the `crm` line, around line 388)

```typescript
{activeSection === "tarefas" && permissions.tarefas && <TarefasPage />}
```

- [ ] **Step 5: Verify the dev server starts without errors**

```bash
npm run dev
```

Open http://localhost:3000. Navigate to the TAREFAS module in the sidebar.
Expected: Module loads, shows "Nenhum quadro ainda" with a "Criar quadro" button.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx
git commit -m "feat(tarefas): register Tarefas module in main SPA (sidebar, apps modal, content render)"
```

---

## Task 15: End-to-End Smoke Test

**No automated tests exist in this project — verify manually in browser.**

- [ ] **Step 1: Run the SQL migration** (if not done in Task 1)

Go to Supabase Dashboard → SQL Editor → paste and run the SQL from `sql/003-create-tarefas-tables.sql`.

- [ ] **Step 2: Start dev server**

```bash
npm run dev
```

- [ ] **Step 3: Smoke test checklist**

Open http://localhost:3000 and verify:

- [ ] TAREFAS appears in sidebar and Apps Modal
- [ ] Empty state shows "Nenhum quadro ainda" with "Criar quadro" button
- [ ] Create a board → board selector appears in header
- [ ] Add 2 columns to the board → columns appear on desktop Kanban
- [ ] Create a task in each column → cards appear with priority badge
- [ ] Add checklist items to a task → progress bar updates
- [ ] Set a past due date → ⚠ Vencida badge appears in red
- [ ] Drag a card to another column (desktop) → card moves
- [ ] Rename a column → name updates inline
- [ ] Delete an empty column → column removed
- [ ] Delete a non-empty column → error modal with task count
- [ ] Mobile: column tabs show, tapping switches list
- [ ] Mobile: tap card → modal opens with column selector dropdown
- [ ] Edit board name → updates in board selector
- [ ] Delete board → switches to next board

- [ ] **Step 4: Final commit if any minor fixes were made**

```bash
git add -A
git commit -m "fix(tarefas): post-smoke-test fixes"
```

---

## Summary

| Task | What it produces |
|------|-----------------|
| 1 | SQL tables in Supabase |
| 2 | `lib/tarefas-constants.ts` |
| 3 | `lib/services/tarefas.ts` |
| 4 | Boards API routes |
| 5 | Columns API routes (with delete guard) |
| 6 | Tasks + Users API routes |
| 7 | @dnd-kit installed |
| 8 | `TarefasCard` component |
| 9 | `TarefasColumn` component |
| 10 | `TarefasKanbanBoard` component |
| 11 | `TarefasTaskModal` component |
| 12 | `TarefasBoardModal` component |
| 13 | `app/tarefas/page.tsx` (main module) |
| 14 | Registered in `app/page.tsx` |
| 15 | Smoke tested locally |
