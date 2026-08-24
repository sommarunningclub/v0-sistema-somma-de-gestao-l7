
-- Adicionar coluna validated à tabela checkins se não existir
ALTER TABLE checkins
  ADD COLUMN IF NOT EXISTS validated BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP WITH TIME ZONE;
;
