-- Migration 004: Tabela de anexos para tarefas
CREATE TABLE IF NOT EXISTS tarefas_anexos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID        NOT NULL REFERENCES tarefas_tasks(id) ON DELETE CASCADE,
  file_name   TEXT        NOT NULL,
  file_url    TEXT        NOT NULL,
  file_type   TEXT        NOT NULL DEFAULT '',
  file_size   INTEGER     NOT NULL DEFAULT 0,
  uploaded_by TEXT        NOT NULL,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS tarefas_anexos_task_id_idx ON tarefas_anexos(task_id);
