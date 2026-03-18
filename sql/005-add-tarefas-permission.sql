-- Migration: Add "tarefas" field to all existing users' permissions JSONB
-- Run this once in Supabase SQL Editor

-- 1. Add tarefas: false to every user that doesn't already have the field
UPDATE users
SET permissions = permissions || '{"tarefas": false}'::jsonb
WHERE permissions IS NOT NULL
  AND NOT (permissions ? 'tarefas');

-- 2. For admin users, set tarefas: true (they get all permissions)
UPDATE users
SET permissions = permissions || '{"tarefas": true}'::jsonb
WHERE role = 'admin';

-- Verify
SELECT id, email, role, permissions->>'tarefas' AS tarefas_permission
FROM users
ORDER BY role, email;
