-- sql/021-add-nps-permission.sql
--
-- Módulo NPS Assessoria. Sem este backfill o módulo fica invisível para todo
-- usuário já cadastrado: hasModulePermission exige a chave === true, e os
-- registros antigos simplesmente não têm a chave. Admin enxerga por papel.
--
-- As tabelas do módulo (nps_assessoria_*) são criadas pelas migrations do
-- repositório do site: supabase/migrations/20260914120000_assessoria_nps.sql
-- e 20260914170000_assessoria_nps_rodadas.sql.

UPDATE users
SET permissions = permissions || '{"nps": false}'::jsonb
WHERE permissions IS NOT NULL
  AND NOT (permissions ? 'nps');

UPDATE users
SET permissions = permissions || '{"nps": true}'::jsonb
WHERE role = 'admin';
