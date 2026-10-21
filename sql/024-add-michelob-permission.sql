-- sql/024-add-michelob-permission.sql
--
-- Módulo Michelob Ultra. O painel do Michelob (projeto projeto-michelob-2026) entra
-- com os usuários desta tabela; a chave "michelob" é o que libera o acesso lá
-- (admin entra por papel). A conferência é feita pelas funções de michelob_ponte,
-- criadas pelo script scripts/supabase-ponte-operadores.sql do repositório do Michelob.
--
-- Sem este backfill o módulo fica invisível para todo usuário já cadastrado:
-- hasModulePermission exige a chave === true, e os registros antigos não têm a chave.

UPDATE users
SET permissions = permissions || '{"michelob": false}'::jsonb
WHERE permissions IS NOT NULL
  AND NOT (permissions ? 'michelob');

UPDATE users
SET permissions = permissions || '{"michelob": true}'::jsonb
WHERE role = 'admin';
