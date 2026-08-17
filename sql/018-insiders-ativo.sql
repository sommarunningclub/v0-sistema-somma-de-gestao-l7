-- sql/018-insiders-ativo.sql
-- Status de cadastro no admin: inativar sem apagar o histórico da escala.
-- Idempotente. A coluna já pode existir em produção.

ALTER TABLE dados_insiders
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;
