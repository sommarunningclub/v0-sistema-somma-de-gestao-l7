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
