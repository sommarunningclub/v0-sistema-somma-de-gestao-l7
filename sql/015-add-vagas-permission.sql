-- sql/015-add-vagas-permission.sql

UPDATE users
SET permissions = permissions || '{"vagas": false}'::jsonb
WHERE permissions IS NOT NULL
  AND NOT (permissions ? 'vagas');

UPDATE users
SET permissions = permissions || '{"vagas": true}'::jsonb
WHERE role = 'admin';
