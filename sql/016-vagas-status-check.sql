-- sql/016-vagas-status-check.sql
--
-- `candidatos_vagas.status` era texto livre. Um typo criaria uma etapa fantasma
-- que sumiria das contagens do módulo Vagas sem erro nenhum. As cinco etapas
-- são as mesmas de lib/vagas-constants.ts.

-- Normaliza qualquer valor fora do vocabulário antes de aplicar a restrição,
-- senão o ALTER falha na primeira linha divergente.
UPDATE candidatos_vagas
SET status = 'novo'
WHERE status IS NULL
   OR status NOT IN ('novo', 'em_analise', 'entrevista', 'aprovado', 'reprovado');

ALTER TABLE candidatos_vagas
  DROP CONSTRAINT IF EXISTS candidatos_vagas_status_check;

ALTER TABLE candidatos_vagas
  ADD CONSTRAINT candidatos_vagas_status_check
  CHECK (status IN ('novo', 'em_analise', 'entrevista', 'aprovado', 'reprovado'));
