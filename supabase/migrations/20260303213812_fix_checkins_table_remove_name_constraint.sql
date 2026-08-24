
-- Remove colunas desnecessárias da tabela checkins que causam erro NOT NULL
-- O nome/telefone/email ficam na tabela members
ALTER TABLE checkins
  DROP COLUMN IF EXISTS name,
  DROP COLUMN IF EXISTS email,
  DROP COLUMN IF EXISTS phone;

-- Garantir que event_date e event_time aceitam NULL
ALTER TABLE checkins
  ALTER COLUMN event_date DROP NOT NULL,
  ALTER COLUMN event_time DROP NOT NULL;

-- Adicionar join_date na tabela members se não existir
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS join_date TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Garantir que a tabela members tem os campos corretos sem NOT NULL extras
ALTER TABLE members
  ALTER COLUMN phone DROP NOT NULL,
  ALTER COLUMN email DROP NOT NULL;
;
