-- sql/007-add-popups-permission.sql

-- Backfill popups: false into all existing users that don't have the key yet
UPDATE users
SET permissions = permissions || '{"popups": false}'::jsonb
WHERE permissions IS NOT NULL
  AND NOT (permissions ? 'popups');

-- Admin users get popups: true (same pattern as 005-add-tarefas-permission.sql)
UPDATE users
SET permissions = permissions || '{"popups": true}'::jsonb
WHERE role = 'admin';
