-- ============================================================
-- Migration: Associate existing check-ins with events
-- Run AFTER creating events in the admin panel
-- ============================================================

-- 1. Create historical event records
INSERT INTO eventos (titulo, data_evento, checkin_status, horario_inicio)
VALUES
  ('Somma Club — Edição #01 de Março', '2026-03-07', 'encerrado', '07:00'),
  ('Somma Club — Edição #02 de Março', '2026-03-14', 'encerrado', '07:00')
ON CONFLICT DO NOTHING;

-- 2. Link check-ins by matching event date
UPDATE checkins c
SET evento_id = e.id
FROM eventos e
WHERE c.data_do_evento = e.data_evento
  AND c.evento_id IS NULL;
