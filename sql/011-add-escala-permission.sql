-- Migration: adiciona a chave "escala" ao JSONB de permissões dos usuários
-- Rodar uma vez no SQL Editor do Supabase

-- 1. Todo usuário sem a chave recebe escala = false
UPDATE users
SET permissions = permissions || '{"escala": false}'::jsonb
WHERE permissions IS NOT NULL
  AND NOT (permissions ? 'escala');

-- 2. Quem já coordena o check-in ganha acesso à escala
UPDATE users
SET permissions = permissions || '{"escala": true}'::jsonb
WHERE permissions IS NOT NULL
  AND (permissions->>'checkin')::boolean IS TRUE;

-- 3. Admin tem tudo
UPDATE users
SET permissions = permissions || '{"escala": true}'::jsonb
WHERE role = 'admin';

-- Verificação
SELECT id, email, role, permissions->>'escala' AS escala_permission
FROM users
ORDER BY role, email;
