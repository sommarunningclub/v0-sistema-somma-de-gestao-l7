-- sql/024-add-nova-assessoria-permission.sql
--
-- Módulo Nova Assessoria (contatos da BORA vindos do site). Sem este backfill
-- o módulo fica invisível para todo usuário já cadastrado: hasModulePermission
-- exige a chave === true, e os registros antigos simplesmente não têm a chave.
-- Admin enxerga por papel.
--
-- As tabelas do módulo (nova_assessoria_*) são criadas pela migration do
-- repositório do site: supabase/migrations/20261026120000_nova_assessoria_bora.sql.

UPDATE users
SET permissions = permissions || '{"novaAssessoria": false}'::jsonb
WHERE permissions IS NOT NULL
  AND NOT (permissions ? 'novaAssessoria');

UPDATE users
SET permissions = permissions || '{"novaAssessoria": true}'::jsonb
WHERE role = 'admin';
