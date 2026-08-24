-- Criar tabela de cobranças para membros
CREATE TABLE IF NOT EXISTS cobrancas_membros (
  id BIGSERIAL PRIMARY KEY,
  membro_id BIGINT NOT NULL,
  valor DECIMAL(10, 2) NOT NULL,
  data_vencimento DATE NOT NULL,
  descricao TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelada', 'atrasada')),
  asaas_payment_id VARCHAR(100),
  data_criacao TIMESTAMP DEFAULT NOW(),
  data_pagamento TIMESTAMP,
  FOREIGN KEY (membro_id) REFERENCES cadastro_site(id) ON DELETE CASCADE
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_cobrancas_membro_id ON cobrancas_membros(membro_id);
CREATE INDEX IF NOT EXISTS idx_cobrancas_status ON cobrancas_membros(status);
CREATE INDEX IF NOT EXISTS idx_cobrancas_data_vencimento ON cobrancas_membros(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_cobrancas_asaas_payment_id ON cobrancas_membros(asaas_payment_id);

-- RLS: a tabela é escrita só por rotas server-side com service_role. As
-- policies originais eram `USING (true)` sem cláusula `TO` — valiam para
-- PUBLIC, incluindo `anon`, o que deixava dados financeiros de membros
-- legíveis e alteráveis por qualquer portador da anon key.
ALTER TABLE cobrancas_membros ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable read for all users" ON cobrancas_membros;
DROP POLICY IF EXISTS "Enable insert for all users" ON cobrancas_membros;
DROP POLICY IF EXISTS "Enable update for all users" ON cobrancas_membros;
DROP POLICY IF EXISTS "Enable delete for all users" ON cobrancas_membros;

DROP POLICY IF EXISTS "Service role full access cobrancas_membros" ON cobrancas_membros;
CREATE POLICY "Service role full access cobrancas_membros" ON cobrancas_membros
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON cobrancas_membros FROM anon, authenticated;
