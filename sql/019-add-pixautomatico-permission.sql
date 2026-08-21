-- sql/019-add-pixautomatico-permission.sql
--
-- Sem este backfill o módulo Pix Automático fica invisível para todo usuário
-- já cadastrado: hasModulePermission exige a chave === true, e os registros
-- antigos simplesmente não têm a chave.

UPDATE users
SET permissions = permissions || '{"pixAutomatico": false}'::jsonb
WHERE permissions IS NOT NULL
  AND NOT (permissions ? 'pixAutomatico');

UPDATE users
SET permissions = permissions || '{"pixAutomatico": true}'::jsonb
WHERE role = 'admin';
