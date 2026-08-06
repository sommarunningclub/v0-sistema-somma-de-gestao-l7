-- sql/012-insider-tamanho-camisa.sql
-- Adiciona o tamanho de camiseta ao cadastro de Insiders.
-- Aditiva: não remove nem renomeia nada existente.

BEGIN;

ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS tamanho_camisa text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'dados_insiders_tamanho_camisa_check'
  ) THEN
    ALTER TABLE dados_insiders
      ADD CONSTRAINT dados_insiders_tamanho_camisa_check
      CHECK (tamanho_camisa IS NULL OR tamanho_camisa IN ('PP', 'P', 'M', 'G', 'GG'));
  END IF;
END $$;

COMMIT;
