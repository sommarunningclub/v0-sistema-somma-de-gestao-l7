-- 003-add-evento-tipo-local-url.sql
-- Add tipo and local_url columns to eventos table

ALTER TABLE eventos ADD COLUMN tipo TEXT DEFAULT 'corrida' CHECK (tipo IN ('corrida', 'personalizado'));
ALTER TABLE eventos ADD COLUMN local_url TEXT;
