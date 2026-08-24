-- Criar tabela de assinaturas para membros
CREATE TABLE IF NOT EXISTS assinaturas_membros (
  id BIGSERIAL PRIMARY KEY,
  membro_id BIGINT NOT NULL,
  asaas_subscription_id VARCHAR(100) NOT NULL UNIQUE,
  valor DECIMAL(10, 2) NOT NULL,
  ciclo VARCHAR(50) NOT NULL CHECK (ciclo IN ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL')),
  descricao TEXT NOT NULL,
  proxima_cobranca DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'ativa' CHECK (status IN ('ativa', 'pausada', 'cancelada')),
  data_criacao TIMESTAMP DEFAULT NOW(),
  data_cancelamento TIMESTAMP,
  FOREIGN KEY (membro_id) REFERENCES cadastro_site(id) ON DELETE CASCADE
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_assinaturas_membro_id ON assinaturas_membros(membro_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_status ON assinaturas_membros(status);
CREATE INDEX IF NOT EXISTS idx_assinaturas_asaas_id ON assinaturas_membros(asaas_subscription_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_proxima_cobranca ON assinaturas_membros(proxima_cobranca);

-- RLS: a tabela é escrita só por rotas server-side com service_role. As
-- policies originais eram `USING (true)` sem cláusula `TO` — valiam para
-- PUBLIC, incluindo `anon`, o que deixava dados financeiros de membros
-- legíveis e alteráveis por qualquer portador da anon key.
ALTER TABLE assinaturas_membros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for all users" ON assinaturas_membros;
DROP POLICY IF EXISTS "Enable insert for all users" ON assinaturas_membros;
DROP POLICY IF EXISTS "Enable update for all users" ON assinaturas_membros;
DROP POLICY IF EXISTS "Enable delete for all users" ON assinaturas_membros;

DROP POLICY IF EXISTS "Service role full access assinaturas_membros" ON assinaturas_membros;
CREATE POLICY "Service role full access assinaturas_membros" ON assinaturas_membros
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON assinaturas_membros FROM anon, authenticated;
