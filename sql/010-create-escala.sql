-- ============================================================
-- Migration: Módulo Escala — escalação de Insiders por evento
-- Idempotente. Rodar no SQL Editor do Supabase.
-- ============================================================

-- 1. Catálogo de atividades (responsabilidades)
CREATE TABLE IF NOT EXISTS escala_atividades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  cor TEXT NOT NULL DEFAULT '#F97316',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Insider escalado em um evento
CREATE TABLE IF NOT EXISTS escala_insiders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  evento_id UUID NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  insider_id UUID NOT NULL REFERENCES dados_insiders(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('corre', 'apoio', 'nao_vai')),
  pelotao TEXT,
  motivo TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT escala_insiders_evento_insider_unico UNIQUE (evento_id, insider_id),
  CONSTRAINT escala_insiders_corre_exige_pelotao
    CHECK (status <> 'corre' OR pelotao IS NOT NULL),
  CONSTRAINT escala_insiders_nao_vai_exige_motivo
    CHECK (status <> 'nao_vai' OR (motivo IS NOT NULL AND btrim(motivo) <> ''))
);

-- 3. Vínculo N:N insider escalado ↔ atividade
CREATE TABLE IF NOT EXISTS escala_insider_atividades (
  escala_insider_id UUID NOT NULL REFERENCES escala_insiders(id) ON DELETE CASCADE,
  atividade_id UUID NOT NULL REFERENCES escala_atividades(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (escala_insider_id, atividade_id)
);

-- 4. Índices de consulta
CREATE INDEX IF NOT EXISTS idx_escala_insiders_evento ON escala_insiders(evento_id);
CREATE INDEX IF NOT EXISTS idx_escala_insiders_insider ON escala_insiders(insider_id);
CREATE INDEX IF NOT EXISTS idx_escala_atividades_ativo ON escala_atividades(ativo);
CREATE INDEX IF NOT EXISTS idx_escala_ia_atividade ON escala_insider_atividades(atividade_id);

-- 5. Trigger: pelotão precisa existir em eventos.pelotoes
CREATE OR REPLACE FUNCTION escala_valida_pelotao()
RETURNS TRIGGER AS $$
DECLARE
  pelotoes_evento TEXT[];
BEGIN
  IF NEW.status <> 'corre' OR NEW.pelotao IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT pelotoes INTO pelotoes_evento FROM eventos WHERE id = NEW.evento_id;

  IF pelotoes_evento IS NULL OR NOT (NEW.pelotao = ANY(pelotoes_evento)) THEN
    RAISE EXCEPTION 'Pelotão "%" não existe neste evento', NEW.pelotao;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS escala_valida_pelotao_trigger ON escala_insiders;
CREATE TRIGGER escala_valida_pelotao_trigger
  BEFORE INSERT OR UPDATE ON escala_insiders
  FOR EACH ROW EXECUTE FUNCTION escala_valida_pelotao();

-- 6. updated_at automático (função update_updated_at criada em 001-create-eventos-table.sql)
DROP TRIGGER IF EXISTS set_updated_at ON escala_atividades;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON escala_atividades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON escala_insiders;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON escala_insiders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 7. RLS — todo acesso passa pelas APIs server-side com service_role
ALTER TABLE escala_atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE escala_insiders ENABLE ROW LEVEL SECURITY;
ALTER TABLE escala_insider_atividades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role manages escala_atividades" ON escala_atividades;
CREATE POLICY "Service role manages escala_atividades" ON escala_atividades
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages escala_insiders" ON escala_insiders;
CREATE POLICY "Service role manages escala_insiders" ON escala_insiders
  FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role manages escala_insider_atividades" ON escala_insider_atividades;
CREATE POLICY "Service role manages escala_insider_atividades" ON escala_insider_atividades
  FOR ALL USING (auth.role() = 'service_role');
