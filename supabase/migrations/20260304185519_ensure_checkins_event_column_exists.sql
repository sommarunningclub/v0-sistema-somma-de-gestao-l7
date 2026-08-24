
-- Adicionar coluna event à tabela checkins se não existir
ALTER TABLE checkins
  ADD COLUMN IF NOT EXISTS event VARCHAR(255);

-- Adicionar outras colunas que podem estar faltando
ALTER TABLE checkins
  ADD COLUMN IF NOT EXISTS sexo VARCHAR(20),
  ADD COLUMN IF NOT EXISTS pelotao VARCHAR(50);

-- Criar índice se não existir
CREATE INDEX IF NOT EXISTS idx_checkins_event ON checkins(event);
;
