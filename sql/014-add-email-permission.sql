-- sql/014-add-email-permission.sql

UPDATE users
SET permissions = permissions || '{"email": false}'::jsonb
WHERE permissions IS NOT NULL
  AND NOT (permissions ? 'email');

UPDATE users
SET permissions = permissions || '{"email": true}'::jsonb
WHERE role = 'admin';
