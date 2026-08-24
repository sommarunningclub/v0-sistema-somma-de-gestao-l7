-- Tabela centralizada de tags para qualquer entidade do sistema
CREATE TABLE IF NOT EXISTS entity_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL, -- 'asaas_customer' | 'lista_espera' | 'cobranca' | 'membro' | 'professor_client'
  entity_id text NOT NULL,   -- ID da entidade no respectivo módulo
  tag text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(entity_type, entity_id, tag)
);

-- Índices para buscas rápidas
CREATE INDEX IF NOT EXISTS idx_entity_tags_type_id ON entity_tags(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_tags_tag ON entity_tags(tag);

-- Tags pré-definidas de referência (opcional, para autocompletar)
CREATE TABLE IF NOT EXISTS tag_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tag text UNIQUE NOT NULL,
  color text DEFAULT 'blue',
  created_at timestamp with time zone DEFAULT now()
);

-- Inserir tags padrão do sistema
INSERT INTO tag_definitions (tag, color) VALUES
  ('alunoprofessor', 'blue'),
  ('alunosomma', 'orange')
ON CONFLICT (tag) DO NOTHING;

-- RLS: as tags são lidas e escritas por /api/entity-tags (service_role, sessão
-- obrigatória). Sem isso as tabelas ficavam abertas à anon key, que qualquer
-- visitante extrai do bundle do browser.
ALTER TABLE entity_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tag_definitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access entity_tags" ON entity_tags;
CREATE POLICY "Service role full access entity_tags" ON entity_tags
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access tag_definitions" ON tag_definitions;
CREATE POLICY "Service role full access tag_definitions" ON tag_definitions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON entity_tags, tag_definitions FROM anon, authenticated;
