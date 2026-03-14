-- ============================================================
-- Migration: Create `eventos` table + alter `checkins`
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Create eventos table
CREATE TABLE IF NOT EXISTS eventos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_evento DATE NOT NULL,
  horario_inicio TIME DEFAULT '07:00',
  local TEXT DEFAULT 'Parque da Cidade — Brasília, DF',

  -- Check-in control
  checkin_abertura TIMESTAMPTZ,
  checkin_fechamento TIMESTAMPTZ,
  checkin_status TEXT DEFAULT 'bloqueado'
    CHECK (checkin_status IN ('aberto', 'bloqueado', 'encerrado')),

  -- Squad config
  pelotoes TEXT[] DEFAULT ARRAY['4km', '6km', '8km'],

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  criado_por TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_eventos_data ON eventos(data_evento);
CREATE INDEX IF NOT EXISTS idx_eventos_status ON eventos(checkin_status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON eventos;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON eventos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 2. Add evento_id FK to checkins (nullable for backwards compat)
ALTER TABLE checkins ADD COLUMN IF NOT EXISTS evento_id UUID REFERENCES eventos(id);
CREATE INDEX IF NOT EXISTS idx_checkins_evento ON checkins(evento_id);

-- 3. RLS policies
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;

-- Public can read eventos
CREATE POLICY "Public read eventos" ON eventos
  FOR SELECT USING (true);

-- Only service_role can insert/update/delete
CREATE POLICY "Service role manages eventos" ON eventos
  FOR ALL USING (auth.role() = 'service_role');
