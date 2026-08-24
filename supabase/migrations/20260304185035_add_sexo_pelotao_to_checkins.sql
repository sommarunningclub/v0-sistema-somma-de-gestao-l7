
-- Adicionar colunas sexo e pelotao à tabela checkins
ALTER TABLE checkins
  ADD COLUMN IF NOT EXISTS sexo VARCHAR(20),
  ADD COLUMN IF NOT EXISTS pelotao VARCHAR(50);
;
