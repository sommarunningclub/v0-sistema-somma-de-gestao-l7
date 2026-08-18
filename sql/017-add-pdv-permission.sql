-- sql/017-add-pdv-permission.sql

UPDATE users
SET permissions = permissions || '{"pdv": false}'::jsonb
WHERE permissions IS NOT NULL
  AND NOT (permissions ? 'pdv');

UPDATE users
SET permissions = permissions || '{"pdv": true}'::jsonb
WHERE role = 'admin';
