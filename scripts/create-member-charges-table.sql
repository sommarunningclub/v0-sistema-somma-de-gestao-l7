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

-- Permitir acesso público à tabela
ALTER TABLE cobrancas_membros ENABLE ROW LEVEL SECURITY;

-- Política para leitura
CREATE POLICY "Enable read for all users" ON cobrancas_membros
  FOR SELECT USING (true);

-- Política para insert
CREATE POLICY "Enable insert for all users" ON cobrancas_membros
  FOR INSERT WITH CHECK (true);

-- Política para update
CREATE POLICY "Enable update for all users" ON cobrancas_membros
  FOR UPDATE USING (true) WITH CHECK (true);

-- Política para delete
CREATE POLICY "Enable delete for all users" ON cobrancas_membros
  FOR DELETE USING (true);
