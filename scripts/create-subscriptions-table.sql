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

-- Permitir acesso à tabela
ALTER TABLE assinaturas_membros ENABLE ROW LEVEL SECURITY;

-- Política para leitura
CREATE POLICY "Enable read for all users" ON assinaturas_membros
  FOR SELECT USING (true);

-- Política para insert
CREATE POLICY "Enable insert for all users" ON assinaturas_membros
  FOR INSERT WITH CHECK (true);

-- Política para update
CREATE POLICY "Enable update for all users" ON assinaturas_membros
  FOR UPDATE USING (true) WITH CHECK (true);

-- Política para delete
CREATE POLICY "Enable delete for all users" ON assinaturas_membros
  FOR DELETE USING (true);
